import time
from backend.app.alerts.dedupe import AlertDeduplicator


def test_dedupe_cooldown_and_escalation():
    dedup = AlertDeduplicator(default_cooldown_seconds=1.0)

    # 1. First trigger allows dispatch
    allowed, sev = dedup.should_alert("prolonged_inactivity", 1, "warning")
    assert allowed is True
    assert sev == "warning"

    # 2. Immediate second trigger is suppressed by cooldown
    allowed, sev = dedup.should_alert("prolonged_inactivity", 1, "warning")
    assert allowed is False

    # 3. Different animal ID is not suppressed
    allowed_other, sev_other = dedup.should_alert("prolonged_inactivity", 2, "warning")
    assert allowed_other is True

    # 4. Spike to critical during cooldown bypasses cooldown
    allowed_crit, sev_crit = dedup.should_alert("prolonged_inactivity", 1, "critical")
    assert allowed_crit is True
    assert sev_crit == "critical"

    # 5. After cooldown expires, repeating warning escalates to critical
    time.sleep(1.05)
    allowed_after, sev_after = dedup.should_alert("prolonged_inactivity", 1, "warning")
    assert allowed_after is True
    assert sev_after == "critical"  # Escalated due to persistent condition


def test_dedupe_reset():
    dedup = AlertDeduplicator(default_cooldown_seconds=10.0)
    allowed, _ = dedup.should_alert("isolation", 5, "warning")
    assert allowed is True

    # Reset
    dedup.reset()
    # Now immediately allowed again
    allowed_again, _ = dedup.should_alert("isolation", 5, "warning")
    assert allowed_again is True

