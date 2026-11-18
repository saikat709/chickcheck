import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class AnimalTrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    animal_id: int
    species: str
    first_seen: datetime.datetime
    last_seen: datetime.datetime
    status: str  # healthy, watch, alert
    health_score: float
    total_distance_px: float
    total_idle_seconds: float
    last_speed_norm: float
    active: bool


class AnimalDetailResponse(AnimalTrackResponse):
    trail: List[List[float]] = []  # [[x, y], ...]
    speed_history: List[Dict[str, Any]] = []
    events: List[Dict[str, Any]] = []


class LiveStatsResponse(BaseModel):
    species: str
    count: int
    active_count: int
    idle_count: int
    activity_index: float
    flock_health_score: float
    dispersion: float
    crowding_index: float
    mean_speed_norm: float
    status: str
    fps: float
    timestamp: float
    source_status: str
    species_counts: Dict[str, int] = {}
    max_cluster_size: int = 0
    is_enhanced: bool = False
    density_count: Optional[int] = None
    uncertainty: Optional[int] = 0
    count_min: Optional[int] = None
    count_max: Optional[int] = None
    density_regime: Optional[str] = "sparse_box"
    density_method: Optional[str] = "box_tracking"
    optical_flow_activity: Optional[float] = None
    zone_occupancy: Optional[Dict[str, float]] = None


class HistoryPoint(BaseModel):
    timestamp: datetime.datetime
    count: int
    activity_index: float
    flock_health_score: float
    mean_speed_norm: float
    status: str


class HistoryResponse(BaseModel):
    range: str
    points: List[HistoryPoint]


class AlertEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: str
    timestamp: datetime.datetime
    species: str
    animal_id: Optional[int]
    severity: str
    alert_type: str
    title: str
    description: str
    confidence: float
    snapshot_path: Optional[str]
    clip_path: Optional[str]
    acknowledged: bool
    acknowledged_at: Optional[datetime.datetime]
    feedback: Optional[str] = None
    feedback_notes: Optional[str] = None
    feedback_at: Optional[datetime.datetime] = None


class AlertFeedbackRequest(BaseModel):
    feedback: str = Field(..., description="'correct' or 'false_alarm'")
    notes: Optional[str] = None


class ConfigResponse(BaseModel):
    project_name: str
    species: str
    available_species: List[str]
    sensitivity: str
    sensitivity_presets: List[str]
    process_every_n: int
    infer_imgsz: int
    conf_threshold: float
    quiet_hours_enabled: bool
    quiet_hours_start: int
    quiet_hours_end: int
    telegram_enabled: bool
    telegram_chat_id_set: bool
    webhook_enabled: bool
    webhook_url_set: bool
    smtp_enabled: bool
    smtp_host_set: bool
    thresholds: Dict[str, float]
    enhance_low_res: bool = True
    dense_crowd_mode: bool = True


class ConfigUpdateRequest(BaseModel):
    species: Optional[str] = None
    enhance_low_res: Optional[bool] = None
    dense_crowd_mode: Optional[bool] = None
    sensitivity: Optional[str] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None
    telegram_enabled: Optional[bool] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    webhook_enabled: Optional[bool] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    smtp_enabled: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_to: Optional[str] = None
    smtp_tls: Optional[bool] = None
    thresholds: Optional[Dict[str, float]] = None


class TestNotificationResponse(BaseModel):
    telegram: Dict[str, Any]
    webhook: Dict[str, Any]
    email: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    status: str
    pipeline_fps: float
    last_frame_age_s: float
    source_status: str
    source_type: str
    db_status: str
    species: str
    tracked_count: int

