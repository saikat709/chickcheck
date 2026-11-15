import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.db import get_db
from backend.app.models import AnimalTrack, AlertEventRecord
from backend.app.schemas import AnimalTrackResponse, AnimalDetailResponse
from backend.app.services.pipeline import pipeline

router = APIRouter(prefix="/api/animals", tags=["animals"])


@router.get("", response_model=List[AnimalTrackResponse])
def list_animals(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Lists tracked livestock animals with their health scores, speed, and status."""
    active_pool_tracks = pipeline.tracker_pool.get_active_tracks()
    active_ids = {t.animal_id for t in active_pool_tracks}

    query = db.query(AnimalTrack)
    if active_only:
        query = query.filter(AnimalTrack.animal_id.in_(active_ids))

    tracks = query.order_by(desc(AnimalTrack.last_seen)).limit(100).all()

    # Reconcile in-memory real-time state with DB records
    response = []
    for tr in tracks:
        mem_track = pipeline.tracker_pool.get_track(tr.animal_id)
        is_active = tr.animal_id in active_ids

        response.append(
            AnimalTrackResponse(
                animal_id=tr.animal_id,
                species=tr.species,
                first_seen=tr.first_seen,
                last_seen=tr.last_seen,
                status=mem_track.status if mem_track else tr.status,
                health_score=mem_track.health_score if mem_track else tr.health_score,
                total_distance_px=mem_track.total_distance_px if mem_track else tr.total_distance_px,
                total_idle_seconds=mem_track.total_idle_seconds if mem_track else tr.total_idle_seconds,
                last_speed_norm=mem_track.last_speed_norm if mem_track else tr.last_speed_norm,
                active=is_active,
            )
        )
    return response


@router.get("/{animal_id}", response_model=AnimalDetailResponse)
def get_animal_detail(
    animal_id: int,
    db: Session = Depends(get_db),
):
    """
    Returns full kinematics, motion trail, recent speed points, and incident history
    for a specific animal ID.
    """
    db_track = db.query(AnimalTrack).filter(AnimalTrack.animal_id == animal_id).first()
    mem_track = pipeline.tracker_pool.get_track(animal_id)

    if not db_track and not mem_track:
        raise HTTPException(status_code=404, detail=f"Animal #{animal_id} not found.")

    trail_pts = []
    speed_hist = []
    if mem_track:
        trail_pts = [[float(pt[0]), float(pt[1])] for pt in mem_track.trail]
        for h in list(mem_track.history)[-30:]:
            speed_hist.append({
                "timestamp": h[0],
                "speed_norm": round(h[6], 3),
            })

    # Fetch alerts for this animal
    events = (
        db.query(AlertEventRecord)
        .filter(AlertEventRecord.animal_id == animal_id)
        .order_by(desc(AlertEventRecord.timestamp))
        .limit(20)
        .all()
    )
    events_data = [
        {
            "id": e.id,
            "event_id": e.event_id,
            "timestamp": e.timestamp.isoformat(),
            "severity": e.severity,
            "alert_type": e.alert_type,
            "title": e.title,
            "description": e.description,
            "snapshot_path": e.snapshot_path,
            "clip_path": e.clip_path,
        }
        for e in events
    ]

    active_pool_tracks = pipeline.tracker_pool.get_active_tracks()
    is_active = any(t.animal_id == animal_id for t in active_pool_tracks)

    return AnimalDetailResponse(
        animal_id=animal_id,
        species=db_track.species if db_track else pipeline._latest_stats.get("species", "chicken"),
        first_seen=db_track.first_seen if db_track else datetime.datetime.fromtimestamp(mem_track.first_seen),
        last_seen=db_track.last_seen if db_track else datetime.datetime.fromtimestamp(mem_track.last_seen),
        status=mem_track.status if mem_track else db_track.status,
        health_score=mem_track.health_score if mem_track else db_track.health_score,
        total_distance_px=mem_track.total_distance_px if mem_track else db_track.total_distance_px,
        total_idle_seconds=mem_track.total_idle_seconds if mem_track else db_track.total_idle_seconds,
        last_speed_norm=mem_track.last_speed_norm if mem_track else db_track.last_speed_norm,
        active=is_active,
        trail=trail_pts,
        speed_history=speed_hist,
        events=events_data,
    )

