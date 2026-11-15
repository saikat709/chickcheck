from backend.app.vision.tracker_state import AnimalTrackState
from backend.app.analysis.health_score import (
    compute_animal_health_score,
    compute_flock_health_score,
)


def test_animal_health_score_healthy():
    track = AnimalTrackState(animal_id=1, initial_time=0.0, bbox=(100, 100, 150, 150))
    score, status = compute_animal_health_score(track)
    assert score == 100.0
    assert status == "healthy"


def test_animal_health_score_anomalies_and_status():
    track = AnimalTrackState(animal_id=2, initial_time=0.0, bbox=(100, 100, 150, 150))

    # Add fallen posture anomaly (-40 pts)
    track.active_anomalies.add("fallen_posture")
    score, status = compute_animal_health_score(track)
    assert score == 60.0
    assert status == "watch"

    # Add prolonged inactivity (-25 pts) -> total deduction -65 pts -> score 35.0
    track.active_anomalies.add("prolonged_inactivity")
    score, status = compute_animal_health_score(track)
    assert score == 35.0
    assert status == "alert"


def test_animal_health_score_classifier_blend():
    track = AnimalTrackState(animal_id=3, initial_time=0.0, bbox=(100, 100, 150, 150))
    # Classifier reports 0.90 healthy probability
    score, status = compute_animal_health_score(track, classifier_healthy_prob=0.90)
    # 0.70 * 100 + 0.30 * 90 = 97.0
    assert score == 97.0
    assert status == "healthy"


def test_flock_health_score_penalties():
    t1 = AnimalTrackState(1, 0.0, (100, 100, 150, 150))
    t1.health_score = 90.0
    t2 = AnimalTrackState(2, 0.0, (200, 200, 250, 250))
    t2.health_score = 80.0

    # Clean flock: mean is 85.0 -> healthy
    f_score, f_status = compute_flock_health_score([t1, t2], {}, [])
    assert f_score == 85.0
    assert f_status == "healthy"

    # Systemic panic: -20 penalty -> 65.0 -> watch
    f_score, f_status = compute_flock_health_score([t1, t2], {}, ["panic_movement"])
    assert f_score == 65.0
    assert f_status == "watch"

    # Count drop: -30 penalty -> 55.0 -> watch, + panic -> 35.0 -> alert
    f_score, f_status = compute_flock_health_score([t1, t2], {}, ["count_drop", "panic_movement"])
    assert f_score == 35.0
    assert f_status == "alert"

