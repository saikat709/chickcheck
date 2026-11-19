import datetime
from fastapi import APIRouter, HTTPException
from backend.app.config import settings, SPECIES_PROFILES, SENSITIVITY_PRESETS
from backend.app.schemas import ConfigResponse, ConfigUpdateRequest, TestNotificationResponse
from backend.app.services.pipeline import pipeline
from backend.app.analysis.anomalies import AnomalyDetector
from backend.app.alerts.channels.telegram import TelegramChannel
from backend.app.alerts.channels.webhook import WebhookChannel
from backend.app.alerts.channels.email import EmailChannel

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=ConfigResponse)
def get_config():
    """
    Returns non-sensitive configuration parameters, active thresholds, and channel statuses.
    Secrets are strictly masked.
    """
    active_t = settings.get_active_thresholds().model_dump()
    return ConfigResponse(
        project_name=settings.PROJECT_NAME,
        species=settings.SPECIES,
        available_species=list(SPECIES_PROFILES.keys()),
        sensitivity=settings.SENSITIVITY,
        sensitivity_presets=list(SENSITIVITY_PRESETS.keys()),
        process_every_n=settings.PROCESS_EVERY_N,
        infer_imgsz=settings.INFER_IMGSZ,
        conf_threshold=settings.CONF_THRESHOLD,
        quiet_hours_enabled=settings.QUIET_HOURS_ENABLED,
        quiet_hours_start=settings.QUIET_HOURS_START,
        quiet_hours_end=settings.QUIET_HOURS_END,
        telegram_enabled=settings.TELEGRAM_ENABLED,
        telegram_chat_id_set=bool(settings.TELEGRAM_CHAT_ID),
        webhook_enabled=settings.WEBHOOK_ENABLED,
        webhook_url_set=bool(settings.WEBHOOK_URL),
        smtp_enabled=settings.SMTP_ENABLED,
        smtp_host_set=bool(settings.SMTP_HOST),
        thresholds=active_t,
        enhance_low_res=settings.ENHANCE_LOW_RES,
        dense_crowd_mode=settings.DENSE_CROWD_MODE,
    )


@router.put("", response_model=ConfigResponse)
def update_config(req: ConfigUpdateRequest):
    """
    Updates runtime configuration (species, sensitivity, quiet hours, alert channels, thresholds, low-res enhancement).
    """
    if req.species is not None:
        species_clean = req.species.lower().strip()
        # Validate all requested species (supports comma-separated multi-species or "all")
        if species_clean != "all":
            parts = [s.strip() for s in species_clean.split(",") if s.strip()]
            for p in parts:
                if p not in SPECIES_PROFILES:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid species '{p}'. Choose from {list(SPECIES_PROFILES.keys())} or 'all'"
                    )
        settings.SPECIES = species_clean
        # Update pipeline detector classes and anomaly detector profile
        if pipeline.detector is not None:
            pipeline.detector._configure_classes()
        pipeline.anomaly_detector = AnomalyDetector(
            settings.get_active_thresholds(),
            settings.get_species_profile(),
        )

    if req.enhance_low_res is not None:
        settings.ENHANCE_LOW_RES = req.enhance_low_res

    if req.dense_crowd_mode is not None:
        settings.DENSE_CROWD_MODE = req.dense_crowd_mode

    if req.sensitivity is not None:
        sens_clean = req.sensitivity.lower().strip()
        if sens_clean not in SENSITIVITY_PRESETS:
            raise HTTPException(status_code=400, detail=f"Invalid sensitivity. Choose from {list(SENSITIVITY_PRESETS.keys())}")
        settings.SENSITIVITY = sens_clean
        if pipeline.anomaly_detector is not None:
            pipeline.anomaly_detector.thresholds = settings.get_active_thresholds()

    if req.quiet_hours_enabled is not None:
        settings.QUIET_HOURS_ENABLED = req.quiet_hours_enabled
    if req.quiet_hours_start is not None:
        settings.QUIET_HOURS_START = req.quiet_hours_start
    if req.quiet_hours_end is not None:
        settings.QUIET_HOURS_END = req.quiet_hours_end

    # Notification channels
    if req.telegram_enabled is not None:
        settings.TELEGRAM_ENABLED = req.telegram_enabled
    if req.telegram_bot_token is not None and req.telegram_bot_token.strip():
        settings.TELEGRAM_BOT_TOKEN = req.telegram_bot_token.strip()
    if req.telegram_chat_id is not None and req.telegram_chat_id.strip():
        settings.TELEGRAM_CHAT_ID = req.telegram_chat_id.strip()

    if req.webhook_enabled is not None:
        settings.WEBHOOK_ENABLED = req.webhook_enabled
    if req.webhook_url is not None and req.webhook_url.strip():
        settings.WEBHOOK_URL = req.webhook_url.strip()
    if req.webhook_secret is not None and req.webhook_secret.strip():
        settings.WEBHOOK_SECRET = req.webhook_secret.strip()

    if req.smtp_enabled is not None:
        settings.SMTP_ENABLED = req.smtp_enabled
    if req.smtp_host is not None and req.smtp_host.strip():
        settings.SMTP_HOST = req.smtp_host.strip()
    if req.smtp_port is not None:
        settings.SMTP_PORT = req.smtp_port
    if req.smtp_user is not None and req.smtp_user.strip():
        settings.SMTP_USER = req.smtp_user.strip()
    if req.smtp_password is not None and req.smtp_password.strip():
        settings.SMTP_PASSWORD = req.smtp_password.strip()
    if req.smtp_from is not None and req.smtp_from.strip():
        settings.SMTP_FROM = req.smtp_from.strip()
    if req.smtp_to is not None and req.smtp_to.strip():
        settings.SMTP_TO = req.smtp_to.strip()
    if req.smtp_tls is not None:
        settings.SMTP_TLS = req.smtp_tls

    if req.thresholds:
        for k, v in req.thresholds.items():
            if hasattr(settings.thresholds, k):
                setattr(settings.thresholds, k, v)
        if pipeline.anomaly_detector is not None:
            pipeline.anomaly_detector.thresholds = settings.get_active_thresholds()

    return get_config()


@router.post("/test-notification", response_model=TestNotificationResponse)
async def test_notifications():
    """
    Triggers an immediate end-to-end test dispatch to all configured channels.
    Returns per-channel delivery status.
    """
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    title = "Test Notification from ChickCheck"
    desc = f"Verification dispatch triggered from dashboard at {ts}. All notification channels operational."

    # Telegram test
    tg_res = {"enabled": settings.TELEGRAM_ENABLED}
    if settings.TELEGRAM_ENABLED and settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
        tg_res = await TelegramChannel.send_alert(
            bot_token=settings.TELEGRAM_BOT_TOKEN,
            chat_id=settings.TELEGRAM_CHAT_ID,
            title=title,
            description=desc,
            severity="info",
            snapshot_bytes=None,
        )

    # Webhook test
    wh_res = {"enabled": settings.WEBHOOK_ENABLED}
    if settings.WEBHOOK_ENABLED and settings.WEBHOOK_URL:
        wh_res = await WebhookChannel.send_alert(
            url=settings.WEBHOOK_URL,
            secret=settings.WEBHOOK_SECRET,
            payload={
                "event": "test_notification",
                "timestamp": ts,
                "species": settings.SPECIES,
                "message": desc,
            },
        )

    # Email test
    em_res = {"enabled": settings.SMTP_ENABLED}
    if settings.SMTP_ENABLED and settings.SMTP_HOST and settings.SMTP_TO:
        em_res = await EmailChannel.send_alert(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            user=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            from_addr=settings.SMTP_FROM or "chickcheck@local",
            to_addr=settings.SMTP_TO,
            use_tls=settings.SMTP_TLS,
            subject="[ChickCheck Test] Operational Verification",
            body_text=desc,
            snapshot_bytes=None,
        )

    # Web push test: every subscribed device, regardless of its severity preference
    from backend.app.alerts.channels.webpush import WebPushChannel

    wp_res = await WebPushChannel.dispatch(
        {"event_id": "chickcheck-test", "severity": "info", "title": title, "description": desc, "timestamp": ts},
        ignore_preferences=True,
    )

    return TestNotificationResponse(
        telegram=tg_res,
        webhook=wh_res,
        email=em_res,
        webpush=wp_res,
    )

