from backend.app.analysis.baseline import BaselineEngine


def test_baseline_default_fallback(db_session):
    # Empty DB: returns default species profile
    base = BaselineEngine.get_baseline_for_hour(db_session, "chicken", 10)
    assert base["is_default"] is True
    assert base["mean_activity"] == 50.0
    assert base["sample_count"] == 0


def test_baseline_ewma_and_mad_learning(db_session):
    # Push 20 samples to surpass threshold
    for i in range(20):
        activity = 60.0 + (i % 5)
        speed = 0.25
        BaselineEngine.update_baseline_sample(db_session, "chicken", 12, activity, speed)

    learned = BaselineEngine.get_baseline_for_hour(db_session, "chicken", 12)
    assert learned["is_default"] is False
    assert learned["sample_count"] == 20
    assert 55.0 <= learned["mean_activity"] <= 65.0
    assert learned["mad_activity"] > 0


def test_baseline_zscore_calculation():
    baseline = {
        "median_activity": 60.0,
        "mad_activity": 5.0,
    }
    # Activity at median: Z should be ~0
    z_normal = BaselineEngine.evaluate_activity_zscore(60.0, baseline)
    assert abs(z_normal) < 0.01

    # Activity severely depressed: e.g. 20.0
    # z = (20 - 60) / (1.4826 * 5) = -40 / 7.413 = -5.39
    z_low = BaselineEngine.evaluate_activity_zscore(20.0, baseline)
    assert z_low < -4.0

