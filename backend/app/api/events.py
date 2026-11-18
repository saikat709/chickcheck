import os
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.config import settings
from backend.app.db import get_db
from backend.app.models import AlertEventRecord
from backend.app.schemas import AlertEventResponse, AlertFeedbackRequest

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=List[AlertEventResponse])
def list_events(
    severity: Optional[str] = Query(None),
    alert_type: Optional[str] = Query(None),
    animal_id: Optional[int] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Retrieves paginated list of livestock anomaly alert events with filters."""
    query = db.query(AlertEventRecord)

    if severity:
        query = query.filter(AlertEventRecord.severity == severity.lower())
    if alert_type:
        query = query.filter(AlertEventRecord.alert_type == alert_type)
    if animal_id is not None:
        query = query.filter(AlertEventRecord.animal_id == animal_id)
    if acknowledged is not None:
        query = query.filter(AlertEventRecord.acknowledged == acknowledged)

    records = (
        query.order_by(desc(AlertEventRecord.timestamp))
        .offset(offset)
        .limit(limit)
        .all()
    )
    return records


@router.post("/{event_id}/ack")
def acknowledge_event(
    event_id: str,
    db: Session = Depends(get_db),
):
    """Marks an alert event as acknowledged by farm operator."""
    rec = (
        db.query(AlertEventRecord)
        .filter((AlertEventRecord.event_id == event_id) | (AlertEventRecord.id == int(event_id) if event_id.isdigit() else False))
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Alert event not found.")

    rec.acknowledged = True
    rec.acknowledged_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(rec)
    return {"success": True, "event_id": rec.event_id, "acknowledged_at": rec.acknowledged_at.isoformat()}


@router.get("/{event_id}/snapshot")
def get_event_snapshot(
    event_id: str,
    db: Session = Depends(get_db),
):
    """Serves the JPEG snapshot captured during this event."""
    rec = (
        db.query(AlertEventRecord)
        .filter((AlertEventRecord.event_id == event_id) | (AlertEventRecord.id == int(event_id) if event_id.isdigit() else False))
        .first()
    )
    if not rec or not rec.snapshot_path:
        raise HTTPException(status_code=404, detail="Snapshot not available for this event.")

    full_path = os.path.join(settings.DATA_DIR, rec.snapshot_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Snapshot file missing on disk.")

    return FileResponse(full_path, media_type="image/jpeg")


@router.get("/{event_id}/clip")
def get_event_clip(
    event_id: str,
    db: Session = Depends(get_db),
):
    """Serves the 10-second MP4 incident clip recorded during this event."""
    rec = (
        db.query(AlertEventRecord)
        .filter((AlertEventRecord.event_id == event_id) | (AlertEventRecord.id == int(event_id) if event_id.isdigit() else False))
        .first()
    )
    if not rec or not rec.clip_path:
        raise HTTPException(status_code=404, detail="Clip not available for this event.")

    full_path = os.path.join(settings.DATA_DIR, rec.clip_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Video clip file missing on disk.")

    return FileResponse(full_path, media_type="video/mp4")


@router.post("/{event_id}/feedback")
def submit_event_feedback(
    event_id: str,
    payload: AlertFeedbackRequest,
    db: Session = Depends(get_db),
):
    """
    Submits operator feedback ('correct' or 'false_alarm') on an anomaly alert.
    Allows real-time verification and continuous refinement of farm alerting thresholds.
    """
    rec = (
        db.query(AlertEventRecord)
        .filter((AlertEventRecord.event_id == event_id) | (AlertEventRecord.id == int(event_id) if event_id.isdigit() else False))
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Alert event not found.")

    fb = payload.feedback.lower().strip()
    if fb not in ["correct", "false_alarm"]:
        raise HTTPException(status_code=400, detail="Feedback must be 'correct' or 'false_alarm'.")

    rec.feedback = fb
    rec.feedback_notes = payload.notes
    rec.feedback_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(rec)
    return {
        "success": True,
        "event_id": rec.event_id,
        "feedback": rec.feedback,
        "feedback_notes": rec.feedback_notes,
        "feedback_at": rec.feedback_at.isoformat() if rec.feedback_at else None,
    }

