import time
from typing import Dict, Tuple, Optional


class AlertDeduplicator:
    """
    Manages deduplication, suppression windows, and escalation for repeated anomaly triggers.
    Keyed by (alert_type, animal_id).
    """

    def __init__(self, default_cooldown_seconds: float = 300.0):
        self.default_cooldown = default_cooldown_seconds
        # Maps (alert_type, animal_id) -> (last_alert_time, last_severity, occurrence_count)
        self.history: Dict[Tuple[str, Optional[int]], Tuple[float, str, int]] = {}

    def should_alert(
        self,
        alert_type: str,
        animal_id: Optional[int],
        requested_severity: str,
        cooldown_seconds: Optional[float] = None,
    ) -> Tuple[bool, str]:
        """
        Determines whether an alert should be dispatched and whether severity escalates.
        Returns:
            Tuple of (should_dispatch: bool, final_severity: str).
        """
        cooldown = cooldown_seconds if cooldown_seconds is not None else self.default_cooldown
        now = time.time()
        key = (alert_type, animal_id)

        if key not in self.history:
            self.history[key] = (now, requested_severity, 1)
            return True, requested_severity

        last_time, last_sev, count = self.history[key]
        elapsed = now - last_time

        if elapsed >= cooldown:
            new_count = count + 1
            # Escalate severity if condition persists across multiple cooldown periods
            effective_severity = requested_severity
            if requested_severity == "warning" and new_count >= 2:
                effective_severity = "critical"

            self.history[key] = (now, effective_severity, new_count)
            return True, effective_severity

        # In cooldown: if a warning suddenly spikes to critical, allow immediate escalation
        if requested_severity == "critical" and last_sev != "critical":
            self.history[key] = (now, "critical", count + 1)
            return True, "critical"

        # Suppressed by cooldown
        return False, requested_severity

    def reset(self, alert_type: Optional[str] = None, animal_id: Optional[int] = None) -> None:
        if alert_type is None and animal_id is None:
            self.history.clear()
        else:
            to_del = [k for k in self.history if (alert_type is None or k[0] == alert_type) and (animal_id is None or k[1] == animal_id)]
            for k in to_del:
                self.history.pop(k, None)

