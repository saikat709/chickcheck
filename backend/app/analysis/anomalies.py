import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import numpy as np
from backend.app.config import ThresholdSettings, SpeciesProfile, SPECIES_PROFILES
from backend.app.vision.tracker_state import AnimalTrackState
from backend.app.analysis.baseline import BaselineEngine


class AnomalyFinding(BaseModel):
    rule_name: str
    animal_id: Optional[int] = None
    severity: str  # "info", "warning", "critical"
    title: str
    description: str
    confidence: float = 1.0
    metadata: Dict[str, Any] = {}


class AnomalyDetector:
    """
    Evaluates 10 real biological and kinematic anomaly rules across individual
    tracked animals and aggregate flock behavior.
    """

    def __init__(self, thresholds: ThresholdSettings, profile: SpeciesProfile):
        self.thresholds = thresholds
        self.profile = profile
        self.recent_counts: List[int] = []
        self.recent_flock_activities: List[float] = []

    def evaluate(
        self,
        current_time: float,
        tracks: List[AnimalTrackState],
        flock_metrics: Dict[str, Any],
        baseline_data: Dict[str, Any],
        current_hour: Optional[int] = None,
    ) -> List[AnomalyFinding]:
        findings: List[AnomalyFinding] = []
        if current_hour is None:
            current_hour = datetime.datetime.utcnow().hour

        count = len(tracks)
        # Update rolling count history (last 60 samples ~ 30-60s)
        self.recent_counts.append(count)
        if len(self.recent_counts) > 60:
            self.recent_counts.pop(0)

        # Clear per-animal active anomalies for fresh evaluation
        for t in tracks:
            t.active_anomalies.clear()

        if count == 0:
            return findings

        # Precompute herd medians for relative comparisons
        herd_speeds = [t.last_speed_norm for t in tracks]
        median_herd_speed = float(np.median(herd_speeds)) if herd_speeds else 0.1
        herd_jitters = [t.bbox_jitter_ratio for t in tracks]
        median_herd_jitter = float(np.median(herd_jitters)) if herd_jitters else 0.05

        flock_center = flock_metrics.get("centroid", (960.0, 540.0))
        mean_diag = float(np.mean([t.last_diag for t in tracks])) if tracks else 100.0

        # --- Rule 1: Prolonged Inactivity ---
        # Animal below speed threshold for > N minutes (or seconds) while others are active
        active_ratio = flock_metrics.get("active_count", 0) / max(1, count)
        for t in tracks:
            if (
                t.current_idle_seconds >= self.thresholds.inactivity_threshold_s
                and active_ratio >= 0.25
            ):
                t.active_anomalies.add("prolonged_inactivity")
                sev = "critical" if t.current_idle_seconds >= (self.thresholds.inactivity_threshold_s * 2.0) else "warning"
                idle_mins = round(t.current_idle_seconds / 60.0, 1)
                findings.append(
                    AnomalyFinding(
                        rule_name="prolonged_inactivity",
                        animal_id=t.animal_id,
                        severity=sev,
                        title=f"Prolonged Inactivity (Animal #{t.animal_id})",
                        description=f"Animal #{t.animal_id} has remained immobile for {idle_mins} min while the flock is active.",
                        confidence=min(1.0, 0.7 + (t.current_idle_seconds / 300.0)),
                        metadata={"idle_seconds": round(t.current_idle_seconds, 1)},
                    )
                )

        # --- Rule 2: Sudden Stop ---
        # High speed followed immediately by collapse in speed and posture change
        for t in tracks:
            prof = SPECIES_PROFILES.get(t.species, self.profile) if t.species else self.profile
            if len(t.history) >= 8:
                past_speeds = [h[6] for h in list(t.history)[-8:-2]]
                max_past = max(past_speeds) if past_speeds else 0.0
                curr_speed = t.last_speed_norm
                speed_drop = max_past - curr_speed

                if (
                    max_past > (prof.nominal_speed_norm_min * 2.0)
                    and speed_drop >= (self.thresholds.sudden_stop_speed_drop * 0.5)
                    and curr_speed < 0.08
                    and t.current_aspect_ratio_shift > 0.15
                ):
                    t.active_anomalies.add("sudden_stop")
                    findings.append(
                        AnomalyFinding(
                            rule_name="sudden_stop",
                            animal_id=t.animal_id,
                            severity="warning",
                            title=f"Sudden Movement Collapse (Animal #{t.animal_id})",
                            description=f"Animal #{t.animal_id} ({t.species}) experienced abrupt cessation of motion and posture shift.",
                            confidence=0.85,
                            metadata={"prior_speed": round(max_past, 2), "curr_speed": round(curr_speed, 2), "species": t.species},
                        )
                    )

        # --- Rule 3: Fallen / Lying Posture Shift ---
        # Persistent aspect-ratio shift vs. that animal's own baseline
        for t in tracks:
            shift = t.current_aspect_ratio_shift
            if shift >= self.thresholds.fallen_aspect_ratio_delta and len(t.aspect_ratios) >= 15:
                t.active_anomalies.add("fallen_posture")
                findings.append(
                    AnomalyFinding(
                        rule_name="fallen_posture",
                        animal_id=t.animal_id,
                        severity="critical",
                        title=f"Fallen / Abnormal Posture (Animal #{t.animal_id})",
                        description=f"Animal #{t.animal_id} exhibits persistent abnormal body aspect ratio (shift: {shift:.2f}), indicating recumbency or inability to rise.",
                        confidence=0.90,
                        metadata={"aspect_ratio_shift": round(shift, 3), "baseline_ar": round(t.baseline_aspect_ratio, 2)},
                    )
                )

        # --- Rule 4: Isolation ---
        # Animal staying > X body-lengths from flock for > N seconds
        for t in tracks:
            dx = t.last_centroid[0] - flock_center[0]
            dy = t.last_centroid[1] - flock_center[1]
            dist_to_flock = np.hypot(dx, dy)
            dist_in_body_lengths = dist_to_flock / max(1.0, mean_diag)

            if dist_in_body_lengths > self.thresholds.isolation_body_lengths and count >= 3:
                # Check how long it has been isolated
                duration = current_time - t.first_seen
                if duration >= self.thresholds.isolation_seconds:
                    t.active_anomalies.add("isolation")
                    findings.append(
                        AnomalyFinding(
                            rule_name="isolation",
                            animal_id=t.animal_id,
                            severity="warning",
                            title=f"Social Isolation (Animal #{t.animal_id})",
                            description=f"Animal #{t.animal_id} is separated from the flock by {dist_in_body_lengths:.1f} body-lengths for >{int(self.thresholds.isolation_seconds)}s.",
                            confidence=min(1.0, 0.6 + (dist_in_body_lengths / 10.0)),
                            metadata={"dist_body_lengths": round(dist_in_body_lengths, 1)},
                        )
                    )

        # --- Rule 5: Erratic / Panic Movement ---
        # Speed spike with high direction-change rate across several animals
        panic_tracks = []
        for t in tracks:
            prof = SPECIES_PROFILES.get(t.species, self.profile) if t.species else self.profile
            if (
                t.last_speed_norm >= (self.thresholds.erratic_speed_multiplier * prof.nominal_speed_norm_min)
                and t.direction_change_rate >= self.thresholds.erratic_dir_changes
            ):
                panic_tracks.append(t)

        if (len(panic_tracks) >= 2 or (count >= 3 and len(panic_tracks) / count >= 0.40)):
            for pt in panic_tracks:
                pt.active_anomalies.add("panic_movement")
            findings.append(
                AnomalyFinding(
                    rule_name="panic_movement",
                    animal_id=None,
                    severity="critical",
                    title="Flock Agitation / Panic Detected",
                    description=f"{len(panic_tracks)} animals exhibiting erratic rapid direction changes and velocity spikes (predator or disturbance alert).",
                    confidence=0.88,
                    metadata={"agitated_count": len(panic_tracks)},
                )
            )

        # --- Rule 6: Crowding / Huddling ---
        # Flock cluster density above threshold or localized dense spatial cluster (heat/cold stress, suffocation risk)
        crowding = flock_metrics.get("crowding_index", 0.0)
        max_cluster_size = flock_metrics.get("max_cluster_size", 0)
        clusters = flock_metrics.get("clusters", [])

        is_dense_crowd = (count >= 4 and crowding >= self.thresholds.crowding_density_threshold)
        is_cluster_huddle = (max_cluster_size >= 4 and max_cluster_size >= count * 0.45)

        if is_dense_crowd or is_cluster_huddle:
            cluster_desc = (
                f"Flock cluster density reached {crowding:.3f} with a dense cluster of {max_cluster_size} animals huddling together."
                if max_cluster_size >= 3
                else f"Flock cluster density index reached {crowding:.3f}, indicating potential thermal distress, suffocation risk, or cornering."
            )
            findings.append(
                AnomalyFinding(
                    rule_name="crowding_huddling",
                    animal_id=None,
                    severity="warning",
                    title="Extreme Crowding / Huddling Alert",
                    description=cluster_desc,
                    confidence=min(1.0, 0.65 + crowding + (0.1 if is_cluster_huddle else 0.0)),
                    metadata={
                        "crowding_index": round(crowding, 3),
                        "max_cluster_size": max_cluster_size,
                        "cluster_count": len(clusters),
                    },
                )
            )

        # --- Rule 7: Count Drop ---
        # Tracked count falls significantly and does not recover
        if len(self.recent_counts) >= 20:
            max_recent = max(self.recent_counts[:15])
            if max_recent >= 3:
                curr_count = count
                drop_ratio = (max_recent - curr_count) / max_recent
                if drop_ratio >= self.thresholds.count_drop_ratio and curr_count < max_recent:
                    findings.append(
                        AnomalyFinding(
                            rule_name="count_drop",
                            animal_id=None,
                            severity="critical",
                            title="Unexplained Livestock Count Drop",
                            description=f"Active animal count fell from {max_recent} to {curr_count} (a {int(drop_ratio * 100)}% decrease). Check enclosure boundaries.",
                            confidence=0.85,
                            metadata={"prior_count": max_recent, "current_count": curr_count},
                        )
                    )

        # --- Rule 8: Low Flock Activity vs Diurnal Baseline ---
        # Flock activity far below learned baseline for time of day
        activity_idx = flock_metrics.get("activity_index", 50.0)
        z_score = BaselineEngine.evaluate_activity_zscore(activity_idx, baseline_data)
        if z_score <= self.thresholds.low_activity_zscore and not baseline_data.get("is_default", False):
            findings.append(
                AnomalyFinding(
                    rule_name="low_flock_activity",
                    animal_id=None,
                    severity="warning",
                    title="Depressed Flock Diurnal Activity",
                    description=f"Flock activity ({activity_idx:.1f}) is significantly below historical baseline for {current_hour:02d}:00 (Z-score: {z_score:.2f}).",
                    confidence=min(1.0, 0.70 + abs(z_score) * 0.1),
                    metadata={"activity_index": activity_idx, "z_score": round(z_score, 2)},
                )
            )

        # --- Rule 9: Limping / Abnormal Gait Proxy ---
        # Abnormally low speed with high bounding box jitter relative to herd median
        for t in tracks:
            if (
                t.last_speed_norm > 0.02
                and t.last_speed_norm < (median_herd_speed * 0.6)
                and t.bbox_jitter_ratio >= (self.thresholds.limping_jitter_ratio * max(0.04, median_herd_jitter))
                and len(t.history) >= 15
            ):
                t.active_anomalies.add("limping_gait")
                findings.append(
                    AnomalyFinding(
                        rule_name="limping_gait",
                        animal_id=t.animal_id,
                        severity="warning",
                        title=f"Asymmetric Gait / Limping Proxy (Animal #{t.animal_id})",
                        description=f"Animal #{t.animal_id} exhibits uneven stride with elevated bounding-box jitter ({t.bbox_jitter_ratio:.2f}) vs herd median.",
                        confidence=0.75,
                        metadata={"jitter_ratio": round(t.bbox_jitter_ratio, 3)},
                    )
                )

        # --- Rule 10: Feeding-Time Deviation ---
        # Flock activity pattern deviates from learned daily rhythm during peak feeding windows (e.g. 7-9 or 16-18)
        is_feeding_hour = current_hour in [7, 8, 9, 16, 17, 18]
        if is_feeding_hour and z_score <= self.thresholds.feeding_deviation_zscore:
            findings.append(
                AnomalyFinding(
                    rule_name="feeding_deviation",
                    animal_id=None,
                    severity="warning",
                    title="Feeding Time Rhythm Deviation",
                    description=f"Anticipated feeding period ({current_hour:02d}:00) activity failed to emerge (Z-score: {z_score:.2f}). Inspect feed troughs.",
                    confidence=0.82,
                    metadata={"current_hour": current_hour, "z_score": round(z_score, 2)},
                )
            )

        return findings
