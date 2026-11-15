import time
import numpy as np
import pytest
from backend.app.vision.enhancer import AdaptiveImageEnhancer
from backend.app.vision.tracker_state import TrackerPool, AnimalTrackState
from backend.app.analysis.metrics import compute_flock_metrics


def test_adaptive_image_enhancer_low_res():
    enhancer = AdaptiveImageEnhancer(clahe_clip_limit=2.5, sharpen_strength=0.4)

    # 1. Low-res blurred synthetic frame (320x240)
    low_res_frame = np.full((240, 320, 3), 120, dtype=np.uint8)
    # Add low contrast gradient
    for i in range(240):
        low_res_frame[i, :, :] = 110 + int(20 * (i / 240))

    assert enhancer.is_low_res_or_degraded(low_res_frame) is True

    enhanced, was_enhanced = enhancer.enhance(low_res_frame)
    assert was_enhanced is True
    assert enhanced.shape[0] >= 240
    assert enhanced.shape[1] >= 320
    assert enhanced.dtype == np.uint8


def test_adaptive_image_enhancer_high_res():
    enhancer = AdaptiveImageEnhancer(low_res_threshold_h=540, low_res_threshold_w=640)
    # High-res image with clear contrast (1280x720)
    rng = np.random.RandomState(42)
    high_res_frame = rng.randint(0, 255, (720, 1280, 3), dtype=np.uint8)

    assert enhancer.is_low_res_or_degraded(high_res_frame) is False

    enhanced, was_enhanced = enhancer.enhance(high_res_frame)
    assert was_enhanced is False
    assert enhanced.shape == high_res_frame.shape


def test_multi_species_tracker_pool():
    pool = TrackerPool(track_lost_seconds=3.0, max_trail_points=30)
    t = time.time()

    # Track 1: Chicken
    t1 = pool.update_track(
        animal_id=1,
        timestamp=t,
        bbox=(100.0, 100.0, 150.0, 160.0),
        species="chicken",
    )
    assert t1.species == "chicken"
    assert t1.animal_id == 1

    # Track 2: Duck
    t2 = pool.update_track(
        animal_id=2,
        timestamp=t,
        bbox=(200.0, 200.0, 260.0, 270.0),
        species="duck",
    )
    assert t2.species == "duck"
    assert t2.animal_id == 2

    # Coordinate smoothing test
    t1_updated = pool.update_track(
        animal_id=1,
        timestamp=t + 0.1,
        bbox=(104.0, 102.0, 152.0, 161.0),
        species="chicken",
    )
    # EMA smoothing alpha=0.70 means box is smoothed between previous and new
    assert t1_updated.last_bbox[0] != 104.0
    assert 100.0 < t1_updated.last_bbox[0] < 104.0

    active = pool.get_active_tracks()
    assert len(active) == 2
    species_set = {a.species for a in active}
    assert "chicken" in species_set
    assert "duck" in species_set


def test_flock_metrics_multi_species_and_clustering():
    tracks = []
    t = time.time()

    # 4 animals close together in a dense huddle (around (200, 200))
    for i in range(1, 5):
        tr = AnimalTrackState(
            animal_id=i,
            initial_time=t - 10.0,
            bbox=(200.0 + i * 5, 200.0 + i * 5, 250.0 + i * 5, 260.0 + i * 5),
            species="chicken" if i <= 3 else "duck",
        )
        tr.history.append((t, 225.0, 230.0, 50.0, 60.0, 0.83, 0.15))
        tracks.append(tr)

    # 1 isolated animal far away (around (800, 800))
    iso = AnimalTrackState(
        animal_id=5,
        initial_time=t - 10.0,
        bbox=(800.0, 800.0, 850.0, 860.0),
        species="duck",
    )
    iso.history.append((t, 825.0, 830.0, 50.0, 60.0, 0.83, 0.02))
    tracks.append(iso)

    metrics = compute_flock_metrics(tracks, frame_width=1280, frame_height=720)

    # Test count & multi-species breakdown
    assert metrics["count"] == 5
    assert metrics["species_counts"] == {"chicken": 3, "duck": 2}

    # Test spatial clustering
    assert "clusters" in metrics
    assert metrics["max_cluster_size"] >= 4
    cluster = metrics["clusters"][0]
    assert cluster["size"] >= 4
    assert len(cluster["animal_ids"]) >= 4
