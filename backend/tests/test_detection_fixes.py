import cv2
import numpy as np
import pytest

from backend.app.config import settings
from backend.app.vision.detector import LivestockDetector
from backend.app.vision.tracker_state import TrackerPool, SYNTHETIC_ID_BASE

COCO = {0: "person", 14: "bird", 15: "cat", 16: "dog", 18: "sheep", 19: "cow", 46: "banana", 77: "teddy bear"}


class _FakeModel:
    def __init__(self, names):
        self.names = names


def make_detector(names, monkeypatch, species="chicken", custom_names=None):
    monkeypatch.setattr(settings, "SPECIES", species)
    monkeypatch.setattr(settings, "CUSTOM_CLASS_NAMES", custom_names)
    d = LivestockDetector.__new__(LivestockDetector)
    d.model = _FakeModel(names)
    d._configure_classes()
    return d


# ---- class selection -------------------------------------------------------
def test_coco_poultry_uses_bird_plus_proxies_only(monkeypatch):
    d = make_detector(COCO, monkeypatch)
    assert set(d.target_class_ids) == {14, 18, 77}  # no banana/cat/dog junk classes


def test_species_all_keeps_real_classes(monkeypatch):
    d = make_detector(COCO, monkeypatch, species="all")
    assert d.class_id_to_species[19] == "cow"      # cows detected (were dropped before)
    assert d.class_id_to_species[18] in ("sheep",)  # sheep not relabelled as chicken
    assert d.class_id_to_species[14] == "chicken"


def test_custom_model_without_class_names_never_uses_coco_ids(monkeypatch):
    d = make_detector({0: "hen", 1: "rooster"}, monkeypatch)
    assert d.target_class_ids == [0, 1]
    d2 = make_detector({0: "foo", 1: "bar"}, monkeypatch)
    assert d2.target_class_ids is None  # detect all, instead of filtering everything out


# ---- confidence ------------------------------------------------------------
def test_conf_is_never_forced_to_near_zero(monkeypatch):
    d = LivestockDetector.__new__(LivestockDetector)
    c = d._effective_conf(0.25, 576, 1024, False, True)
    assert settings.ADAPTIVE_CONF_FLOOR <= c <= 0.25
    assert d._effective_conf(0.05, 576, 1024, False, True) <= 0.05  # never above user's value


# ---- colour fusion ---------------------------------------------------------
def test_fusion_ignores_walls_and_oversized_blobs():
    d = LivestockDetector.__new__(LivestockDetector)
    img = np.full((400, 600, 3), (30, 60, 110), np.uint8)  # dark brown bedding
    cv2.rectangle(img, (300, 0), (600, 200), (240, 240, 240), -1)  # big white wall
    for cx in (60, 140, 220):
        cv2.ellipse(img, (cx, 300), (25, 20), 0, 0, 360, (235, 235, 235), -1)  # chick-sized blob
    seen = [(35.0, 280.0, 85.0, 320.0), (115.0, 280.0, 165.0, 320.0), (195.0, 280.0, 245.0, 320.0)]
    assert d._color_fusion(img, list(seen), "chicken") == []  # wall rejected, chicks already covered
    cv2.ellipse(img, (400, 330), (25, 20), 0, 0, 360, (235, 235, 235), -1)  # one uncovered chick
    out = d._color_fusion(img, list(seen), "chicken")
    assert len(out) == 1 and out[0]["id"] is None


# ---- tracker pool ----------------------------------------------------------
def box(cx, cy, s=40):
    return (cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2)


def test_new_chick_next_to_neighbour_is_not_absorbed():
    pool = TrackerPool()
    pool.update_detections([{"id": 1, "bbox": box(100, 100), "species": "chicken"}], 0.0)
    # frame 2: a NEW chick (id 2) listed first, right beside chick 1, which is also detected
    pairs = pool.update_detections(
        [{"id": 2, "bbox": box(130, 100), "species": "chicken"},
         {"id": 1, "bbox": box(102, 100), "species": "chicken"}], 0.1)
    assert len(pool.tracks) == 2
    assert {t.animal_id for _, t in pairs} == {1, 2}


def test_untracked_detection_does_not_collide_with_tracker_ids():
    pool = TrackerPool()
    pool.update_detections([{"id": 1, "bbox": box(100, 100), "species": "chicken"}], 0.0)
    pairs = pool.update_detections([{"id": None, "bbox": box(400, 400), "species": "chicken"}], 0.1)
    new_id = pairs[0][1].animal_id
    assert new_id >= SYNTHETIC_ID_BASE and new_id != 1
    # a later ByteTrack id equal to an old counter value must be a separate animal
    pool.update_detections([{"id": 2, "bbox": box(700, 100), "species": "chicken"}], 0.2)
    assert pool.tracks[2].animal_id == 2


def test_missing_id_matches_nearest_not_first():
    pool = TrackerPool()
    pool.update_detections([{"id": 1, "bbox": box(100, 100), "species": "chicken"},
                            {"id": 2, "bbox": box(150, 100), "species": "chicken"}], 0.0)
    pairs = pool.update_detections([{"id": None, "bbox": box(152, 100), "species": "chicken"}], 0.1)
    assert pairs[0][1].animal_id == 2  # old code returned track 1 (first within range)
