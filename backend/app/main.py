import os
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from sqlalchemy import text
from backend.app.config import settings
from backend.app.db import init_db, SessionLocal
from backend.app.services.pipeline import pipeline
from backend.app.api.stream import router as stream_router
from backend.app.api.stats import router as stats_router
from backend.app.api.animals import router as animals_router
from backend.app.api.events import router as events_router
from backend.app.api.config_api import router as config_router
from backend.app.api.reports import router as reports_router
from backend.app.api.heatmap import router as heatmap_router
from backend.app.api.push import router as push_router
from backend.app.api.chat import router as chat_router
from backend.app.schemas import HealthCheckResponse

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
)
logger = logging.getLogger("chickcheck")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing ChickCheck database...")
    init_db()

    # Pass running event loop to pipeline for async SSE & alerts
    import asyncio
    pipeline.set_event_loop(asyncio.get_running_loop())

    logger.info(f"Starting pipeline on video source: {settings.VIDEO_SOURCE}...")
    pipeline.start()

    yield

    # Shutdown
    logger.info("Shutting down ChickCheck pipeline...")
    pipeline.stop()
    logger.info("ChickCheck shutdown complete.")


app = FastAPI(
    title="Khamar Prohori API",
    description="Khamar Prohori - Livestock behavioral monitoring, kinematic tracking, and intelligent AI anomaly detection system.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(stream_router)
app.include_router(stats_router)
app.include_router(animals_router)
app.include_router(events_router)
app.include_router(config_router)
app.include_router(reports_router)
app.include_router(heatmap_router)
app.include_router(push_router)
app.include_router(chat_router, prefix="/api/chat", tags=["chat"])

# Mount snapshots and clips static directory
os.makedirs(settings.DATA_DIR, exist_ok=True)
app.mount("/data", StaticFiles(directory=settings.DATA_DIR), name="data")


@app.get("/api/health", response_model=HealthCheckResponse, tags=["health"])
def health_check():
    """Returns system diagnostic, video source state, pipeline FPS, and DB connection status."""
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception as e:
        logger.warning(f"DB health check error: {e}")

    now = time.time()
    try:
        last_frame_age = now - pipeline.last_frame_time if (pipeline and pipeline.last_frame_time > 0) else 999.0
    except Exception:
        last_frame_age = 999.0

    try:
        tracked_count = len(pipeline.tracker_pool.get_active_tracks()) if (pipeline and pipeline.tracker_pool) else 0
    except Exception:
        tracked_count = 0

    try:
        source_type = "network_stream" if (pipeline and pipeline.source and pipeline.source.is_live) else "file_loop"
        source_status = pipeline.source_status if pipeline else "offline"
        pipeline_fps = round(pipeline.current_fps, 1) if pipeline else 0.0
        pipeline_running = pipeline.running if pipeline else False
    except Exception:
        source_type = "file_loop"
        source_status = "offline"
        pipeline_fps = 0.0
        pipeline_running = False

    overall_status = "healthy" if (pipeline_running and db_ok and last_frame_age < 15.0) else "degraded"

    return HealthCheckResponse(
        status=overall_status,
        pipeline_fps=pipeline_fps,
        last_frame_age_s=round(last_frame_age, 2),
        source_status=source_status,
        source_type=source_type,
        db_status="ok" if db_ok else "unreachable",
        species=settings.SPECIES,
        tracked_count=tracked_count,
    )


@app.get("/", tags=["root"])
def root():
    return {
        "app": "Khamar Prohori Livestock Monitoring System",
        "name_bn": "খামার প্রহরী",
        "species": settings.SPECIES,
        "disclaimer": "Movement-based behavioral screening signal only. Not a veterinary diagnosis.",
        "docs_url": "/docs",
    }
