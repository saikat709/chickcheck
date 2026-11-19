"""
Web Push (VAPID) channel for installed / browser ChickCheck clients.

* Subscriptions live in the `push_subscriptions` table (one row per device).
* Each device chooses a minimum severity; quiet hours and de-duplication are
  applied upstream by AlertEngine before any channel is called.
* The payload carries the alert's event_id as the notification `tag`, so a
  repeat of the same alert replaces rather than stacks on the device.
* Expired subscriptions (HTTP 404/410 from the push service) are removed.
* pywebpush is imported lazily: if it is missing, push is reported as
  unavailable instead of breaking startup or the other channels.
"""
import asyncio
import datetime
import json
import logging
from typing import Any, Callable, Dict, Optional
from urllib.parse import urlparse

from backend.app.config import settings

logger = logging.getLogger("chickcheck.alerts.webpush")

SEVERITY_RANK = {"info": 0, "warning": 1, "critical": 2}
MAX_CONSECUTIVE_FAILURES = 10


def _load_webpush():
    try:
        from pywebpush import WebPushException, webpush  # type: ignore

        return webpush, WebPushException
    except ImportError:
        return None, None


def push_library_available() -> bool:
    return _load_webpush()[0] is not None


def push_configured() -> bool:
    return bool(settings.WEBPUSH_ENABLED and settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def allowed_push_host(endpoint: str) -> bool:
    """Only deliver to real browser push services (prevents SSRF via crafted endpoints)."""
    try:
        parsed = urlparse(endpoint)
    except ValueError:
        return False
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    allowed = [h.strip().lower() for h in settings.WEBPUSH_ALLOWED_HOSTS.split(",") if h.strip()]
    return any(host == h or host.endswith("." + h) for h in allowed)


class WebPushChannel:
    @staticmethod
    def build_payload(event_data: Dict[str, Any]) -> Dict[str, Any]:
        severity = event_data.get("severity", "info")
        title = event_data.get("title") or "ChickCheck alert"
        return {
            "title": f"{'🚨 ' if severity == 'critical' else ''}{title}",
            "body": (event_data.get("description") or "")[:240],
            "tag": event_data.get("event_id") or "chickcheck",
            "url": "/events?status=open",
            "severity": severity,
            "alert_type": event_data.get("alert_type"),
            "timestamp": event_data.get("timestamp"),
        }

    @classmethod
    def send_one(cls, sub: Any, payload: Dict[str, Any], ttl: int = 3600) -> Dict[str, Any]:
        """Synchronous single delivery (run in a worker thread)."""
        webpush, WebPushException = _load_webpush()
        if webpush is None:
            return {"success": False, "error": "pywebpush is not installed"}
        if not allowed_push_host(sub.endpoint):
            return {"success": False, "error": "endpoint host not allowed", "gone": True}
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=json.dumps(payload),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                ttl=ttl,
                headers={"Urgency": "high" if payload.get("severity") == "critical" else "normal"},
                timeout=10,
            )
            return {"success": True}
        except WebPushException as e:  # type: ignore[misc]
            status = getattr(getattr(e, "response", None), "status_code", None)
            return {"success": False, "status": status, "gone": status in (404, 410), "error": str(e)[:200]}
        except Exception as e:  # network errors etc.
            return {"success": False, "error": str(e)[:200]}

    @classmethod
    def dispatch_sync(
        cls,
        event_data: Dict[str, Any],
        session_factory: Optional[Callable[[], Any]] = None,
        ignore_preferences: bool = False,
    ) -> Dict[str, Any]:
        if not push_configured():
            return {"enabled": False}
        if not push_library_available():
            return {"enabled": True, "success": False, "error": "pywebpush is not installed"}

        from backend.app.db import SessionLocal
        from backend.app.models import PushSubscriptionRecord

        factory = session_factory or SessionLocal
        sev_rank = SEVERITY_RANK.get(event_data.get("severity", "info"), 0)
        payload = cls.build_payload(event_data)
        sent = failed = removed = skipped = 0

        db = factory()
        try:
            for sub in db.query(PushSubscriptionRecord).all():
                if not ignore_preferences and sev_rank < SEVERITY_RANK.get(sub.min_severity or "critical", 2):
                    skipped += 1
                    continue
                result = cls.send_one(sub, payload)
                if result["success"]:
                    sent += 1
                    sub.failure_count = 0
                    sub.last_success_at = datetime.datetime.utcnow()
                elif result.get("gone"):
                    db.delete(sub)
                    removed += 1
                else:
                    failed += 1
                    sub.failure_count = (sub.failure_count or 0) + 1
                    if sub.failure_count >= MAX_CONSECUTIVE_FAILURES:
                        db.delete(sub)
                        removed += 1
                    logger.warning(f"Web push delivery failed: {result.get('error')}")
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Web push dispatch error: {e}")
            return {"enabled": True, "success": False, "error": str(e)[:200]}
        finally:
            db.close()

        return {"enabled": True, "success": failed == 0, "sent": sent, "failed": failed, "removed": removed, "skipped": skipped}

    @classmethod
    async def dispatch(cls, event_data: Dict[str, Any], ignore_preferences: bool = False) -> Dict[str, Any]:
        return await asyncio.to_thread(cls.dispatch_sync, event_data, None, ignore_preferences)
