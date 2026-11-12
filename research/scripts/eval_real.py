"""make validate (part 1): detection performance on REAL wearable data with labeled illness.

Data: Stanford COVID-19 wearables phase 1 (Mishra et al. 2020) and phase 2 subset (Alavi et al.
2022), reduced to daily features by build_daily.py.  Protocol in docs/METHOD.md section 6:
5-fold cross-validation over people, thresholds calibrated on training people to a false-alert
budget, cluster bootstrap over people for 95% intervals, pseudo-events for the chance level.
Output: app/public/results/real_eval.json
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I

import json

import numpy as np
import pandas as pd

from keel.core import Params
from keel.evaluate import (METHOD_LABELS, METHODS, Person, Windows, aggregate, bootstrap, chance_rows, cv_run, paired_diff,
                           person_outcome, quiet_mask)
from keel.export import APP_PUBLIC, git_commit, write_json

INTERIM = ROOT / "data" / "interim"
BUDGETS = [0.25, 0.5, 1.0, 2.0, 4.0]
SEED = 20261112
SPECS = {
    "rhr": {"indicators": ["rhr"], "transform": ["none"], "concern": [1], "floor": [1.5]},
    "rhr_steps": {"indicators": ["rhr", "steps"], "transform": ["none", "log"], "concern": [1, -1], "floor": [1.5, 0.25]},
    "rhr_rhrday_steps": {"indicators": ["rhr", "rhr_day", "steps"], "transform": ["none", "none", "log"], "concern": [1, 1, -1], "floor": [1.5, 1.5, 0.25]},
    "rhr_steps_sleep": {"indicators": ["rhr", "steps", "sleep_h"], "transform": ["none", "log", "none"], "concern": [1, -1, 0], "floor": [1.5, 0.25, 0.5]},
}
SPEC_LABELS = {"rhr": "Resting heart rate only", "rhr_steps": "Resting heart rate + daily steps",
               "rhr_steps_sleep": "Resting heart rate + steps + sleep duration",
               "rhr_rhrday_steps": "Night and whole-day resting heart rate + steps (exploratory, added after seeing the main result)"}
MIN_DAYS = 28   # a person needs at least this many days with resting heart rate
# the detector the app deploys, chosen on simulated TRAINING missions by fit_mission_model.py (never on this data)
DEPLOYED = json.loads((APP_PUBLIC / "data" / "model_mission.json").read_text())["deployed"]


def load_people(cols: list[str]) -> list[Person]:
    daily = pd.read_csv(INTERIM / "stanford_daily.csv", parse_dates=["date"])
    events = pd.read_csv(INTERIM / "stanford_events.csv", parse_dates=["date"])
    meta = pd.read_csv(INTERIM / "stanford_people.csv").set_index(["dataset", "pid"])
    out = []
    for (ds, pid), g in daily.groupby(["dataset", "pid"], sort=True):
        g = g.sort_values("date")
        if g["rhr"].notna().sum() < MIN_DAYS:
            continue
        d0 = g["date"].iloc[0]
        ev = events[(events.dataset == ds) & (events.pid == pid)]
        # onset = symptom onset when reported, otherwise the positive test date; other illness = reported start
        anchors = []
        sym = ev[ev.kind == "covid_symptom"]["date"].tolist()
        tst = ev[ev.kind == "covid_test"]["date"].tolist()
        for d in (sym if sym else tst):
            anchors.append((int((d - d0).days), "covid_symptom" if sym else "covid_test_only"))
        for d in ev[ev.kind == "other_illness"]["date"].tolist():
            anchors.append((int((d - d0).days), "other_illness"))
        anchors = sorted(a for a in anchors if 0 <= a[0] < len(g))
        merged: list[tuple[int, str]] = []
        for a in anchors:   # episodes less than four weeks apart are one illness period
            if not merged or a[0] - merged[-1][0] > 28:
                merged.append(a)
        x = g[cols].to_numpy(float)
        if "steps" in cols:
            j = cols.index("steps")
            x[x[:, j] <= 0, j] = np.nan
        out.append(Person(pid=f"{ds}:{pid}", x=x, onsets=[a[0] for a in merged],
                          meta={"dataset": ds, "group": meta.loc[(ds, pid), "group"], "device": meta.loc[(ds, pid), "device"]},
                          events_meta=[{"kind": a[1]} for a in merged]))
    return out


def subset(rows: list[dict], people: list[Person], pred) -> list[dict]:
    """Keep each person's quiet time, but only the events for which pred(person, k) is true."""
    out = []
    for r, q in zip(rows, people):
        keep = [k for k in range(len(q.onsets)) if pred(q, k)]
        out.append({**r, "leads": [r["leads"][k] for k in keep], "scorable": [r["scorable"][k] for k in keep]})
    return out


def run(spec_key: str, people: list[Person], w: Windows, p: Params, adjust=None, methods=METHODS) -> dict:
    strat = [1 if q.onsets else 0 for q in people]
    return cv_run(people, SPECS[spec_key], p, w, BUDGETS, k=5, seed=SEED, methods=methods, adjust_spec=adjust, strat=strat)


def summarise(res: dict, people: list[Person], w: Windows, p: Params, methods=METHODS) -> dict:
    out = {}
    for m in methods:
        out[m] = {}
        for b in BUDGETS:
            rows = res["outcomes"][m][b]
            st = bootstrap(rows, 2000, SEED)
            ch = chance_rows(people, res["scores"][m], res["thr_person"][m][b], w, p.merge_gap, per_person=5, seed=SEED)
            cb = bootstrap(ch, 1000, SEED)
            st["chance_detection_rate"] = cb["detection_rate"]
            st["chance_detection_rate_ci"] = cb["detection_rate_ci"]
            st["chance_by_onset_rate"] = cb["by_onset_rate"]
            st["n_pseudo_events"] = cb["n_events"]
            out[m][str(b)] = st
    return out


def main():
    p, w = Params(), Windows()
    # ---------------- main analysis: indicators everyone has (resting heart rate + steps) ----------------
    people = load_people(["rhr", "steps"])
    res = run("rhr_steps", people, w, p)
    main_tbl = summarise(res, people, w, p)
    n_ev = sum(len(q.onsets) for q in people)
    cohort = {
        "n_people": len(people), "n_with_event": sum(1 for q in people if q.onsets), "n_events": n_ev,
        "person_days": int(sum(len(q.x) for q in people)),
        "quiet_person_months": float(sum(quiet_mask(len(q.x), q.onsets, w).sum() for q in people) / 30.44),
        "by_dataset": {ds: {"people": sum(1 for q in people if q.meta["dataset"] == ds),
                            "events": sum(len(q.onsets) for q in people if q.meta["dataset"] == ds)} for ds in ["phase1", "phase2"]},
        "by_kind": {k: sum(1 for q in people for e in q.events_meta if e["kind"] == k) for k in ["covid_symptom", "covid_test_only", "other_illness"]},
        "median_days_per_person": float(np.median([len(q.x) for q in people])),
    }
    print("cohort", cohort)
    for m in METHODS:
        s = main_tbl[m]["1.0"]
        print(f"{m:8s} det {s['detection_rate']:.2f} [{s['detection_rate_ci'][0]:.2f},{s['detection_rate_ci'][1]:.2f}] by-onset {s['by_onset_rate']:.2f} "
              f"chance {s['chance_detection_rate']:.2f} lead {s['median_lead']:.1f} FA {s['fa_per_person_month']:.2f} [{s['fa_per_person_month_ci'][0]:.2f},{s['fa_per_person_month_ci'][1]:.2f}]")

    # ---------------- by event kind and by dataset, for the deployed method ----------------
    breakdown = {}
    for b in [0.25, 1.0]:
        rows = res["outcomes"][DEPLOYED][b]
        fx = res["outcomes"]["fixed"][b]
        bd = {}
        for k in ["covid_symptom", "covid_test_only", "other_illness"]:
            bd[k] = {"deployed": bootstrap(subset(rows, people, lambda q, i, k=k: q.events_meta[i]["kind"] == k), 1000, SEED),
                     "fixed": bootstrap(subset(fx, people, lambda q, i, k=k: q.events_meta[i]["kind"] == k), 1000, SEED)}
        for ds in ["phase1", "phase2"]:
            idx = [i for i, q in enumerate(people) if q.meta["dataset"] == ds]
            bd[ds] = {"deployed": bootstrap([rows[i] for i in idx], 1000, SEED), "fixed": bootstrap([fx[i] for i in idx], 1000, SEED)}
        for dev in ["Fitbit", "AppleWatch"]:
            idx = [i for i, q in enumerate(people) if q.meta["device"] == dev]
            bd["device_" + dev] = {"deployed": bootstrap([rows[i] for i in idx], 1000, SEED)}
        breakdown[str(b)] = bd
    diffs = {str(b): {m: paired_diff(res["outcomes"][m][b], res["outcomes"]["fixed"][b], 2000, SEED) for m in METHODS if m != "fixed"} for b in BUDGETS}

    # ---------------- lead-time distribution (deployed method, both tiers) ----------------
    leads = {str(b): [l for r in res["outcomes"][DEPLOYED][b] for l, s in zip(r["leads"], r["scorable"]) if s] for b in [0.25, 1.0]}

    # ---------------- false alerts over long quiet stretches: people with no reported illness ----------------
    quiet_people = [i for i, q in enumerate(people) if not q.onsets]
    fa_dist = {}
    for b in [0.25, 1.0]:
        rows = [res["outcomes"][DEPLOYED][b][i] for i in quiet_people]
        per = sorted(((r["fa"], r["quiet_days"] / 30.44) for r in rows if r["quiet_days"] >= 30), key=lambda t: -t[0])
        tot = sum(f for f, _ in per)
        top = max(1, len(per) // 5)
        fa_dist[str(b)] = {
            **{k: v for k, v in bootstrap(rows, 2000, SEED).items() if k.startswith("fa_") or k in ("quiet_person_months", "false_alerts", "n_people", "quiet_days_in_alert_frac")},
            "share_of_people_with_zero": sum(1 for f, _ in per if f == 0) / max(1, len(per)),
            "share_of_alerts_from_top_fifth": (sum(f for f, _ in per[:top]) / tot) if tot else 0.0,
            "per_person_rate_hist": np.histogram([f / m for f, m in per], bins=[0, 0.001, 0.5, 1, 2, 3, 5, 100])[0].tolist(),
            "hist_edges": ["0", "up to 0.5", "0.5 to 1", "1 to 2", "2 to 3", "3 to 5", "over 5"],
        }
    # by phase-2 group (non_positive is not confirmed healthy) and phase-1 (no reported illness)
    fa_by_group = {}
    for grp in ["no_reported_illness", "non_positive"]:
        idx = [i for i, q in enumerate(people) if q.meta["group"] == grp]
        fa_by_group[grp] = {str(b): bootstrap([res["outcomes"][DEPLOYED][b][i] for i in idx], 1000, SEED) for b in [0.25, 1.0]}

    # ---------------- ablations: indicator sets and model components ----------------
    abl = {}
    for key in ["rhr", "rhr_steps", "rhr_rhrday_steps"]:
        pe = load_people(SPECS[key]["indicators"])
        r = res if key == "rhr_steps" else run(key, pe, w, p)
        abl[key] = {"label": SPEC_LABELS[key], "n_people": len(pe), "n_events": sum(len(q.onsets) for q in pe),
                    **{m: {str(b): bootstrap(r["outcomes"][m][b], 1000, SEED) for b in [0.25, 1.0]} for m in METHODS}}
    # covariate adjustment: yesterday's steps -> resting heart rate
    r_adj = run("rhr_steps", people, w, p, adjust=[("rhr", "steps", 1)], methods=[DEPLOYED])
    abl["rhr_steps_adjusted"] = {"label": "… + adjust heart rate for the previous day's steps", "n_people": len(people), "n_events": n_ev,
                                 "beta": [float(m.adjust[0][3]) for m in r_adj["models"]],
                                 DEPLOYED: {str(b): bootstrap(r_adj["outcomes"][DEPLOYED][b], 1000, SEED) for b in [0.25, 1.0]}}
    # the subset with sleep data (phase 1 COVID-19 participants only): same people, with and without sleep
    ps = [q for q in load_people(["rhr", "steps", "sleep_h"]) if np.sum(~np.isnan(q.x[:, 2])) >= MIN_DAYS]
    if len(ps) >= 15:
        ra = cv_run(ps, SPECS["rhr_steps_sleep"], p, w, [1.0], k=5, seed=SEED, methods=[DEPLOYED], strat=[1 if q.onsets else 0 for q in ps])
        ps2 = [Person(pid=q.pid, x=q.x[:, :2], onsets=q.onsets, meta=q.meta, events_meta=q.events_meta) for q in ps]
        rb = cv_run(ps2, SPECS["rhr_steps"], p, w, [1.0], k=5, seed=SEED, methods=[DEPLOYED], strat=[1 if q.onsets else 0 for q in ps2])
        abl["sleep_subset"] = {"n_people": len(ps), "n_events": sum(len(q.onsets) for q in ps),
                               "with_sleep": bootstrap(ra["outcomes"][DEPLOYED][1.0], 1000, SEED), "without_sleep": bootstrap(rb["outcomes"][DEPLOYED][1.0], 1000, SEED),
                               "note": "Only the phase 1 COVID-19 participants have sleep files, so nobody in this subset is illness-free and the false-alert estimate rests on little quiet time."}
    # window sensitivity for the deployed method
    win = {}
    for pre, post in [(14, 7), (10, 4), (7, 0), (3, 0)]:
        w2 = Windows(det_pre=pre, det_post=post)
        rows = [person_outcome(res["scores"][DEPLOYED][i], res["thr_person"][DEPLOYED][1.0][i], q.onsets, w2, p.merge_gap) for i, q in enumerate(people)]
        ch = chance_rows(people, res["scores"][DEPLOYED], res["thr_person"][DEPLOYED][1.0], w2, p.merge_gap, 5, SEED)
        win[f"-{pre}..+{post}"] = {"detection_rate": aggregate(rows)["detection_rate"], "chance": aggregate(ch)["detection_rate"]}

    # ---------------- event-aligned resting heart rate (also used for simulator realism) ----------------
    rel = np.arange(-21, 15)
    curves = []
    for q in people:
        for o, em in zip(q.onsets, q.events_meta):
            if em["kind"] == "covid_test_only":
                continue
            base = q.x[max(0, o - 49):max(0, o - 21), 0]
            if np.sum(~np.isnan(base)) < 10:
                continue
            row = np.array([q.x[o + r, 0] - np.nanmedian(base) if 0 <= o + r < len(q.x) else np.nan for r in rel])
            curves.append(row)
    curves = np.array(curves)
    rng = np.random.default_rng(SEED)
    boot = np.array([np.nanmean(curves[rng.integers(0, len(curves), len(curves))], axis=0) for _ in range(1000)])
    aligned = {"rel_day": rel.tolist(), "mean": np.nanmean(curves, axis=0), "lo": np.percentile(boot, 2.5, axis=0), "hi": np.percentile(boot, 97.5, axis=0),
               "n_events": int(len(curves)), "n_per_day": np.sum(~np.isnan(curves), axis=0)}

    write_json(APP_PUBLIC / "results" / "real_eval.json", {
        "script": "research/scripts/eval_real.py", "commit": git_commit(), "seed": SEED,
        "data": "Stanford COVID-19 wearables phase 1 (Mishra et al. 2020) and phase 2 subset (Alavi et al. 2022)",
        "indicators": SPEC_LABELS["rhr_steps"], "windows": {"det_pre": w.det_pre, "det_post": w.det_post, "excl_pre": w.excl_pre, "excl_post": w.excl_post},
        "budgets": BUDGETS, "deployed": DEPLOYED, "methods": METHODS, "method_labels": METHOD_LABELS, "cohort": cohort, "main": main_tbl, "breakdown": breakdown,
        "diff_vs_fixed": diffs, "leads": leads, "false_alerts_quiet": fa_dist, "false_alerts_by_group": fa_by_group, "ablation": abl,
        "window_sensitivity": win, "event_aligned_rhr": aligned,
        "published": {"source": "Mishra et al. 2020 (DOMAIN.md ref 58), phase 1 only, their own online CuSum on hourly data",
                      "presymptomatic_detection": 0.63, "false_alarms_per_month_healthy": 0.66,
                      "note": "Different features, protocol and people subset; shown for orientation, not as a like-for-like comparison."},
    }, indent=1)
    print("wrote real_eval.json")


if __name__ == "__main__":
    main()
