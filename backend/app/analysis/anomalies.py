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

        # Quality-filtered tracks for individual analytics
        # In dense commercial flocks, per-bird metrics are only trustworthy
        # if the track has maintained stable tracking history without excessive jitter
        quality_tracks = [t for t in tracks if t.is_quality_valid(threshold=0.50)]

        # --- Rule 1: Prolonged Inactivity (Gated by Track Quality) ---
        # Evaluated on individual birds only when track quality is verified
        active_ratio = flock_metrics.get("active_count", 0) / max(1, count)
        for t in quality_tracks:
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
                        description=f"Animal #{t.animal_id} has remained immobile for {idle_mins} min while the flock is active (Track Quality: {int(t.track_quality * 100)}%).",
                        confidence=min(0.95, t.track_quality * (0.6 + (t.current_idle_seconds / 300.0))),
                        metadata={"idle_seconds": round(t.current_idle_seconds, 1), "track_quality": round(t.track_quality, 2)},
                    )
                )

        # --- Rule 2: Sudden Stop (Gated by Track Quality) ---
        for t in quality_tracks:
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
                            confidence=round(min(0.90, t.track_quality * 0.90), 2),
                            metadata={"prior_speed": round(max_past, 2), "curr_speed": round(curr_speed, 2), "species": t.species, "track_quality": round(t.track_quality, 2)},
                        )
                    )

        # --- Rule 3: Fallen / Abnormal Posture (Gated by Track Quality >= 0.70) ---
        for t in quality_tracks:
            if t.track_quality < 0.70:
                continue
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
                        confidence=round(min(0.92, t.track_quality * 0.95), 2),
                        metadata={"aspect_ratio_shift": round(shift, 3), "baseline_ar": round(t.baseline_aspect_ratio, 2), "track_quality": round(t.track_quality, 2)},
                    )
                )

        # --- Rule 4: Isolation (Gated by Track Quality) ---
        for t in quality_tracks:
            dx = t.last_centroid[0] - flock_center[0]
            dy = t.last_centroid[1] - flock_center[1]
            dist_to_flock = np.hypot(dx, dy)
            dist_in_body_lengths = dist_to_flock / max(1.0, mean_diag)

            if dist_in_body_lengths > self.thresholds.isolation_body_lengths and count >= 3:
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
                            confidence=round(min(0.85, t.track_quality * (0.5 + dist_in_body_lengths / 12.0)), 2),
                            metadata={"dist_body_lengths": round(dist_in_body_lengths, 1), "track_quality": round(t.track_quality, 2)},
                        )
                    )

        # --- Rule 5: Erratic / Panic Movement (Flock-Level Primary Signal) ---
        # Combines dense optical flow activity surge + multi-bird trajectory agitation
        of_flow_var = flock_metrics.get("flow_variance", 0.0)
        of_activity = flock_metrics.get("optical_flow_activity", flock_metrics.get("activity_index", 50.0))

        panic_tracks = []
        for t in tracks:
            prof = SPECIES_PROFILES.get(t.species, self.profile) if t.species else self.profile
            if (
                t.last_speed_norm >= (self.thresholds.erratic_speed_multiplier * prof.nominal_speed_norm_min)
                and t.direction_change_rate >= self.thresholds.erratic_dir_changes
            ):
                panic_tracks.append(t)

        is_optical_flow_panic = (of_activity > 75.0 and of_flow_var > 4.5)
        is_kinematic_panic = (len(panic_tracks) >= 3 or (count >= 3 and len(panic_tracks) / count >= 0.40))

        if is_optical_flow_panic or is_kinematic_panic:
            for pt in panic_tracks:
                pt.active_anomalies.add("panic_movement")
            findings.append(
                AnomalyFinding(
                    rule_name="panic_movement",
                    animal_id=None,
                    severity="critical",
                    title="Flock Agitation / Panic Surge Detected",
                    description=(
                        f"Collective panic behavior detected: optical flow kinetic energy surged to {of_activity:.1f}% "
                        f"with {len(panic_tracks)} birds displaying erratic trajectory shifts (disturbance or predator alarm)."
                    ),
                    confidence=0.92 if (is_optical_flow_panic and is_kinematic_panic) else 0.85,
                    metadata={"agitated_count": len(panic_tracks), "optical_flow_activity": of_activity, "flow_variance": of_flow_var},
                )
            )

        # --- Rule 6: Crowding / Thermal Stress Huddling ---
        # Differentiates cold stress huddling vs heat stress perimeter avoidance
        crowding = flock_metrics.get("crowding_index", 0.0)
        max_cluster_size = flock_metrics.get("max_cluster_size", 0)
        clusters = flock_metrics.get("clusters", [])

        is_dense_crowd = (count >= 4 and crowding >= self.thresholds.crowding_density_threshold)
        is_cluster_huddle = (max_cluster_size >= 4 and max_cluster_size >= count * 0.45)

        if is_dense_crowd or is_cluster_huddle:
            findings.append(
                AnomalyFinding(
                    rule_name="crowding_huddling",
                    animal_id=None,
                    severity="warning",
                    title="Cold/Stress Huddling Cluster Detected",
                    description=f"Dense huddle detected: {max_cluster_size} birds clumped in close proximity (Crowding Index: {crowding:.2f}). Check barn temperature/drafts.",
                    confidence=min(0.95, 0.70 + crowding * 0.3),
                    metadata={
                        "crowding_index": round(crowding, 3),
                        "max_cluster_size": max_cluster_size,
                        "cluster_count": len(clusters),
                    },
                )
            )

        # --- Rule 7: Count Drop (Temporally Filtered) ---
        # Uses smoothed count history instead of single-frame tracking drop
        smoothed_count = flock_metrics.get("smoothed_count", count)
        if len(self.recent_counts) >= 20:
            max_recent = max(self.recent_counts[:15])
            if max_recent >= 5:
                drop_ratio = (max_recent - smoothed_count) / max_recent
                if drop_ratio >= self.thresholds.count_drop_ratio and smoothed_count < max_recent:
                    findings.append(
                        AnomalyFinding(
                            rule_name="count_drop",
                            animal_id=None,
                            severity="critical",
                            title="Unexplained Flock Count Drop",
                            description=f"Smoothed flock count fell from {max_recent} to {smoothed_count} (a {int(drop_ratio * 100)}% decrease). Check pen boundaries.",
                            confidence=0.88,
                            metadata={"prior_count": max_recent, "current_count": smoothed_count},
                        )
                    )

        # --- Rule 8: Low Flock Activity vs Diurnal Baseline ---
        activity_idx = flock_metrics.get("optical_flow_activity", flock_metrics.get("activity_index", 50.0))
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

        # --- Rule 9: Limping / Asymmetric Gait Proxy (Downgraded Experimental) ---
        # In dense commercial flocks, bounding box jitter is high due to occlusions.
        # This rule only evaluates on exceptional quality tracks (track_quality >= 0.75)
        for t in quality_tracks:
            if t.track_quality < 0.75:
                continue
            if (
                t.last_speed_norm > 0.02
                and t.last_speed_norm < (median_herd_speed * 0.6)
                and t.bbox_jitter_ratio >= (self.thresholds.limping_jitter_ratio * max(0.04, median_herd_jitter))
                and len(t.history) >= 20
            ):
                t.active_anomalies.add("limping_gait")
                findings.append(
                    AnomalyFinding(
                        rule_name="limping_gait",
                        animal_id=t.animal_id,
                        severity="info",  # Downgraded to info/advisory
                        title=f"Possible Asymmetric Gait (Animal #{t.animal_id}) [Experimental]",
                        description=f"Animal #{t.animal_id} exhibits uneven stride with elevated bounding-box jitter ({t.bbox_jitter_ratio:.2f}). Manual check recommended.",
                        confidence=0.45,  # Low confidence reflecting commercial reality
                        metadata={"jitter_ratio": round(t.bbox_jitter_ratio, 3), "track_quality": round(t.track_quality, 2)},
                    )
                )

        # --- Rule 10: Feeding-Time Rhythm & Zone Deviation ---
        is_feeding_hour = current_hour in [7, 8, 9, 16, 17, 18]
        zone_occupancy = flock_metrics.get("zone_occupancy_pcts", {})
        feeder_pct = zone_occupancy.get("feeder", 15.0)  # default if not configured

        if is_feeding_hour:
            if z_score <= self.thresholds.feeding_deviation_zscore or feeder_pct < 2.0:
                findings.append(
                    AnomalyFinding(
                        rule_name="feeding_deviation",
                        animal_id=None,
                        severity="warning",
                        title="Feeding Time Rhythm / Trough Deviation",
                        description=f"Anticipated feeding period ({current_hour:02d}:00) activity failed to emerge (feeder zone: {feeder_pct:.1f}%). Check feed distribution.",
                        confidence=0.84,
                        metadata={"current_hour": current_hour, "feeder_occupancy_pct": feeder_pct, "z_score": round(z_score, 2)},
                    )
                )

        return findings

        return findings
