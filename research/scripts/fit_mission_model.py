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
from keel.evaluate import Windows, aggregate, calibrate, chance_rows, fit_model, person_outcome, score_people
from keel.export import APP_PUBLIC, git_commit, model_json, write_json
from keel.mission import adaptation_prior, detect_spec, people_from
from keel.simulator import Scenario, apply_missing, random_events, simulate

BUDGETS = {"notice": 1.0, "alert": 0.25}   # false alerts per person-month, per tier
N_TRAIN = 60
CANDIDATES = ["zscore", "cusum", "mewma", "fusion"]   # simplest first
MARGIN = 0.03   # a more complex detector must beat a simpler one by more than 3 points net of luck
SEED0 = 5000


def training_people(n: int = N_TRAIN, seed0: int = SEED0):
    rng = np.random.default_rng(seed0)
    people = []
    for s in range(n):
        sc = Scenario()
        sc.events = random_events(rng, sc, 2)
        m = simulate(sc, seed0 + s)
        people += people_from(m, apply_missing(m, seed0 + s))
    for q in people:
        q.pid = q.pid  # pids are unique per mission seed and crew member
    return people


def main():
    spec, p, w = detect_spec(), Params(), Windows()
    people = training_people()
    model = fit_model(people, spec, p, w)
    scores = score_people(people, model, p)
    on = [q.onsets for q in people]
    # Which detector to deploy is decided here, on TRAINING missions only (test missions and real
    # data never vote).  Criterion: detection NET OF LUCK (detection rate minus the rate at which
    # pseudo-events on quiet days are "detected"), averaged over the two tiers.  Candidates are
    # ordered from simplest to most complex; a more complex one must beat the best simpler one
    # by more than MARGIN to be chosen.
    sel = {}
    for cand in CANDIDATES:
        tot = 0.0
        for b in BUDGETS.values():
            t = calibrate([s[cand] for s in scores], on, b, w, p.merge_gap)
            det = aggregate([person_outcome(s[cand], t, o, w, p.merge_gap) for s, o in zip(scores, on)])["detection_rate"]
            ch = aggregate(chance_rows(people, [s[cand] for s in scores], [t] * len(people), w, p.merge_gap, 3, SEED0))["detection_rate"]
            tot += det - ch
        sel[cand] = tot / len(BUDGETS)
    deployed = CANDIDATES[0]
    for cand in CANDIDATES[1:]:
        if sel[cand] > sel[deployed] + MARGIN:
            deployed = cand
    print("training-set detection net of luck by candidate", {k: round(v, 3) for k, v in sel.items()}, "-> deploy", deployed)
    thr = {k: calibrate([s[deployed] for s in scores], on, b, w, p.merge_gap) for k, b in BUDGETS.items()}
    meta = {"deployed": deployed, "selection": sel, "selection_rule": f"highest detection net of luck on training missions; complexity must earn more than {MARGIN:.2f}", "id": "mission", "calibrated_on": f"{N_TRAIN} simulated Mars-transit missions x 4 crew (seeds {SEED0}-{SEED0 + N_TRAIN - 1})",
            "simulated_calibration": True, "budgets": BUDGETS, "script": "research/scripts/fit_mission_model.py",
            "commit": git_commit(), "adaptation_prior": adaptation_prior(spec["indicators"])}
    write_json(APP_PUBLIC / "data" / "model_mission.json", model_json(model, p, thr, meta), indent=1)
    print("thresholds", thr, "h_cusum", model.h_cusum, "h_mewma", model.h_mewma)
    set_demo_days(model, p, thr["notice"], deployed)


def set_demo_days(model, p, thr_notice, deployed):
    """Stage the demo missions.  The scripted illness is placed on the first candidate day that
    is preceded by two weeks without any alert for that crew member (so the replay is readable
    and no chance alert can be mistaken for early warning), and each mission opens on the day
    after Keel first alerts on it.  Noise is identical with and without the event, so placement
    cannot change how hard the event is to detect."""
    import importlib.util
    import json

    from keel.core import Phase, all_scores, episodes
    from keel.mission import features
    from keel.simulator import IND
    spec_ = importlib.util.spec_from_file_location("run_sim", Path(__file__).with_name("run_sim.py"))
    run_sim = importlib.util.module_from_spec(spec_)
    spec_.loader.exec_module(run_sim)
    candidates = {"mars_transit": range(119, 129), "lunar_surface": range(24, 33)}   # mars: inside the scripted blackout

    def score_of(m, crew):
        raw = np.array([[np.nan if v is None else v for v in m["series"][crew][k]] for k in IND], float).T
        phases = [Phase(q["start"], np.array(q["shift"]), np.array(q["tau"]), q["kappa"]) for q in m["phases"]]
        return all_scores(features(raw, model.indicators), model, p, phases)[deployed]

    run_sim.main({"mars_transit": 400, "lunar_surface": 400})      # first without the illness (day 400 is past the end)
    chosen = {}
    staged = {}
    for path in sorted((APP_PUBLIC / "data" / "missions").glob("*.json")):
        m = json.loads(path.read_text())
        if not isinstance(m, dict) or not m.get("simulated") or m["id"] not in candidates:
            continue
        ev = next(e for e in m["truth"] if e["type"] == "illness")
        crew = m["crew"][ev["crew"]]["id"]
        eps = episodes(score_of(m, crew), thr_notice, p.merge_gap)
        L = m["pre_days"]
        quiet = [fd for fd in candidates[m["id"]] if not any(a <= L + fd + 4 and b >= L + fd - 14 for a, b in eps)]
        chosen[m["id"]] = quiet[0] if quiet else list(candidates[m["id"]])[0]
        if not quiet:   # say so: the replay text must not claim a quiet run-up
            print(f"WARNING {m['id']}: no candidate day has two quiet weeks before it; using flight day {chosen[m['id']]}")
        staged[m["id"]] = {"flight_day": chosen[m["id"]], "quiet_two_weeks_before": bool(quiet)}
    run_sim.main(chosen)
    for path in sorted((APP_PUBLIC / "data" / "missions").glob("*.json")):
        m = json.loads(path.read_text())
        if not isinstance(m, dict) or not m.get("simulated"):
            continue
        ev = next((e for e in m["truth"] if e["type"] == "illness"), None)
        if ev is None:
            continue
        crew = m["crew"][ev["crew"]]["id"]
        eps = [a for a, b in episodes(score_of(m, crew), thr_notice, p.merge_gap) if ev["onset"] - 3 <= a <= ev["onset"] + 6]
        day = (eps[0] + 1) if eps else ev["onset"] + 1
        m["default_day"], m["default_crew"] = int(day), crew
        if m["id"] in staged:   # the replay states how its demo day was chosen, from this record
            m["staging"] = staged[m["id"]]
        path.write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")))
        print(f"{m['id']}: scripted illness on flight day {ev['onset'] - m['pre_days'] + 1}, first alert {'flight day ' + str(eps[0] - m['pre_days'] + 1) if eps else 'none in window'}, demo opens on day index {day}")


if __name__ == "__main__":
    main()
