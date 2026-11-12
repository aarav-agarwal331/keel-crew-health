"""make model (part 1): fit the full-indicator model used on simulated missions.

No real dataset contains every indicator Keel tracks, so the correlation matrix and the alert
thresholds for the full set are calibrated on SIMULATED training missions (seeds 5000+), which
are disjoint from the evaluation missions (seeds 9000+) and from the demo missions.
Output: app/public/data/model_mission.json
"""
import common  # noqa: F401
import numpy as np

from keel.core import Params
from keel.evaluate import Windows, calibrate, fit_model, score_people
from keel.export import APP_PUBLIC, git_commit, model_json, write_json
from keel.mission import adaptation_prior, detect_spec, people_from
from keel.simulator import Scenario, apply_missing, random_events, simulate

BUDGETS = {"notice": 1.0, "alert": 0.25}   # false alerts per person-month, per tier
N_TRAIN = 40
SEED0 = 5000


def training_people(n: int = N_TRAIN, seed0: int = SEED0):
    rng = np.random.default_rng(seed0)
    people = []
    for s in range(n):
        sc = Scenario()
        sc.events = random_events(rng, sc, 2)
        m = simulate(sc, seed0 + s)
        people += people_from(m, apply_missing(m, seed0 + s))
    return people


def main():
    spec, p, w = detect_spec(), Params(), Windows()
    people = training_people()
    model = fit_model(people, spec, p, w)
    scores = score_people(people, model, p)
    on = [q.onsets for q in people]
    thr = {k: calibrate([s["fusion"] for s in scores], on, b, w, p.merge_gap) for k, b in BUDGETS.items()}
    meta = {"id": "mission", "calibrated_on": f"{N_TRAIN} simulated Mars-transit missions x 4 crew (seeds {SEED0}-{SEED0 + N_TRAIN - 1})",
            "simulated_calibration": True, "budgets": BUDGETS, "script": "research/scripts/fit_mission_model.py",
            "commit": git_commit(), "adaptation_prior": adaptation_prior(spec["indicators"])}
    write_json(APP_PUBLIC / "data" / "model_mission.json", model_json(model, p, thr, meta), indent=1)
    print("thresholds", thr, "h_cusum", model.h_cusum, "h_mewma", model.h_mewma)


if __name__ == "__main__":
    main()
