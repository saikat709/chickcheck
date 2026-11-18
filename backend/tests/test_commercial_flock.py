import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.analysis.optical_flow import FlockFlowAnalyzer
from backend.app.vision.density_counter import FlockDensityCounter
from backend.app.analysis.immobile import ImmobileBirdDetector
from backend.app.vision.camera_guard import CameraGuard
from backend.app.analysis.zones import BarnZoneManager
from backend.app.services.reports import ReportGenerator
from backend.app.models import AlertEventRecord
from backend.app.db import get_db


def test_optical_flow_analyzer():
    analyzer = FlockFlowAnalyzer(grid_size=(8, 8))
    f1 = np.zeros((360, 640, 3), dtype=np.uint8)
    f2 = np.zeros((360, 640, 3), dtype=np.uint8)
    # Simulate movement in right-hand quadrant
    f2[100:200, 300:400] = 200

    metrics1 = analyzer.update(f1)
    assert metrics1["activity_index"] == 0.0

    metrics2 = analyzer.update(f2)
    assert 0.0 <= metrics2["activity_index"] <= 100.0
    assert len(metrics2["grid_energy"]) == 8
    assert len(metrics2["grid_energy"][0]) == 8

    # Test overlay rendering
    annotated = analyzer.render_flow_overlay(f2.copy(), step=32)
    assert annotated.shape == f2.shape


def test_flock_density_counter():
    counter = FlockDensityCounter(history_size=10)
    frame = np.ones((480, 640, 3), dtype=np.uint8) * 180  # Pale/plumage-like background
    # Add dummy pale bird shapes
    cv2.circle(frame, (200, 200), 30, (240, 240, 240), -1)
    cv2.circle(frame, (280, 210), 30, (240, 240, 240), -1)

    est = counter.estimate(frame, box_count=2, tracks=[])
    assert est.count >= 0
    assert est.uncertainty >= 0
    assert est.count_min <= est.count <= est.count_max
    assert est.regime in ["sparse_box", "dense_crowd"]
    assert est.method in ["box_tracking", "plumage_density_map"]


def test_immobile_bird_detector():
    detector = ImmobileBirdDetector(min_duration_s=2.0)
    frame = np.zeros((360, 640, 3), dtype=np.uint8)
    # Draw stationary plumage blob
    cv2.circle(frame, (150, 150), 20, (220, 220, 220), -1)

    # Feed frames over 3 seconds
    cands1 = detector.update(frame, timestamp=0.0, active_flock_motion=True)
    assert len(cands1) == 0

    cands2 = detector.update(frame, timestamp=3.0, active_flock_motion=True)
    assert len(cands2) >= 1
    assert cands2[0]["duration_s"] >= 2.0
    assert len(cands2[0]["bbox"]) == 4


def test_camera_guard_blackout_and_blur():
    guard = CameraGuard()

    # Blackout test
    black_frame = np.zeros((360, 640, 3), dtype=np.uint8)
    fault_black = guard.check(black_frame)
    assert fault_black is not None
    assert "blackout" in fault_black["type"]
    assert fault_black["severity"] == "critical"

    # Blur / obstruction test
    gray_flat = np.ones((360, 640, 3), dtype=np.uint8) * 120
    fault_blur = guard.check(gray_flat)
    assert fault_blur is not None
    assert "obstruction" in fault_blur["type"] or "blur" in fault_blur["type"]


def test_barn_zone_manager():
    zm = BarnZoneManager()
    centroids = [(100, 100), (400, 400), (700, 700)]
    occ = zm.compute_zone_occupancy(centroids, frame_shape=(1000, 1000))
    assert isinstance(occ, dict)
    assert "feeder" in occ
    assert "drinker" in occ
    assert "resting" in occ
    total_pct = sum(occ.values())
    assert 99.0 <= total_pct <= 101.0  # Sums to ~100%


def test_alert_feedback_api(client, db_session):
    # Create test event
    ev = AlertEventRecord(
        event_id="test_alert_fb_123",
        species="chicken",
        severity="warning",
        alert_type="crowding_huddling",
        title="Test Crowding",
        description="Testing operator feedback loop",
        confidence=0.88,
    )
    db_session.add(ev)
    db_session.commit()

    # Submit correct feedback
    resp = client.post("/api/events/test_alert_fb_123/feedback", json={
        "feedback": "correct",
        "notes": "Verified cold huddle in quadrant 2",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["feedback"] == "correct"
    assert data["feedback_notes"] == "Verified cold huddle in quadrant 2"

    # Verify invalid feedback validation
    bad_resp = client.post("/api/events/test_alert_fb_123/feedback", json={
        "feedback": "maybe",
    })
    assert bad_resp.status_code == 400


def test_multilingual_daily_reports(client, db_session):
    summary, _ = ReportGenerator.generate_daily_report(db_session, "2026-11-18")
    assert "executive_summary" in summary
    assert "en" in summary["executive_summary"]
    assert "bn" in summary["executive_summary"]
    assert len(summary["executive_summary"]["en"]) > 50
    assert len(summary["executive_summary"]["bn"]) > 50

    # Test API with lang=bn
    resp = client.get("/api/reports/daily?date=2026-11-18&lang=bn")
    assert resp.status_code == 200
    data = resp.json()
    assert "summary_text" in data
    assert "বাণিজ্যিক পোল্ট্রি খামার" in data["summary_text"]
