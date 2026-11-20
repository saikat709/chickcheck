"""Docs & Pitch Deck API Router with Access Control & Live System Sync."""

import os
import json
import time
import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field

from backend.app.config import settings
from backend.app.services.pipeline import pipeline
from backend.app.db import SessionLocal
from backend.app.models import AlertEventRecord, AnimalTrack

router = APIRouter()

DOCS_CONFIG_FILE = os.path.join(settings.DATA_DIR, "docs_config.json")
DEFAULT_ADMIN_PIN = "khamar2026"

DEFAULT_TEAM = [
    {
        "id": "1",
        "name": "Md. Saikat Islam",
        "role": "Full-Stack & Systems Architect",
        "email": "saikatislam709@gmail.com",
        "image": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=face",
        "bio": "Specializes in high-performance computer vision pipelines, distributed backends, and edge AI orchestration."
    },
    {
        "id": "2",
        "name": "Tukabbir Hossain Sadi",
        "role": "Frontend Lead & UI/UX Specialist",
        "email": "tukabbirhossainsadi@gmail.com",
        "image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face",
        "bio": "Expert in offline-first progressive web apps (PWA), real-time SSE streaming, and farm-friendly accessible interfaces."
    },
    {
        "id": "3",
        "name": "Ayon",
        "role": "AI & Machine Learning Engineer",
        "email": "ayon@khamarprohori.com",
        "image": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face",
        "bio": "Focuses on YOLO11 kinematic modeling, optical flow algorithms, and Fireworks AI RAG knowledge integration."
    },
    {
        "id": "4",
        "name": "Fayroz Tasnim",
        "role": "Product Strategist & Domain Researcher",
        "email": "fayroztasnim@khamarprohori.com",
        "image": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop&crop=face",
        "bio": "Leads domain veterinary research, user experience validation with poultry farmers, and product growth strategy."
    }
]

DEFAULT_CONFIG = {
    "is_enabled": True,
    "schedule_enabled": True,
    "start_date": "2026-06-10T00:00:00Z",
    "end_date": "2026-06-14T23:59:59Z",
    "admin_pin": DEFAULT_ADMIN_PIN,
    "team_name": "Khamar Prohori Core Team",
    "team_members": DEFAULT_TEAM,
    "override_active": False,
    "updated_at": datetime.datetime.utcnow().isoformat()
}


def load_docs_config() -> Dict[str, Any]:
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    if not os.path.exists(DOCS_CONFIG_FILE):
        with open(DOCS_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        return dict(DEFAULT_CONFIG)
    try:
        with open(DOCS_CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure required keys exist
            for k, v in DEFAULT_CONFIG.items():
                if k not in data:
                    data[k] = v
            return data
    except Exception:
        return dict(DEFAULT_CONFIG)


def save_docs_config(data: Dict[str, Any]) -> None:
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    data["updated_at"] = datetime.datetime.utcnow().isoformat()
    with open(DOCS_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def is_docs_accessible(config: Dict[str, Any], admin_authorized: bool = False) -> Dict[str, Any]:
    """Check if docs is currently public based on visibility and schedule."""
    if admin_authorized or config.get("override_active"):
        return {"accessible": True, "reason": "admin_override", "is_admin": admin_authorized}

    if not config.get("is_enabled", True):
        return {"accessible": False, "reason": "disabled_by_admin", "is_admin": False}

    if not config.get("schedule_enabled", True):
        return {"accessible": True, "reason": "public_always", "is_admin": False}

    now_iso = datetime.datetime.utcnow().isoformat()
    start_date = config.get("start_date", "2026-06-10T00:00:00Z")
    end_date = config.get("end_date", "2026-06-14T23:59:59Z")

    if start_date <= now_iso <= end_date:
        return {"accessible": True, "reason": "within_schedule", "is_admin": False}

    if now_iso < start_date:
        return {
            "accessible": False,
            "reason": "scheduled_future",
            "start_date": start_date,
            "end_date": end_date,
            "is_admin": False,
        }
    else:
        return {
            "accessible": False,
            "reason": "schedule_expired",
            "start_date": start_date,
            "end_date": end_date,
            "is_admin": False,
        }


class TeamMemberModel(BaseModel):
    id: str
    name: str
    role: str
    email: str
    image: Optional[str] = None
    bio: Optional[str] = None


class DocsConfigUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    schedule_enabled: Optional[bool] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    admin_pin: Optional[str] = None
    team_name: Optional[str] = None
    team_members: Optional[List[TeamMemberModel]] = None
    override_active: Optional[bool] = None


class VerifyPinRequest(BaseModel):
    pin: str


@router.get("/status")
def get_docs_status(x_admin_pin: Optional[str] = Header(None)):
    """Check current public availability and access window."""
    config = load_docs_config()
    is_admin = x_admin_pin is not None and x_admin_pin == config.get("admin_pin", DEFAULT_ADMIN_PIN)
    access_info = is_docs_accessible(config, admin_authorized=is_admin)

    return {
        "accessible": access_info["accessible"],
        "reason": access_info["reason"],
        "is_admin": is_admin,
        "is_enabled": config.get("is_enabled", True),
        "schedule_enabled": config.get("schedule_enabled", True),
        "start_date": config.get("start_date"),
        "end_date": config.get("end_date"),
        "override_active": config.get("override_active", False),
        "team_name": config.get("team_name"),
        "team_members": config.get("team_members", DEFAULT_TEAM),
    }


@router.post("/verify-pin")
def verify_admin_pin(req: VerifyPinRequest):
    """Verify administrator PIN."""
    config = load_docs_config()
    expected = config.get("admin_pin", DEFAULT_ADMIN_PIN)
    if req.pin == expected:
        return {"valid": True, "message": "Admin authorization granted."}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin PIN.")


@router.post("/config")
def update_docs_config(req: DocsConfigUpdate, x_admin_pin: Optional[str] = Header(None)):
    """Update visibility, schedule, and team information (Admin only)."""
    config = load_docs_config()
    expected = config.get("admin_pin", DEFAULT_ADMIN_PIN)
    if x_admin_pin != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized admin PIN required.")

    if req.is_enabled is not None:
        config["is_enabled"] = req.is_enabled
    if req.schedule_enabled is not None:
        config["schedule_enabled"] = req.schedule_enabled
    if req.start_date is not None:
        config["start_date"] = req.start_date
    if req.end_date is not None:
        config["end_date"] = req.end_date
    if req.admin_pin is not None and len(req.admin_pin.strip()) >= 4:
        config["admin_pin"] = req.admin_pin.strip()
    if req.team_name is not None:
        config["team_name"] = req.team_name
    if req.team_members is not None:
        config["team_members"] = [m.model_dump() for m in req.team_members]
    if req.override_active is not None:
        config["override_active"] = req.override_active

    save_docs_config(config)
    return {"status": "success", "config": config}


@router.get("/live-data")
def get_live_system_data():
    """Live synced data feed from pipeline, database, and system state for docs view."""
    stats = pipeline.get_latest_stats() if pipeline else {}

    alert_count = 0
    active_tracks_count = 0
    try:
        with SessionLocal() as db:
            alert_count = db.query(AlertEventRecord).count()
            active_tracks_count = db.query(AnimalTrack).filter(AnimalTrack.active == True).count()
    except Exception:
        pass

    return {
        "flock": {
            "species": settings.SPECIES,
            "count": stats.get("count", 0),
            "active_count": stats.get("active_count", 0),
            "idle_count": stats.get("idle_count", 0),
            "flock_health_score": round(stats.get("flock_health_score", 100.0), 1),
            "status": stats.get("status", "healthy"),
            "activity_index": round(stats.get("activity_index", 50.0), 1),
            "fps": round(stats.get("fps", 0.0), 1),
            "is_enhanced": stats.get("is_enhanced", True),
            "total_lifetime_alerts": alert_count,
            "active_tracks_count": active_tracks_count,
        },
        "engine": {
            "model_weights": settings.MODEL_WEIGHTS,
            "infer_imgsz": settings.INFER_IMGSZ,
            "conf_threshold": settings.CONF_THRESHOLD,
            "process_every_n": settings.PROCESS_EVERY_N,
            "optical_flow": "Dense Farnebäck (8x8 Grid)",
            "rate_limiter": "Sliding Window (15/min, 120/hr)",
            "rag_provider": "Fireworks AI (gpt-oss-120b)",
            "backend_framework": "FastAPI + PyTorch",
            "frontend_framework": "Next.js 14 App Router + Serwist PWA",
        },
        "features": [
            {"name": "Whole-Flock Activity Tracking", "status": "Live & Verified", "category": "Vision"},
            {"name": "Thermal Stress Huddling Detection", "status": "Live & Verified", "category": "Vision"},
            {"name": "Immobile / Moribund Bird Screening", "status": "Live & Verified", "category": "Vision"},
            {"name": "Dense Optical Flow Energy Index", "status": "Live & Verified", "category": "Kinematics"},
            {"name": "Sohayok AI Bilingual Veterinary RAG", "status": "Live & Verified", "category": "AI Co-Pilot"},
            {"name": "Automated 10s Video Incident Export", "status": "Live & Verified", "category": "Alerts"},
            {"name": "Multi-Channel Alerts (Web Push & Telegram)", "status": "Live & Verified", "category": "Alerts"},
            {"name": "Offline-First PWA & Serwist Service Worker", "status": "Live & Verified", "category": "Platform"},
            {"name": "Acoustic Cough / Distress Audio Analysis", "status": "Planned (Q3 2026)", "category": "Hardware"},
            {"name": "Multi-Camera Shed Stitching & 3D Depth", "status": "Planned (Q4 2026)", "category": "Vision"},
        ]
    }
