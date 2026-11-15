from typing import List, Tuple, Optional, Dict, Any
from backend.app.vision.tracker_state import AnimalTrackState

DISCLAIMER: str = (
    "Movement-based behavioral screening signal only. "
    "Not a clinical veterinary diagnosis or definitive medical assessment."
)

ANOMALY_SEVERITY_DEDUCTIONS = {
    "fallen_posture": 40.0,
    "prolonged_inactivity": 25.0,
    "sudden_stop": 20.0,
    "limping_gait": 15.0,
    "isolation": 12.0,
    "panic_movement": 15.0,
}


def compute_animal_health_score(
    track: AnimalTrackState,
    classifier_healthy_prob: Optional[float] = None,
) -> Tuple[float, str]:
    """
    Computes an individual animal's health index (0-100) based on kinematic behavior,
    postural stability, and active anomaly conditions.
    """
    score = 100.0

    # Deduct points for active behavioral anomalies
    for anomaly in track.active_anomalies:
        deduction = ANOMALY_SEVERITY_DEDUCTIONS.get(anomaly, 10.0)
        score -= deduction

    # Idle time penalty if prolonged but under threshold
    if track.current_idle_seconds > 60.0 and "prolonged_inactivity" not in track.active_anomalies:
        score -= min(15.0, (track.current_idle_seconds - 60.0) / 10.0)

    # Posture instability penalty
    if track.current_aspect_ratio_shift > 0.20 and "fallen_posture" not in track.active_anomalies:
        score -= min(15.0, track.current_aspect_ratio_shift * 30.0)

    # Fold in optional classifier probability if available
    if classifier_healthy_prob is not None:
        cls_score = float(classifier_healthy_prob * 100.0)
        # 70% rule-based behavioral observation, 30% image classifier inference
        score = 0.70 * score + 0.30 * cls_score

    score = max(0.0, min(100.0, score))

    if score >= 75.0:
        status = "healthy"
    elif score >= 50.0:
        status = "watch"
    else:
        status = "alert"

    track.health_score = round(score, 1)
    track.status = status
    return track.health_score, track.status


def compute_flock_health_score(
    tracks: List[AnimalTrackState],
    flock_metrics: Dict[str, Any],
    active_flock_anomalies: List[str],
) -> Tuple[float, str]:
    """
    Computes aggregate flock health score (0-100) combining individual animal health
    and flock-level systemic stressors.
    """
    if not tracks:
        return 100.0, "healthy"

    # Base: mean of individual animal health scores
    scores = [t.health_score for t in tracks]
    mean_animal_score = float(sum(scores) / len(scores))
    flock_score = mean_animal_score

    # Penalties for systemic flock anomalies
    if "count_drop" in active_flock_anomalies:
        flock_score -= 30.0
    if "panic_movement" in active_flock_anomalies:
        flock_score -= 20.0
    if "crowding_huddling" in active_flock_anomalies:
        flock_score -= 15.0
    if "low_flock_activity" in active_flock_anomalies:
        flock_score -= 10.0
    if "feeding_deviation" in active_flock_anomalies:
        flock_score -= 10.0

    flock_score = max(0.0, min(100.0, flock_score))

    if flock_score >= 75.0:
        status = "healthy"
    elif flock_score >= 50.0:
        status = "watch"
    else:
        status = "alert"

    return round(flock_score, 1), status

