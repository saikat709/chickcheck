import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    Index,
)
from backend.app.db import Base


class AnimalTrack(Base):
    __tablename__ = "animal_tracks"

    id = Column(Integer, primary_key=True, index=True)
    animal_id = Column(Integer, unique=True, index=True, nullable=False)
    species = Column(String(50), nullable=False, default="chicken")
    first_seen = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    status = Column(String(20), default="healthy", nullable=False)  # healthy, watch, alert
    health_score = Column(Float, default=100.0, nullable=False)
    total_distance_px = Column(Float, default=0.0)
    total_idle_seconds = Column(Float, default=0.0)
    last_speed_norm = Column(Float, default=0.0)
    active = Column(Boolean, default=True)

    __table_args__ = (
        Index("ix_animal_species_status", "species", "status"),
    )


class AnimalMetricSnapshot(Base):
    __tablename__ = "animal_metric_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True, nullable=False)
    animal_id = Column(Integer, index=True, nullable=False)
    centroid_x = Column(Float, nullable=False)
    centroid_y = Column(Float, nullable=False)
    speed_px_s = Column(Float, default=0.0)
    speed_norm = Column(Float, default=0.0)
    aspect_ratio = Column(Float, default=1.0)
    health_score = Column(Float, default=100.0)
    status = Column(String(20), default="healthy")


class FlockMetric(Base):
    __tablename__ = "flock_metrics"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True, nullable=False)
    species = Column(String(50), nullable=False, default="chicken")
    count = Column(Integer, default=0, nullable=False)
    active_count = Column(Integer, default=0, nullable=False)
    idle_count = Column(Integer, default=0, nullable=False)
    mean_speed_norm = Column(Float, default=0.0)
    activity_index = Column(Float, default=0.0)  # 0 to 100
    dispersion = Column(Float, default=0.0)
    crowding_index = Column(Float, default=0.0)
    flock_health_score = Column(Float, default=100.0)
    status = Column(String(20), default="healthy")  # healthy, watch, alert
    fps = Column(Float, default=0.0)


class AlertEventRecord(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True, nullable=False)
    species = Column(String(50), default="chicken", nullable=False)
    animal_id = Column(Integer, nullable=True, index=True)  # None if flock-level
    severity = Column(String(20), default="warning", index=True)  # info, warning, critical
    alert_type = Column(String(50), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    confidence = Column(Float, default=1.0)
    snapshot_path = Column(String(512), nullable=True)
    clip_path = Column(String(512), nullable=True)
    acknowledged = Column(Boolean, default=False, index=True)
    acknowledged_at = Column(DateTime, nullable=True)


class HourlyBaselineRecord(Base):
    __tablename__ = "hourly_baselines"

    id = Column(Integer, primary_key=True, index=True)
    hour_of_day = Column(Integer, nullable=False)  # 0-23
    species = Column(String(50), nullable=False)
    sample_count = Column(Integer, default=0)
    mean_activity = Column(Float, default=50.0)
    std_activity = Column(Float, default=15.0)
    median_activity = Column(Float, default=50.0)
    mad_activity = Column(Float, default=10.0)
    mean_speed = Column(Float, default=0.2)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        Index("ix_baseline_species_hour", "species", "hour_of_day", unique=True),
    )


class DailyReportRecord(Base):
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(String(10), unique=True, index=True, nullable=False)  # YYYY-MM-DD
    species = Column(String(50), nullable=False)
    summary_json = Column(Text, nullable=False)
    pdf_path = Column(String(512), nullable=True)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)

