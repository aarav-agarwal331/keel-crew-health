"""make model (part 1): fit the full-indicator model used on simulated missions.

No real dataset contains every indicator Keel tracks, so the correlation matrix and the alert
thresholds for the full set are calibrated on SIMULATED training missions (seeds 5000+), which
are disjoint from the evaluation missions (seeds 9000+) and from the demo missions.
Output: app/public/data/model_mission.json
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I
import numpy as np

from keel.core import Params
from keel.evaluate import Windows, aggregate, calibrate, fit_model, person_outcome, score_people
from keel.export import APP_PUBLIC, git_commit, model_json, write_json
from keel.mission import adaptation_prior, detect_spec, people_from
from keel.simulator import Scenario, apply_missing, random_events, simulate

BUDGETS = {"notice": 1.0, "alert": 0.25}   # false alerts per person-month, per tier
N_TRAIN = 60
CANDIDATES = ["zscore", "cusum", "mewma", "fusion"]   # order = preference when tied (simplest first)
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
    # Which detector to deploy is decided here, on TRAINING missions only: the candidate with the
    # highest detection rate summed over both tiers.  Test missions and real data never vote.
    sel = {}
    for cand in CANDIDATES:
        tot = 0.0
        for b in BUDGETS.values():
            t = calibrate([s[cand] for s in scores], on, b, w, p.merge_gap)
            tot += aggregate([person_outcome(s[cand], t, o, w, p.merge_gap) for s, o in zip(scores, on)])["detection_rate"]
        sel[cand] = tot / len(BUDGETS)
    deployed = max(CANDIDATES, key=lambda c: (round(sel[c], 3), -CANDIDATES.index(c)))
    print("training-set detection by candidate", {k: round(v, 3) for k, v in sel.items()}, "-> deploy", deployed)
    thr = {k: calibrate([s[deployed] for s in scores], on, b, w, p.merge_gap) for k, b in BUDGETS.items()}
    meta = {"deployed": deployed, "selection": sel, "id": "mission", "calibrated_on": f"{N_TRAIN} simulated Mars-transit missions x 4 crew (seeds {SEED0}-{SEED0 + N_TRAIN - 1})",
            "simulated_calibration": True, "budgets": BUDGETS, "script": "research/scripts/fit_mission_model.py",
            "commit": git_commit(), "adaptation_prior": adaptation_prior(spec["indicators"])}
    write_json(APP_PUBLIC / "data" / "model_mission.json", model_json(model, p, thr, meta), indent=1)
    print("thresholds", thr, "h_cusum", model.h_cusum, "h_mewma", model.h_mewma)
    set_demo_days(model, p, thr["notice"], deployed)


def set_demo_days(model, p, thr_notice, deployed):
    """Open each demo mission on the day after Keel first alerts on its scripted illness, so the
    first screen a visitor sees has something to act on.  Purely a display default."""
    import json

    from keel.core import Phase, all_scores, episodes
    from keel.mission import features
    from keel.simulator import IND
    for path in sorted((APP_PUBLIC / "data" / "missions").glob("*.json")):
        m = json.loads(path.read_text())
        if not m.get("simulated"):
            continue
        ev = next((e for e in m["truth"] if e["type"] == "illness"), None)
        if ev is None:
            continue
        crew = m["crew"][ev["crew"]]["id"]
        raw = np.array([[np.nan if v is None else v for v in m["series"][crew][k]] for k in IND], float).T
        x = features(raw, model.indicators)
        phases = [Phase(q["start"], np.array(q["shift"]), np.array(q["tau"]), q["kappa"]) for q in m["phases"]]
        score = all_scores(x, model, p, phases)[deployed]
        eps = [a for a, b in episodes(score, thr_notice, p.merge_gap) if ev["onset"] - 10 <= a <= ev["onset"] + 6]
        day = (eps[0] + 1) if eps else ev["onset"] + 1
        m["default_day"], m["default_crew"] = int(day), crew
        path.write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")))
        print(f"{m['id']}: scripted illness onset day {ev['onset']}, first alert day {eps[0] if eps else None}, demo opens on day {day}")


if __name__ == "__main__":
    main()
