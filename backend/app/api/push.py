"""Web push subscription management for installed / browser clients."""
import asyncio
import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.alerts.channels.webpush import (
    WebPushChannel,
    allowed_push_host,
    push_configured,
    push_library_available,
)
from backend.app.config import settings
from backend.app.db import get_db
from backend.app.models import PushSubscriptionRecord

router = APIRouter(prefix="/api/push", tags=["push"])

Severity = Literal["info", "warning", "critical"]


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=16, max_length=256)
    auth: str = Field(min_length=8, max_length=64)


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(min_length=12, max_length=1024)
    keys: PushKeys


class SubscribeRequest(BaseModel):
    subscription: PushSubscriptionIn
    min_severity: Severity = "critical"


class EndpointRequest(BaseModel):
    endpoint: str = Field(min_length=12, max_length=1024)


def _require_push():
    if not push_configured():
        raise HTTPException(status_code=503, detail="Web push is not configured on the server (VAPID keys missing).")
    if not push_library_available():
        raise HTTPException(status_code=503, detail="Web push library (pywebpush) is not installed on the server.")


def _check_endpoint(endpoint: str):
    if not allowed_push_host(endpoint):
        raise HTTPException(status_code=422, detail="Subscription endpoint is not a recognised browser push service.")


@router.get("/public-key")
def get_public_key():
    """VAPID *public* key for PushManager.subscribe(). The private key never leaves the server."""
    enabled = push_configured() and push_library_available()
    return {"enabled": enabled, "public_key": settings.VAPID_PUBLIC_KEY if enabled else None}


@router.post("/subscribe")
def subscribe(body: SubscribeRequest, request: Request, db: Session = Depends(get_db)):
    _require_push()
    sub = body.subscription
    _check_endpoint(sub.endpoint)
    rec = db.query(PushSubscriptionRecord).filter(PushSubscriptionRecord.endpoint == sub.endpoint).first()
    now = datetime.datetime.utcnow()
    if rec is None:
        rec = PushSubscriptionRecord(endpoint=sub.endpoint, created_at=now)
        db.add(rec)
    rec.p256dh = sub.keys.p256dh
    rec.auth = sub.keys.auth
    rec.min_severity = body.min_severity
    rec.user_agent = (request.headers.get("user-agent") or "")[:256]
    rec.updated_at = now
    rec.failure_count = 0
    db.commit()
    return {"subscribed": True, "min_severity": rec.min_severity}


@router.post("/status")
def status(body: EndpointRequest, db: Session = Depends(get_db)):
    rec = db.query(PushSubscriptionRecord).filter(PushSubscriptionRecord.endpoint == body.endpoint).first()
    return {"subscribed": rec is not None, "min_severity": rec.min_severity if rec else None}


@router.post("/unsubscribe")
def unsubscribe(body: EndpointRequest, db: Session = Depends(get_db)):
    rec = db.query(PushSubscriptionRecord).filter(PushSubscriptionRecord.endpoint == body.endpoint).first()
    if rec is not None:
        db.delete(rec)
        db.commit()
    return {"unsubscribed": rec is not None}


@router.post("/test")
async def send_test(body: EndpointRequest, db: Session = Depends(get_db)):
    """Send a test notification to one device (the caller's own subscription)."""
    _require_push()
    rec: Optional[PushSubscriptionRecord] = (
        db.query(PushSubscriptionRecord).filter(PushSubscriptionRecord.endpoint == body.endpoint).first()
    )
    if rec is None:
        raise HTTPException(status_code=404, detail="This device is not subscribed.")
    payload = {
        "title": "ChickCheck test notification",
        "body": "Push notifications are working on this device.",
        "tag": "chickcheck-test",
        "url": "/settings",
        "severity": "info",
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }
    result = await asyncio.to_thread(WebPushChannel.send_one, rec, payload, 300)
    if not result["success"] and result.get("gone"):
        db.delete(rec)
        db.commit()
    return result
