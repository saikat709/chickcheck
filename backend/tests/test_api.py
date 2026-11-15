import datetime
from backend.app.models import AnimalTrack, AlertEventRecord, FlockMetric


def test_api_root(client):
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert "ChickCheck" in data["app"]
    assert "disclaimer" in data


def test_api_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert "pipeline_fps" in data
    assert "source_status" in data
    assert "db_status" in data


def test_api_stats_live_and_history(client, db_session):
    # Insert mock flock metric
    fm = FlockMetric(
        timestamp=datetime.datetime.utcnow(),
        species="chicken",
        count=5,
        active_count=4,
        idle_count=1,
        mean_speed_norm=0.35,
        activity_index=72.0,
        dispersion=2.5,
        crowding_index=0.05,
        flock_health_score=94.0,
        status="healthy",
        fps=29.5,
    )
    db_session.add(fm)
    db_session.commit()

    res = client.get("/api/stats/live")
    assert res.status_code == 200

    res_hist = client.get("/api/stats/history?range=1h")
    assert res_hist.status_code == 200
    hist_data = res_hist.json()
    assert hist_data["range"] == "1h"
    assert len(hist_data["points"]) >= 1


def test_api_animals(client, db_session):
    track = AnimalTrack(
        animal_id=42,
        species="chicken",
        first_seen=datetime.datetime.utcnow(),
        last_seen=datetime.datetime.utcnow(),
        status="healthy",
        health_score=95.0,
        total_distance_px=150.0,
        total_idle_seconds=2.0,
        last_speed_norm=0.25,
        active=True,
    )
    db_session.add(track)
    db_session.commit()

    res = client.get("/api/animals")
    assert res.status_code == 200
    data = res.json()
    assert any(a["animal_id"] == 42 for a in data)

    res_det = client.get("/api/animals/42")
    assert res_det.status_code == 200
    det = res_det.json()
    assert det["animal_id"] == 42
    assert det["status"] == "healthy"


def test_api_events_and_ack(client, db_session):
    event = AlertEventRecord(
        event_id="test-event-uuid-1",
        timestamp=datetime.datetime.utcnow(),
        species="chicken",
        animal_id=42,
        severity="warning",
        alert_type="prolonged_inactivity",
        title="Prolonged Inactivity (Animal #42)",
        description="Animal #42 immobile for 3 min.",
        confidence=0.88,
        acknowledged=False,
    )
    db_session.add(event)
    db_session.commit()

    res = client.get("/api/events")
    assert res.status_code == 200
    events = res.json()
    assert len(events) >= 1

    # Test ACK
    res_ack = client.post("/api/events/test-event-uuid-1/ack")
    assert res_ack.status_code == 200
    assert res_ack.json()["success"] is True

    # Verify updated
    db_session.refresh(event)
    assert event.acknowledged is True


def test_api_config(client):
    res = client.get("/api/config")
    assert res.status_code == 200
    cfg = res.json()
    assert "species" in cfg
    assert "thresholds" in cfg
    assert "available_species" in cfg

    # Test PUT update
    update_payload = {
        "sensitivity": "high",
        "quiet_hours_enabled": True,
        "quiet_hours_start": 23,
        "quiet_hours_end": 5,
    }
    res_put = client.put("/api/config", json=update_payload)
    assert res_put.status_code == 200
    updated = res_put.json()
    assert updated["sensitivity"] == "high"
    assert updated["quiet_hours_enabled"] is True


def test_api_heatmap_json(client):
    res = client.get("/api/heatmap?format=json")
    assert res.status_code == 200
    data = res.json()
    assert "rows" in data
    assert "cols" in data
    assert "grid" in data


def test_api_daily_report(client):
    res = client.get("/api/reports/daily?format=json")
    assert res.status_code == 200
    data = res.json()
    assert "flock_summary" in data
    assert "alerts_summary" in data
    assert "disclaimer" in data

