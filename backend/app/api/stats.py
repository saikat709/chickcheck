import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.db import get_db
from backend.app.models import FlockMetric
from backend.app.schemas import LiveStatsResponse, HistoryResponse, HistoryPoint
from backend.app.services.pipeline import pipeline

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/live", response_model=LiveStatsResponse)
def get_live_stats():
    """Returns real-time instantaneous flock metrics and pipeline state."""
    stats = pipeline.get_latest_stats()
    return LiveStatsResponse(**stats)


@router.get("/history", response_model=HistoryResponse)
def get_historical_stats(
    range: str = Query("1h", pattern="^(1h|24h|7d)$"),
    db: Session = Depends(get_db),
):
    """
    Returns time series of count, activity, and health score over selected window.
    """
    now = datetime.datetime.utcnow()
    if range == "1h":
        start_time = now - datetime.timedelta(hours=1)
        step = 1  # All records or downsample
    elif range == "24h":
        start_time = now - datetime.timedelta(days=1)
        step = 5
    else:  # 7d
        start_time = now - datetime.timedelta(days=7)
        step = 30

    records = (
        db.query(FlockMetric)
        .filter(FlockMetric.timestamp >= start_time)
        .order_by(FlockMetric.timestamp.asc())
        .all()
    )

    downsampled = records[::step] if len(records) > 200 else records

    points = [
        HistoryPoint(
            timestamp=r.timestamp,
            count=r.count,
            activity_index=r.activity_index,
            flock_health_score=r.flock_health_score,
            mean_speed_norm=r.mean_speed_norm,
            status=r.status,
        )
        for r in downsampled
    ]

    return HistoryResponse(range=range, points=points)

