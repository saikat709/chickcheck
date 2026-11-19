"""Web push: subscription API, severity preferences, cleanup, and SSRF guard."""
import pytest

from backend.app.alerts.channels import webpush as wp
from backend.app.config import settings
from backend.app.models import PushSubscriptionRecord

FCM = "https://fcm.googleapis.com/fcm/send/abc123def456"
SUB = {"endpoint": FCM, "keys": {"p256dh": "B" * 87, "auth": "A" * 22}}


@pytest.fixture
def push_on(monkeypatch):
    monkeypatch.setattr(settings, "WEBPUSH_ENABLED", True)
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "BPUBLICKEYPUBLICKEY")
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "private-secret")
    monkeypatch.setattr(wp, "push_library_available", lambda: True)
    import backend.app.api.push as push_api

    monkeypatch.setattr(push_api, "push_library_available", lambda: True)
    yield


def test_public_key_never_exposes_private_key(client, push_on):
    r = client.get("/api/push/public-key")
    assert r.status_code == 200
    body = r.json()
    assert body == {"enabled": True, "public_key": "BPUBLICKEYPUBLICKEY"}
    assert "private-secret" not in r.text


def test_public_key_reports_disabled_without_vapid(client, monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", None)
    r = client.get("/api/push/public-key")
    assert r.json() == {"enabled": False, "public_key": None}


def test_subscribe_upsert_status_unsubscribe(client, db_session, push_on):
    r = client.post("/api/push/subscribe", json={"subscription": SUB, "min_severity": "warning"})
    assert r.status_code == 200 and r.json()["min_severity"] == "warning"
    # Upsert: same endpoint updates preference, no duplicate row
    client.post("/api/push/subscribe", json={"subscription": SUB, "min_severity": "critical"})
    assert db_session.query(PushSubscriptionRecord).count() == 1
    assert client.post("/api/push/status", json={"endpoint": FCM}).json() == {"subscribed": True, "min_severity": "critical"}
    assert client.post("/api/push/unsubscribe", json={"endpoint": FCM}).json() == {"unsubscribed": True}
    assert client.post("/api/push/status", json={"endpoint": FCM}).json()["subscribed"] is False


@pytest.mark.parametrize(
    "endpoint",
    ["http://fcm.googleapis.com/x/123456", "https://169.254.169.254/latest/meta", "https://evil.example.com/push/1"],
)
def test_subscribe_rejects_non_push_service_endpoints(client, push_on, endpoint):
    r = client.post("/api/push/subscribe", json={"subscription": {**SUB, "endpoint": endpoint}})
    assert r.status_code == 422


def test_subscribe_unavailable_without_config(client, monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", None)
    r = client.post("/api/push/subscribe", json={"subscription": SUB})
    assert r.status_code == 503


def _sub(db, endpoint, min_severity):
    rec = PushSubscriptionRecord(endpoint=endpoint, p256dh="B" * 87, auth="A" * 22, min_severity=min_severity)
    db.add(rec)
    db.commit()
    return rec


def test_dispatch_respects_severity_and_removes_expired(db_session, push_on, monkeypatch):
    _sub(db_session, "https://fcm.googleapis.com/fcm/send/crit-only", "critical")
    _sub(db_session, "https://fcm.googleapis.com/fcm/send/all-alerts", "info")
    _sub(db_session, "https://updates.push.services.mozilla.com/wpush/v2/gone", "info")
    delivered = []

    def fake_send(sub, payload, ttl=3600):
        delivered.append((sub.endpoint, payload["tag"]))
        if sub.endpoint.endswith("/gone"):
            return {"success": False, "status": 410, "gone": True}
        return {"success": True}

    monkeypatch.setattr(wp.WebPushChannel, "send_one", classmethod(lambda cls, s, p, ttl=3600: fake_send(s, p, ttl)))
    factory = lambda: db_session  # noqa: E731
    monkeypatch.setattr(db_session, "close", lambda: None)

    res = wp.WebPushChannel.dispatch_sync(
        {"event_id": "evt-1", "severity": "warning", "title": "Huddling", "description": "x"}, session_factory=factory
    )
    # warning: not sent to the critical-only device; expired one removed
    assert res["sent"] == 1 and res["removed"] == 1 and res["skipped"] == 1
    assert all(tag == "evt-1" for _, tag in delivered)  # event_id as tag → device-side de-duplication
    assert db_session.query(PushSubscriptionRecord).count() == 2


def test_dispatch_disabled_when_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", None)
    assert wp.WebPushChannel.dispatch_sync({"severity": "critical"}) == {"enabled": False}


def test_payload_is_minimal_and_truncated():
    p = wp.WebPushChannel.build_payload(
        {"event_id": "e", "severity": "critical", "title": "Count drop", "description": "d" * 500, "alert_type": "count_drop"}
    )
    assert p["title"].endswith("Count drop") and len(p["body"]) == 240 and p["tag"] == "e"
    assert "snapshot_path" not in p
