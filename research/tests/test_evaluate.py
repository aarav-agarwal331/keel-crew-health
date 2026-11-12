"""Unit tests for the evaluation protocol: counting rules and leakage guards."""
import numpy as np

from keel.core import Params
from keel.evaluate import Person, Windows, calibrate, cv_run, person_outcome, quiet_mask
from keel.mission import detect_spec


def test_quiet_mask_excludes_event_surroundings():
    q = quiet_mask(100, [50], Windows())
    assert q[:29].all() and not q[29:79].any() and q[79:].all()


def test_detection_and_false_alert_counting():
    w = Windows()
    s = np.zeros(200)
    s[20:23] = 5      # false alert on a quiet day
    s[95:103] = 5     # alert starting 5 days before the event at day 100
    r = person_outcome(s, 1.0, [100], w, 3)
    assert r["fa"] == 1 and r["leads"] == [5.0]


def test_long_false_alert_counts_once_per_week():
    s = np.zeros(200)
    s[20:41] = 5      # one 21-day alert
    r = person_outcome(s, 1.0, [], Windows(), 3)
    assert r["fa"] == 3 and r["alert_days"] == 21


def test_alert_far_before_event_is_not_a_detection():
    s = np.zeros(200)
    s[60:62] = 5
    r = person_outcome(s, 1.0, [100], Windows(), 3)
    assert r["leads"] == [None] and r["fa"] == 1


def test_calibrate_meets_budget_on_training_data():
    rng = np.random.default_rng(0)
    scores = [np.abs(rng.normal(0, 1, 300)) for _ in range(20)]
    on = [[] for _ in scores]
    w = Windows()
    for b in [0.25, 1.0, 2.0]:
        thr = calibrate(scores, on, b, w, 3)
        fa = sum(person_outcome(s, thr, [], w, 3)["fa"] for s in scores)
        assert fa / (20 * 300 / 30.44) <= b + 1e-9


def test_cv_never_scores_a_person_with_a_model_that_saw_them():
    rng = np.random.default_rng(1)
    spec = detect_spec(["rhr", "sleep_h"])
    people = [Person(pid=str(i), x=np.column_stack([rng.normal(60, 2, 150), rng.normal(7, 0.7, 150)])) for i in range(15)]
    res = cv_run(people, spec, Params(), Windows(), [1.0], k=5, methods=["zscore"])
    seen = sorted(i for f in res["folds"] for i in f)
    assert seen == list(range(15))                       # each person held out exactly once
    assert all(r is not None for r in res["outcomes"]["zscore"][1.0])


def test_stratified_cv_holds_each_person_out_once():
    """The path eval_real.py uses: stratified folds, events present."""
    rng = np.random.default_rng(2)
    spec = detect_spec(["rhr", "sleep_h"])
    people = [Person(pid=str(i), x=np.column_stack([rng.normal(60, 2, 150), rng.normal(7, 0.7, 150)]), onsets=[100] if i % 3 == 0 else []) for i in range(18)]
    res = cv_run(people, spec, Params(), Windows(), [1.0], k=5, methods=["zscore"], strat=[1 if q.onsets else 0 for q in people])
    assert sorted(i for f in res["folds"] for i in f) == list(range(18))
    assert [r["pid"] for r in res["outcomes"]["zscore"][1.0]] == [q.pid for q in people]
    # folds with events are spread out: no fold holds more than half of the people with events
    with_ev = {i for i, q in enumerate(people) if q.onsets}
    assert max(len(with_ev & set(f)) for f in res["folds"]) <= len(with_ev) / 2
