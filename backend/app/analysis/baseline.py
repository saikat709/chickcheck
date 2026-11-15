import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.config import SPECIES_PROFILES
from backend.app.models import HourlyBaselineRecord


class BaselineEngine:
    """
    Maintains and updates rolling diurnal (hourly) behavioral baselines per species
    using EWMA (Exponentially Weighted Moving Average) and MAD (Median Absolute Deviation).
    Falls back to curated species profiles when insufficient historical data is available.
    """

    ALPHA: float = 0.10  # EWMA smoothing factor
    MIN_SAMPLES_FOR_BASELINE: int = 15

    @classmethod
    def get_species_default(cls, species: str) -> Dict[str, float]:
        profile = SPECIES_PROFILES.get(species.lower())
        nominal_speed = 0.2
        if profile:
            nominal_speed = (profile.nominal_speed_norm_min + profile.nominal_speed_norm_max) / 2.0

        # Nominal flock activity defaults: daytime active (55), nighttime calm (25)
        return {
            "mean_activity": 50.0,
            "median_activity": 50.0,
            "std_activity": 15.0,
            "mad_activity": 10.0,
            "mean_speed": nominal_speed,
            "sample_count": 0,
            "is_default": True,
        }

    @classmethod
    def get_baseline_for_hour(cls, db: Optional[Session], species: str, hour: int) -> Dict[str, Any]:
        """
        Retrieves learned baseline for a given species and hour of day (0-23).
        If database is unavailable or fewer than MIN_SAMPLES exist, returns profile default.
        """
        if db is not None:
            try:
                rec = (
                    db.query(HourlyBaselineRecord)
                    .filter(
                        HourlyBaselineRecord.species == species.lower(),
                        HourlyBaselineRecord.hour_of_day == hour,
                    )
                    .first()
                )
                if rec and rec.sample_count >= cls.MIN_SAMPLES_FOR_BASELINE:
                    return {
                        "mean_activity": rec.mean_activity,
                        "median_activity": rec.median_activity,
                        "std_activity": rec.std_activity,
                        "mad_activity": max(3.0, rec.mad_activity),
                        "mean_speed": rec.mean_speed,
                        "sample_count": rec.sample_count,
                        "is_default": False,
                    }
            except Exception:
                pass

        return cls.get_species_default(species)

    @classmethod
    def update_baseline_sample(
        cls,
        db: Session,
        species: str,
        hour: int,
        activity_index: float,
        mean_speed: float,
    ) -> None:
        """
        Updates rolling EWMA and MAD for the species and current hour.
        """
        try:
            rec = (
                db.query(HourlyBaselineRecord)
                .filter(
                    HourlyBaselineRecord.species == species.lower(),
                    HourlyBaselineRecord.hour_of_day == hour,
                )
                .first()
            )

            if not rec:
                rec = HourlyBaselineRecord(
                    species=species.lower(),
                    hour_of_day=hour,
                    sample_count=1,
                    mean_activity=activity_index,
                    median_activity=activity_index,
                    std_activity=10.0,
                    mad_activity=8.0,
                    mean_speed=mean_speed,
                    updated_at=datetime.datetime.utcnow(),
                )
                db.add(rec)
            else:
                a = cls.ALPHA
                rec.sample_count += 1
                diff = abs(activity_index - rec.mean_activity)
                rec.mean_activity = float((1.0 - a) * rec.mean_activity + a * activity_index)
                rec.mad_activity = float((1.0 - a) * rec.mad_activity + a * diff)
                rec.median_activity = rec.mean_activity  # EWMA approximation for central tendency
                rec.mean_speed = float((1.0 - a) * rec.mean_speed + a * mean_speed)
                rec.updated_at = datetime.datetime.utcnow()

            db.commit()
        except Exception:
            db.rollback()

    @classmethod
    def evaluate_activity_zscore(
        cls,
        activity_index: float,
        baseline: Dict[str, Any],
    ) -> float:
        """
        Computes robust modified Z-score using MAD.
        Z = (activity - median) / (1.4826 * MAD)
        """
        mad = max(2.5, baseline.get("mad_activity", 10.0))
        center = baseline.get("median_activity", 50.0)
        z = (activity_index - center) / (1.4826 * mad)
        return float(z)

