import os
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class SpeciesProfile(BaseModel):
    name: str
    coco_class_id: int
    coco_class_name: str
    nominal_aspect_ratio: float  # width / height
    nominal_speed_norm_min: float  # normalized body lengths / sec
    nominal_speed_norm_max: float
    typical_dispersion: float  # average normalized distance to centroid
    description: str


SPECIES_PROFILES: Dict[str, SpeciesProfile] = {
    "chicken": SpeciesProfile(
        name="chicken",
        coco_class_id=14,  # COCO "bird"
        coco_class_name="bird",
        nominal_aspect_ratio=1.05,
        nominal_speed_norm_min=0.08,
        nominal_speed_norm_max=0.85,
        typical_dispersion=3.5,
        description="Chickens: active foraging, rapid pecking and heading turns, moderate flock grouping",
    ),
    "duck": SpeciesProfile(
        name="duck",
        coco_class_id=14,  # COCO "bird"
        coco_class_name="bird",
        nominal_aspect_ratio=1.12,
        nominal_speed_norm_min=0.06,
        nominal_speed_norm_max=0.75,
        typical_dispersion=2.8,
        description="Ducks: waddling gait, strong flock cohesion, coordinated movement",
    ),
    "cow": SpeciesProfile(
        name="cow",
        coco_class_id=19,  # COCO "cow"
        coco_class_name="cow",
        nominal_aspect_ratio=1.45,
        nominal_speed_norm_min=0.02,
        nominal_speed_norm_max=0.35,
        typical_dispersion=4.5,
        description="Cows: deliberate slow walking, grazing, lying down during rumination",
    ),
    "sheep": SpeciesProfile(
        name="sheep",
        coco_class_id=18,  # COCO "sheep"
        coco_class_name="sheep",
        nominal_aspect_ratio=1.25,
        nominal_speed_norm_min=0.04,
        nominal_speed_norm_max=0.50,
        typical_dispersion=2.2,
        description="Sheep: very high flock cohesion, sudden collective flocking movements",
    ),
    "goat": SpeciesProfile(
        name="goat",
        coco_class_id=18,  # COCO "sheep" (closest COCO proxy)
        coco_class_name="sheep",
        nominal_aspect_ratio=1.20,
        nominal_speed_norm_min=0.05,
        nominal_speed_norm_max=0.65,
        typical_dispersion=4.0,
        description="Goats: agile, curious, higher dispersion and climbing postures",
    ),
}

# COCO Class to Species reverse map
COCO_CLASS_TO_SPECIES: Dict[int, str] = {
    14: "chicken",  # Default bird -> chicken (or duck if configured)
    18: "sheep",    # sheep/goat
    19: "cow",
}

# Sensitivity multipliers: adjustments applied to thresholds
SENSITIVITY_PRESETS = {
    "low": {
        "multiplier": 1.4,  # wider bounds, fewer alerts
        "confidence_threshold": 0.35,
        "cooldown_s": 420.0,
    },
    "normal": {
        "multiplier": 1.0,  # balanced
        "confidence_threshold": 0.25,
        "cooldown_s": 300.0,
    },
    "high": {
        "multiplier": 0.75,  # tighter bounds, earlier warnings
        "confidence_threshold": 0.20,
        "cooldown_s": 180.0,
    },
}


class ThresholdSettings(BaseModel):
    inactivity_threshold_s: float = 120.0
    inactivity_speed_norm: float = 0.05
    sudden_stop_speed_drop: float = 0.60
    fallen_aspect_ratio_delta: float = 0.35
    isolation_body_lengths: float = 4.0
    isolation_seconds: float = 20.0
    erratic_speed_multiplier: float = 2.5
    erratic_dir_changes: float = 0.50
    crowding_density_threshold: float = 0.0015
    dense_crowd_cluster_dist_bl: float = 1.8  # Cluster distance threshold in body lengths
    dense_crowd_min_cluster_size: int = 4     # Min animals in dense cluster
    count_drop_ratio: float = 0.30
    low_activity_zscore: float = -1.8
    limping_jitter_ratio: float = 2.0
    feeding_deviation_zscore: float = -2.0


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "ChickCheck"
    # SPECIES can be single ("chicken") or multi ("chicken,duck" or "all")
    SPECIES: str = "chicken"
    VIDEO_SOURCE: str = "samples/dummy.mp4"

    # Vision & Model
    MODEL_WEIGHTS: str = "yolo11m.pt"  # yolo11n finds ~0 chicks; see README "Choosing a model"
    CUSTOM_WEIGHTS_PATH: Optional[str] = None
    CUSTOM_CLASS_NAMES: Optional[str] = None  # Comma-separated or single class
    HEALTH_CLASSIFIER_PATH: Optional[str] = None
    PROCESS_EVERY_N: int = 2
    INFER_IMGSZ: int = 640
    CONF_THRESHOLD: float = 0.25
    DEVICE: Optional[str] = None  # None for auto-detect (cuda if available else cpu)
    TRACK_LOST_SECONDS: float = 2.5
    MAX_TRAIL_POINTS: int = 30

    # Low-Resolution & High-Density Enhancements
    ENHANCE_LOW_RES: bool = True
    LOW_RES_MAX_DIM: int = 540
    CLAHE_CLIP_LIMIT: float = 2.5
    SHARPEN_FACTOR: float = 0.4
    ADAPTIVE_CONF_SCALING: bool = True
    ADAPTIVE_CONF_FLOOR: float = 0.10  # adaptive scaling never lowers confidence below this
    # Extra COCO classes that stock COCO models often output for top-down chicks (poultry only)
    POULTRY_PROXY_CLASSES: str = "sheep,teddy bear"
    # Experimental colour-blob detector for poultry. OFF by default: it boxes walls/feeders on wide shots.
    POULTRY_COLOR_FUSION: bool = False
    MIN_BOX_FRACTION: float = 0.01  # min box side as a fraction of the frame's short side (floor 6 px)
    MAX_BOX_AREA_FRACTION: float = 0.30  # drop boxes larger than this share of the frame
    DENSE_CROWD_MODE: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./data/chickcheck.db"

    # Storage paths
    DATA_DIR: str = "./data"
    SNAPSHOTS_DIR: str = "./data/snapshots"
    CLIPS_DIR: str = "./data/clips"
    REPORTS_DIR: str = "./data/reports"
    RETENTION_DAYS: int = 7
    DAILY_REPORT_HOUR: int = 8

    # Sensitivity & Quiet Hours
    SENSITIVITY: str = "normal"
    QUIET_HOURS_ENABLED: bool = False
    QUIET_HOURS_START: int = 22
    QUIET_HOURS_END: int = 6

    # Notification Channels
    TELEGRAM_ENABLED: bool = False
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None

    WEBHOOK_ENABLED: bool = False
    WEBHOOK_URL: Optional[str] = None
    WEBHOOK_SECRET: Optional[str] = None

    SMTP_ENABLED: bool = False
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_TO: Optional[str] = None
    SMTP_TLS: bool = True

    # Web Push (VAPID). Generate with scripts/generate_vapid_keys.py.
    # The private key is used only server-side and is never returned by the API.
    WEBPUSH_ENABLED: bool = True
    VAPID_PUBLIC_KEY: Optional[str] = None
    VAPID_PRIVATE_KEY: Optional[str] = None
    VAPID_SUBJECT: str = "mailto:alerts@farm.local"
    # Push endpoints must belong to these services (blocks SSRF via crafted subscriptions).
    WEBPUSH_ALLOWED_HOSTS: str = "fcm.googleapis.com,push.services.mozilla.com,push.apple.com,notify.windows.com"

    # Threshold overrides (optional custom values)
    thresholds: ThresholdSettings = Field(default_factory=ThresholdSettings)

    def get_active_species_list(self) -> List[str]:
        raw = self.SPECIES.lower().strip()
        if raw in ["all", "mixed"]:
            return list(SPECIES_PROFILES.keys())

        parts = [p.strip() for p in raw.split(",") if p.strip()]
        valid = [p for p in parts if p in SPECIES_PROFILES]
        return valid if valid else ["chicken"]

    def get_species_profile(self, species_name: Optional[str] = None) -> SpeciesProfile:
        if species_name:
            species_key = species_name.lower().strip()
            if species_key in SPECIES_PROFILES:
                return SPECIES_PROFILES[species_key]

        active_list = self.get_active_species_list()
        primary_key = active_list[0] if active_list else "chicken"
        return SPECIES_PROFILES.get(primary_key, SPECIES_PROFILES["chicken"])

    def get_active_thresholds(self, species_name: Optional[str] = None) -> ThresholdSettings:
        profile = self.get_species_profile(species_name)
        preset = SENSITIVITY_PRESETS.get(self.SENSITIVITY.lower(), SENSITIVITY_PRESETS["normal"])
        mult = preset["multiplier"]

        # Base adjusted by species and sensitivity
        t = self.thresholds.model_copy()
        t.inactivity_threshold_s = max(30.0, t.inactivity_threshold_s * mult)
        t.inactivity_speed_norm = max(0.01, profile.nominal_speed_norm_min * 0.5 * (1.0 / mult))
        t.isolation_body_lengths = max(2.0, profile.typical_dispersion * mult)
        t.isolation_seconds = max(10.0, t.isolation_seconds * mult)
        t.erratic_speed_multiplier = max(1.5, profile.nominal_speed_norm_max * 3.0 * mult)
        return t


settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)
os.makedirs(settings.CLIPS_DIR, exist_ok=True)
os.makedirs(settings.REPORTS_DIR, exist_ok=True)
