import os
import uuid
import datetime
import asyncio
import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
import numpy as np

from backend.app.config import settings
from backend.app.models import AlertEventRecord
from backend.app.analysis.anomalies import AnomalyFinding
from backend.app.alerts.dedupe import AlertDeduplicator
from backend.app.alerts.channels.telegram import TelegramChannel
from backend.app.alerts.channels.webhook import WebhookChannel
from backend.app.alerts.channels.email import EmailChannel
from backend.app.alerts.channels.webpush import WebPushChannel
from backend.app.services.recorder import VideoClipRecorder

logger = logging.getLogger("chickcheck.alerts.engine")


class AlertEngine:
    """
    Coordinates anomaly ingestion, deduplication, evidence capture (snapshot & video clip),
    multi-channel dispatch (Telegram, Webhook, Email), and database persistence.
    """

    def __init__(self, recorder: VideoClipRecorder):
        self.recorder = recorder
        preset = settings.SENSITIVITY.lower()
        cooldown_s = 300.0
        if preset == "high":
            cooldown_s = 180.0
        elif preset == "low":
            cooldown_s = 420.0
        self.deduplicator = AlertDeduplicator(default_cooldown_seconds=cooldown_s)

    def is_quiet_hours(self, dt: Optional[datetime.datetime] = None) -> bool:
        if not settings.QUIET_HOURS_ENABLED:
            return False

        if dt is None:
            dt = datetime.datetime.now()
        h = dt.hour

        start = settings.QUIET_HOURS_START
        end = settings.QUIET_HOURS_END

        if start > end:
            # Over midnight: e.g. 22:00 to 06:00
            return h >= start or h < end
        else:
            return start <= h < end

    async def process_findings(
        self,
        db: Session,
        findings: List[AnomalyFinding],
        current_frame: np.ndarray,
        animal_bboxes: Dict[int, Any],
        sse_broadcast_callback: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        dispatched_events: List[Dict[str, Any]] = []

        for f in findings:
            should_send, effective_severity = self.deduplicator.should_alert(
                alert_type=f.rule_name,
                animal_id=f.animal_id,
                requested_severity=f.severity,
            )

            if not should_send:
                continue

            event_id = str(uuid.uuid4())
            ts = datetime.datetime.utcnow()

            # 1. Capture snapshot image (offloaded to thread to keep event loop free)
            highlight_bbox = animal_bboxes.get(f.animal_id) if f.animal_id is not None else None
            snapshot_rel_path = None
            snapshot_bytes = None
            try:
                snapshot_rel_path, snapshot_bytes = await asyncio.to_thread(
                    self.recorder.save_snapshot,
                    current_frame,
                    f"{f.rule_name}_{f.animal_id or 'flock'}",
                    highlight_bbox,
                )
            except Exception as e:
                logger.error(f"Error capturing alert snapshot: {e}")

            # 2. Extract video clip (offloaded to thread)
            clip_rel_path = None
            try:
                clip_rel_path = await asyncio.to_thread(
                    self.recorder.export_clip,
                    f"alert_{f.rule_name}",
                    10.0,
                )
            except Exception as e:
                logger.error(f"Error capturing alert video clip: {e}")

            # 3. Persist Alert to Database (offloaded to thread)
            rec = AlertEventRecord(
                event_id=event_id,
                timestamp=ts,
                species=settings.SPECIES,
                animal_id=f.animal_id,
                severity=effective_severity,
                alert_type=f.rule_name,
                title=f.title,
                description=f.description,
                confidence=f.confidence,
                snapshot_path=snapshot_rel_path,
                clip_path=clip_rel_path,
                acknowledged=False,
            )
            def _save_db():
                try:
                    db.add(rec)
                    db.commit()
                    db.refresh(rec)
                except Exception as e:
                    db.rollback()
                    logger.error(f"Failed to save alert event to DB: {e}")

            await asyncio.to_thread(_save_db)

            event_data = {
                "id": rec.id if hasattr(rec, "id") and rec.id else 0,
                "event_id": event_id,
                "timestamp": ts.isoformat(),
                "species": settings.SPECIES,
                "animal_id": f.animal_id,
                "severity": effective_severity,
                "alert_type": f.rule_name,
                "title": f.title,
                "description": f.description,
                "confidence": f.confidence,
                "snapshot_path": snapshot_rel_path,
                "clip_path": clip_rel_path,
                "acknowledged": False,
            }
            dispatched_events.append(event_data)

            # 4. Notify via SSE to frontend immediately
            if sse_broadcast_callback:
                try:
                    await sse_broadcast_callback("event", event_data)
                except Exception as e:
                    logger.warning(f"SSE event broadcast failed: {e}")

            # 5. Check quiet hours: only critical alerts are sent outside quiet hours
            in_quiet = self.is_quiet_hours()
            if in_quiet and effective_severity != "critical":
                logger.info(f"Alert {event_id} ({effective_severity}) suppressed by Quiet Hours.")
                continue

            # 6. Dispatch to real notification channels
            await self._dispatch_channels(
                title=f.title,
                description=f.description,
                severity=effective_severity,
                event_data=event_data,
                snapshot_bytes=snapshot_bytes,
            )

        return dispatched_events

    async def _dispatch_channels(
        self,
        title: str,
        description: str,
        severity: str,
        event_data: Dict[str, Any],
        snapshot_bytes: Optional[bytes] = None,
    ) -> Dict[str, Any]:
        results = {}

        # Telegram
        if settings.TELEGRAM_ENABLED and settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
            results["telegram"] = await TelegramChannel.send_alert(
                bot_token=settings.TELEGRAM_BOT_TOKEN,
                chat_id=settings.TELEGRAM_CHAT_ID,
                title=title,
                description=description,
                severity=severity,
                snapshot_bytes=snapshot_bytes,
            )
        else:
            results["telegram"] = {"enabled": False}

        # Webhook
        if settings.WEBHOOK_ENABLED and settings.WEBHOOK_URL:
            results["webhook"] = await WebhookChannel.send_alert(
                url=settings.WEBHOOK_URL,
                secret=settings.WEBHOOK_SECRET,
                payload=event_data,
            )
        else:
            results["webhook"] = {"enabled": False}

        # Email
        if settings.SMTP_ENABLED and settings.SMTP_HOST and settings.SMTP_TO:
            results["email"] = await EmailChannel.send_alert(
                host=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                user=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                from_addr=settings.SMTP_FROM or "chickcheck@local",
                to_addr=settings.SMTP_TO,
                use_tls=settings.SMTP_TLS,
                subject=f"[ChickCheck {severity.upper()}] {title}",
                body_text=f"{title}\n\n{description}\n\nTimestamp: {event_data.get('timestamp')}",
                snapshot_bytes=snapshot_bytes,
            )
        else:
            results["email"] = {"enabled": False}

        # Web push to subscribed browsers / installed PWAs (per-device severity filter)
        try:
            results["webpush"] = await WebPushChannel.dispatch(event_data)
        except Exception as e:
            logger.error(f"Web push dispatch failed: {e}")
            results["webpush"] = {"success": False, "error": str(e)}

        return results

