import math
from backend.app.config import settings, ThresholdSettings, SPECIES_PROFILES
from backend.app.vision.tracker_state import AnimalTrackState
from backend.app.analysis.anomalies import AnomalyDetector


def create_detector():
    thresholds = ThresholdSettings(
        inactivity_threshold_s=5.0,  # lower for fast synthetic tests
        inactivity_speed_norm=0.05,
        sudden_stop_speed_drop=0.5,
        fallen_aspect_ratio_delta=0.30,
        isolation_body_lengths=3.0,
        isolation_seconds=5.0,
        erratic_speed_multiplier=2.0,
        erratic_dir_changes=0.4,
        crowding_density_threshold=0.30,
        count_drop_ratio=0.30,
        low_activity_zscore=-1.8,
        limping_jitter_ratio=2.0,
        feeding_deviation_zscore=-2.0,
    )
    profile = SPECIES_PROFILES["chicken"]
    return AnomalyDetector(thresholds, profile)


def test_rule_prolonged_inactivity():
    detector = create_detector()
    t = AnimalTrackState(animal_id=1, initial_time=0.0, bbox=(100, 100, 150, 150))
    # Animal sits still for 6.0 seconds
    for step in range(1, 7):
        t.update(float(step), (100, 100, 150, 150), idle_speed_threshold_norm=0.05)

    flock_metrics = {"centroid": (100.0, 100.0), "active_count": 3}
    findings = detector.evaluate(6.0, [t], flock_metrics, {"is_default": True})

    rule_names = [f.rule_name for f in findings]
    assert "prolonged_inactivity" in rule_names
    assert "prolonged_inactivity" in t.active_anomalies


def test_rule_fallen_posture():
    detector = create_detector()
    # Baseline: square animal 50x50 (aspect ratio 1.0)
    t = AnimalTrackState(animal_id=2, initial_time=0.0, bbox=(100, 100, 150, 150))
    for step in range(1, 20):
        t.update(float(step), (100, 100, 150, 150))

    # Animal collapses: width stays 50, height becomes 25 (aspect ratio 2.0 -> delta 1.0)
    for step in range(20, 30):
        t.update(float(step), (100, 100, 150, 125))

    flock_metrics = {"centroid": (100.0, 100.0)}
    findings = detector.evaluate(30.0, [t], flock_metrics, {"is_default": True})

    rule_names = [f.rule_name for f in findings]
    assert "fallen_posture" in rule_names
    assert "fallen_posture" in t.active_anomalies


def test_rule_sudden_stop():
    detector = create_detector()
    t = AnimalTrackState(animal_id=3, initial_time=0.0, bbox=(100, 100, 150, 150))

    # High speed burst
    curr_x = 100.0
    for step in range(1, 10):
        curr_x += 40.0
        t.update(float(step), (curr_x, 100, curr_x + 50, 150))

    # Abrupt halt and posture change
    t.update(10.0, (curr_x, 100, curr_x + 70, 140))
    t.update(11.0, (curr_x, 100, curr_x + 70, 140))
    t.update(12.0, (curr_x, 100, curr_x + 70, 140))

    flock_metrics = {"centroid": (curr_x, 100.0)}
    findings = detector.evaluate(12.0, [t], flock_metrics, {"is_default": True})

    rule_names = [f.rule_name for f in findings]
    assert "sudden_stop" in rule_names


def test_rule_isolation():
    detector = create_detector()
    # Flock members near (100, 100)
    t1 = AnimalTrackState(1, 0.0, (100, 100, 150, 150))
    t2 = AnimalTrackState(2, 0.0, (110, 105, 160, 155))
    t3 = AnimalTrackState(3, 0.0, (105, 110, 155, 160))

    # Isolated animal at (800, 800) for 10 seconds (> isolation_seconds)
    t_iso = AnimalTrackState(4, 0.0, (800, 800, 850, 850))
    for step in range(1, 11):
        t1.update(float(step), (100, 100, 150, 150))
        t2.update(float(step), (110, 105, 160, 155))
        t3.update(float(step), (105, 110, 155, 160))
        t_iso.update(float(step), (800, 800, 850, 850))

    tracks = [t1, t2, t3, t_iso]
    flock_metrics = {
        "centroid": (105.0, 105.0),
        "dispersion": 1.5,
    }

    findings = detector.evaluate(10.0, tracks, flock_metrics, {"is_default": True})
    rule_names = [f.rule_name for f in findings]
    assert "isolation" in rule_names


def test_rule_panic_movement():
    detector = create_detector()
    tracks = []
    # 3 animals running rapidly with zigzag direction turns
    for aid in range(1, 4):
        t = AnimalTrackState(aid, 0.0, (aid * 100, 200, aid * 100 + 50, 250))
        cx = aid * 100
        cy = 200
        for step in range(1, 15):
            angle = (step % 2) * math.pi  # Zigzag 180 degrees back and forth
            cx += 50.0 * math.cos(angle)
            cy += 50.0 * math.sin(angle)
            t.update(float(step), (cx, cy, cx + 50, cy + 50))
        tracks.append(t)

    flock_metrics = {"centroid": (200.0, 200.0)}
    findings = detector.evaluate(15.0, tracks, flock_metrics, {"is_default": True})

    rule_names = [f.rule_name for f in findings]
    assert "panic_movement" in rule_names


def test_rule_count_drop():
    detector = create_detector()
    tracks = [AnimalTrackState(i, 0.0, (i * 50, 100, i * 50 + 40, 140)) for i in range(10)]

    # Simulate 25 frames with count = 10
    flock_metrics = {"centroid": (200.0, 100.0)}
    for step in range(25):
        detector.evaluate(float(step), tracks, flock_metrics, {"is_default": True})

    # Suddenly count drops to 2
    tracks_dropped = tracks[:2]
    findings = detector.evaluate(26.0, tracks_dropped, flock_metrics, {"is_default": True})

    rule_names = [f.rule_name for f in findings]
    assert "count_drop" in rule_names
