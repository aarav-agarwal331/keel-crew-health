"""make validate (part 1): detection performance on REAL wearable data with labeled illness.

Data: Stanford COVID-19 wearables phase 1 (Mishra et al. 2020) and phase 2 subset (Alavi et al.
2022), reduced to daily features by build_daily.py.  Protocol in docs/METHOD.md section 6:
5-fold cross-validation over people, thresholds calibrated on training people to a false-alert
budget, cluster bootstrap over people for 95% intervals, pseudo-events for the chance level, and
every comparison between methods made NET OF LUCK (detection rate minus that method's own
chance rate).
Output: app/public/results/real_eval.json
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I

import numpy as np
import pandas as pd

from keel import realdata
from keel.core import Params
from keel.evaluate import (METHOD_LABELS, METHODS, Person, Windows, aggregate, bootstrap, calibrate, chance_rows, cv_run, fit_model,
                           net_stats, person_outcome, score_people)
from keel.mission import SPEC2, ground_people
from keel.export import APP_PUBLIC, code_version, git_commit, write_json

INTERIM = ROOT / "data" / "interim"
BUDGETS = [0.25, 0.5, 1.0, 2.0, 4.0]
SEED = 20261112
SPECS = {
    "rhr": {"indicators": ["rhr"], "transform": ["none"], "concern": [1], "floor": [1.5]},
    "rhr_steps": {"indicators": ["rhr", "steps"], "transform": ["none", "log"], "concern": [1, -1], "floor": [1.5, 0.25]},
    "rhr_act7": {"indicators": ["rhr", "act7"], "transform": ["none", "log"], "concern": [1, -1], "floor": [1.5, 0.05]},
    "rhr_rhrday_steps": {"indicators": ["rhr", "rhr_day", "steps"], "transform": ["none", "none", "log"], "concern": [1, 1, -1], "floor": [1.5, 1.5, 0.25]},
    "rhr_steps_sleep": {"indicators": ["rhr", "steps", "sleep_h"], "transform": ["none", "log", "none"], "concern": [1, -1, 0], "floor": [1.5, 0.25, 0.5]},
}
SPEC_LABELS = {"rhr": "Resting heart rate only", "rhr_steps": "Resting heart rate + daily steps",
               "rhr_act7": "Resting heart rate + 7-day mean of steps",
               "rhr_steps_sleep": "Resting heart rate + steps + sleep duration",
               "rhr_rhrday_steps": "Night and whole-day resting heart rate + steps (exploratory, added after seeing the main result)"}
MIN_DAYS = 28   # a person needs at least this many days with resting heart rate
# the detector the app deploys, chosen on simulated TRAINING missions by fit_mission_model.py (never on this data)
DEPLOYED = json.loads((APP_PUBLIC / "data" / "model_mission.json").read_text())["deployed"]
# in-flight rate of upper-respiratory symptoms on the ISS: 0.97 per flight-year (Crucian et al. 2016, DOMAIN ref 52b)
URI_PER_PERSON_MONTH = 0.97 / 12
# pid -> device group.  Pretend events are weighted to the device mix of the real episodes (83% Fitbit),
# because devices differ in how often they alert.  Filled in main().
STRATA: dict[str, str] = {}


def rolling_mean(v: np.ndarray, n: int = 7, min_valid: int = 4) -> np.ndarray:
    out = np.full(len(v), np.nan)
    for t in range(len(v)):
        w = v[max(0, t - n + 1):t + 1]
        w = w[~np.isnan(w)]
        if len(w) >= min_valid:
            out[t] = w.mean()
    return out


def load_people(cols: list[str], flow: dict | None = None) -> list[Person]:
    daily = pd.read_csv(INTERIM / "stanford_daily.csv", parse_dates=["date"])
    events = pd.read_csv(INTERIM / "stanford_events.csv", parse_dates=["date"])
    meta = pd.read_csv(INTERIM / "stanford_people.csv").set_index(["dataset", "pid"])
    out = []
    for (ds, pid), g in daily.groupby(["dataset", "pid"], sort=True):
        g = g.sort_values("date")
        grp, dev = meta.loc[(ds, pid), "group"], meta.loc[(ds, pid), "device"]
        if flow is not None:
            flow.setdefault("downloaded", {}).setdefault(f"{ds}:{grp}", 0)
            flow["downloaded"][f"{ds}:{grp}"] += 1
        if g["rhr"].notna().sum() < MIN_DAYS:
            if flow is not None:
                flow.setdefault("excluded_under_28_nights", {}).setdefault(f"{ds}:{grp}:{dev}", 0)
                flow["excluded_under_28_nights"][f"{ds}:{grp}:{dev}"] += 1
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
        outside = len([a for a in anchors if not 0 <= a[0] < len(g)])
        anchors = sorted(a for a in anchors if 0 <= a[0] < len(g))
        merged: list[tuple[int, str]] = []
        for a in anchors:   # episodes less than four weeks apart are one illness period
            if not merged or a[0] - merged[-1][0] > 28:
                merged.append(a)
        g = g.assign(act7=rolling_mean(g["steps"].where(g["steps"] > 0).to_numpy(float)))
        x = g[cols].to_numpy(float)
        if "steps" in cols:
            j = cols.index("steps")
            x[x[:, j] <= 0, j] = np.nan
        out.append(Person(pid=f"{ds}:{pid}", x=x, onsets=[a[0] for a in merged],
                          meta={"dataset": ds, "group": grp, "device": dev, "mode": str(meta.loc[(ds, pid), "mode"]), "labels_outside_span": outside},
                          events_meta=[{"kind": a[1]} for a in merged]))
    return out


def subset(rows: list[dict], people: list[Person], pred) -> list[dict]:
    """Keep each person's quiet time, but only the events for which pred(person, k) is true."""
    out = []
    for r, q in zip(rows, people):
        keep = [k for k in range(len(q.onsets)) if pred(q, k)]
        out.append({**r, "leads": [r["leads"][k] for k in keep], "scorable": [r["scorable"][k] for k in keep]})
    return out


def run(spec_key: str, people: list[Person], w: Windows, p: Params, adjust=None, methods=METHODS, seed=SEED, budgets=BUDGETS) -> dict:
    strat = [1 if q.onsets else 0 for q in people]
    return cv_run(people, SPECS[spec_key], p, w, budgets, k=5, seed=seed, methods=methods, adjust_spec=adjust, strat=strat)


def chance_for(res: dict, people: list[Person], m: str, b: float, w: Windows, p: Params, **kw) -> list[dict]:
    return chance_rows(people, res["scores"][m], res["thr_person"][m][b], w, p.merge_gap, per_person=5, seed=SEED, **{"scored_only": False, **kw})


def with_net(rows, ch, other=None, n_boot=2000, strata="default"):
    """Detection, its chance level (device-weighted to the real episodes) and detection above luck."""
    st = bootstrap(rows, n_boot, SEED)
    c = aggregate(ch)
    ns = net_stats(rows, ch, n_boot, SEED, other, STRATA if strata == "default" else strata)
    st["chance_pooled"] = c["detection_rate"]
    st["chance_detection_rate"] = ns.pop("chance_used")
    st["chance_by_onset_rate"] = ns.pop("chance_by_onset_used")
    st["n_pseudo_events"] = c["n_events"]
    st.update(ns)
    # the same gain as a share of what luck leaves to be found
    st["net_rescaled"] = st["net_detection"] / (1 - st["chance_detection_rate"]) if st["chance_detection_rate"] < 1 else float("nan")
    return st


def summarise(res: dict, people: list[Person], w: Windows, p: Params, methods=METHODS, budgets=BUDGETS) -> dict:
    out = {m: {} for m in methods}
    for b in budgets:
        ch = {m: chance_for(res, people, m, b, w, p) for m in methods}
        for m in methods:
            other = (res["outcomes"]["fixed"][b], ch["fixed"]) if m != "fixed" and "fixed" in methods else None
            out[m][str(b)] = with_net(res["outcomes"][m][b], ch[m], other)
            if m == DEPLOYED and "zscore" in methods and m != "zscore":
                d = net_stats(res["outcomes"][m][b], ch[m], 2000, SEED, (res["outcomes"]["zscore"][b], ch["zscore"]), STRATA)
                out[m][str(b)]["net_diff_vs_zscore"], out[m][str(b)]["net_diff_vs_zscore_ci"] = d["net_diff"], d["net_diff_ci"]
    return out


def train_test(train: list[Person], test: list[Person], spec_key: str, w: Windows, p: Params, budgets=(0.25, 1.0)) -> dict:
    """Fit and calibrate on one group of people, score another once."""
    model = fit_model(train, SPECS[spec_key], p, w)
    tr = [s[DEPLOYED] for s in score_people(train, model, p)]
    te = [s[DEPLOYED] for s in score_people(test, model, p)]
    out = {}
    for b in budgets:
        thr = calibrate(tr, [q.onsets for q in train], b, w, p.merge_gap)
        rows = [{**person_outcome(s, thr, q.onsets, w, p.merge_gap), "pid": q.pid} for s, q in zip(te, test)]
        ch = chance_rows(test, te, [thr] * len(test), w, p.merge_gap, 5, SEED, scored_only=False)
        out[str(b)] = with_net(rows, ch, None, 1000)
    return out


def main():
    p, w = Params(), Windows()
    # ---------------- cohort ----------------
    flow: dict = {}
    people = load_people(["rhr", "steps"], flow)
    n_ev = sum(len(q.onsets) for q in people)
    STRATA.update({q.pid: ("Fitbit" if q.meta["device"] == "Fitbit" else "other") for q in people})
    quiet_groups = {}
    for q in people:
        if not q.onsets:
            key = ("phase 1, no illness reported" if q.meta["group"] == "no_reported_illness" else
                   "phase 2, not in the positives table (never confirmed healthy)" if q.meta["group"] == "non_positive" else
                   "illness reported, but dated outside the recording")
            quiet_groups[key] = quiet_groups.get(key, 0) + 1
    cohort = {
        "n_downloaded": int(sum(flow["downloaded"].values())), "downloaded_by_group": flow["downloaded"],
        "excluded_under_28_nights": int(sum(flow.get("excluded_under_28_nights", {}).values())), "excluded_detail": flow.get("excluded_under_28_nights", {}),
        "n_people": len(people), "n_with_event": sum(1 for q in people if q.onsets), "n_events": n_ev,
        "person_days": int(sum(len(q.x) for q in people)),
        "by_dataset": {ds: {"people": sum(1 for q in people if q.meta["dataset"] == ds),
                            "events": sum(len(q.onsets) for q in people if q.meta["dataset"] == ds)} for ds in ["phase1", "phase2"]},
        "by_kind": {k: sum(1 for q in people for e in q.events_meta if e["kind"] == k) for k in ["covid_symptom", "covid_test_only", "other_illness"]},
        "by_device": {d: sum(1 for q in people if q.meta["device"] == d) for d in sorted({q.meta["device"] for q in people})},
        "events_by_mode": {m: sum(len(q.onsets) for q in people if q.meta["dataset"] == "phase2" and q.meta["mode"] == m) for m in ["retrospective", "prospective"]},
        "excluded_with_illness": int(sum(v for k, v in flow.get("excluded_under_28_nights", {}).items() if k.split(":")[1] not in ("no_reported_illness", "non_positive"))),
        "excluded_with_illness_by_device": {d: int(sum(v for k, v in flow.get("excluded_under_28_nights", {}).items() if k.split(":")[1] not in ("no_reported_illness", "non_positive") and k.split(":")[2] == d))
                                            for d in sorted({k.split(":")[2] for k in flow.get("excluded_under_28_nights", {})})},
        "events_by_device": {d: sum(len(q.onsets) for q in people if STRATA[q.pid] == d) for d in ["Fitbit", "other"]},
        "quiet_people": quiet_groups, "median_days_per_person": float(np.median([len(q.x) for q in people])),
        "sampling_note": "Phase 1: 120 recordings from 118 people (one person has three short recordings, all excluded for length). Phase 2 is a subset of the release: all 84 positives, plus the first 60 Fitbit and first 60 other-device participant IDs in sorted order (not a random draw). Dates are shifted per person by the data owners, so pretend events cannot be matched to the calendar: lockdowns and isolation after a positive test are tangled up with onset.",
    }

    # ---------------- main analysis ----------------
    res = run("rhr_steps", people, w, p)
    main_tbl = summarise(res, people, w, p)
    cohort["quiet_person_months_scored"] = main_tbl[DEPLOYED]["1.0"]["quiet_person_months"]
    print("cohort", {k: cohort[k] for k in ["n_downloaded", "excluded_under_28_nights", "n_people", "n_events", "by_kind", "by_device", "events_by_mode", "quiet_people"]})
    for m in METHODS:
        s = main_tbl[m]["1.0"]
        s2 = main_tbl[m]["0.25"]
        print(f"{m:8s} @1 det {s['detection_rate']:.2f} chance {s['chance_detection_rate']:.2f} net {s['net_detection']:.2f} [{s['net_detection_ci'][0]:.2f},{s['net_detection_ci'][1]:.2f}]"
              f" FA {s['fa_per_person_month']:.2f} | @0.25 det {s2['detection_rate']:.2f} net {s2['net_detection']:.2f} [{s2['net_detection_ci'][0]:.2f},{s2['net_detection_ci'][1]:.2f}]"
              + (f" | net diff vs fixed @1 {s['net_diff']:.2f} [{s['net_diff_ci'][0]:.2f},{s['net_diff_ci'][1]:.2f}]" if "net_diff" in s else ""))

    # ---------------- how sensitive is "luck" to the way pretend events are drawn? ----------------
    chance_sens = {}
    ill_idx = [i for i, q in enumerate(people) if q.onsets]
    for b in [0.25, 1.0]:
        rows = res["outcomes"][DEPLOYED][b]
        ch = chance_for(res, people, DEPLOYED, b, w, p)
        ch_by = {r["pid"]: r for r in ch}
        old = chance_for(res, people, DEPLOYED, b, w, p, scored_only=True)
        pick = lambda st: {k: st[k] for k in ("chance_detection_rate", "net_detection", "net_detection_ci")}  # noqa: E731
        chance_sens[str(b)] = {
            "device_weighted": pick(with_net(rows, ch, None, 1000)),
            "pooled_over_all_people": pick(with_net(rows, ch, None, 1000, strata=None)),
            "only_people_who_had_an_episode": pick(with_net([rows[i] for i in ill_idx], [ch_by[people[i].pid] for i in ill_idx if people[i].pid in ch_by], None, 1000, strata=None)),
            "windows_with_a_score_every_day": pick(with_net(rows, old, None, 1000, strata=None)),
        }
    print("chance sensitivity @1", {k: (round(v["chance_detection_rate"], 3), round(v["net_detection"], 3)) for k, v in chance_sens["1.0"].items()})

    # ---------------- sensitivity: an alert already open in the window also counts ----------------
    open_alert = {}
    for b in [0.25, 1.0]:
        rr, cc = {}, {}
        for m in ["fixed", "zscore", DEPLOYED]:
            rr[m] = [{**person_outcome(res["scores"][m][i], res["thr_person"][m][b][i], q.onsets, w, p.merge_gap, count_open=True), "pid": q.pid} for i, q in enumerate(people)]
            cc[m] = chance_for(res, people, m, b, w, p, count_open=True)
        open_alert[str(b)] = {m: with_net(rr[m], cc[m], (rr["fixed"], cc["fixed"]) if m != "fixed" else None, 1000) for m in rr}
    print("open-alert @1", {m: (round(v["detection_rate"], 2), round(v["chance_detection_rate"], 2), round(v["net_detection"], 2), [round(x, 2) for x in v.get("net_diff_ci", [])]) for m, v in open_alert["1.0"].items()})

    # ---------------- breakdowns for the deployed detector ----------------
    breakdown = {}
    for b in [0.25, 1.0]:
        rows = res["outcomes"][DEPLOYED][b]
        ch = chance_for(res, people, DEPLOYED, b, w, p)
        ch_by = {r["pid"]: r for r in ch}
        bd = {}
        for k in ["covid_symptom", "covid_test_only", "other_illness"]:
            bd[k] = with_net(subset(rows, people, lambda q, i, k=k: q.events_meta[i]["kind"] == k), ch, None, 1000)
        for key, pred in [("phase1", lambda q: q.meta["dataset"] == "phase1"), ("phase2", lambda q: q.meta["dataset"] == "phase2"),
                          ("device_Fitbit", lambda q: q.meta["device"] == "Fitbit"), ("device_other", lambda q: q.meta["device"] != "Fitbit"),
                          ("phase2_retrospective", lambda q: q.meta["dataset"] == "phase2" and (q.meta["mode"] == "retrospective" or not q.onsets)),
                          ("phase2_prospective", lambda q: q.meta["dataset"] == "phase2" and (q.meta["mode"] == "prospective" or not q.onsets))]:
            idx = [i for i, q in enumerate(people) if pred(q)]
            bd[key] = with_net([rows[i] for i in idx], [ch_by[people[i].pid] for i in idx if people[i].pid in ch_by], None, 1000)
        breakdown[str(b)] = bd

    # ---------------- lead times ----------------
    leads = {str(b): [l if s else None for r in res["outcomes"][DEPLOYED][b] for l, s in zip(r["leads"], r["scorable"])] for b in [0.25, 1.0]}

    # ---------------- false alerts over long quiet stretches ----------------
    quiet_people = [i for i, q in enumerate(people) if not q.onsets]
    fa_dist = {}
    for b in [0.25, 1.0]:
        rows = [res["outcomes"][DEPLOYED][b][i] for i in quiet_people]
        per = sorted(((r["fa"], r["quiet_days"] / 30.44) for r in rows if r["quiet_days"] >= 30), key=lambda t: -t[0])
        tot = sum(f for f, _ in per)
        top = max(1, len(per) // 5)
        # what a constant-rate (Poisson) process with the same exposure would give for the top fifth
        rng = np.random.default_rng(SEED)
        rate = tot / max(1e-9, sum(m for _, m in per))
        pois = []
        for _ in range(500):
            c = np.sort(rng.poisson([rate * m for _, m in per]))[::-1]
            pois.append(c[:top].sum() / max(1, c.sum()))
        fa_dist[str(b)] = {
            **{k: v for k, v in bootstrap(rows, 2000, SEED).items() if k.startswith("fa_") or k in ("quiet_person_months", "false_alerts", "n_people", "quiet_days_in_alert_frac")},
            "n_people_30_days": len(per), "share_of_people_with_zero": sum(1 for f, _ in per if f == 0) / max(1, len(per)),
            "share_of_alerts_from_top_fifth": (sum(f for f, _ in per[:top]) / tot) if tot else 0.0, "top_fifth_if_constant_rate": float(np.mean(pois)),
            "per_person_rate_hist": np.histogram([f / m for f, m in per], bins=[0, 0.001, 0.5, 1, 2, 3, 5, 100])[0].tolist(),
            "hist_edges": ["0", "up to 0.5", "0.5 to 1", "1 to 2", "2 to 3", "3 to 5", "over 5"],
        }
    fa_by_group = {}
    for grp in ["no_reported_illness", "non_positive"]:
        idx = [i for i, q in enumerate(people) if q.meta["group"] == grp and not q.onsets]
        fa_by_group[grp] = {str(b): bootstrap([res["outcomes"][DEPLOYED][b][i] for i in idx], 1000, SEED) for b in [0.25, 1.0]}

    # ---------------- what an alert means: predictive value at an in-flight illness rate ----------------
    ppv = {}
    for b in ["0.25", "1.0"]:
        s = main_tbl[DEPLOYED][b]
        true_rate = max(0.0, s["net_detection"]) * URI_PER_PERSON_MONTH
        ppv[b] = {"true_alerts_per_person_month": true_rate, "false_alerts_per_person_month": s["fa_per_person_month"],
                  "share_of_alerts_that_are_real": true_rate / (true_rate + s["fa_per_person_month"])}
    ppv["assumption"] = "Illness rate 0.97 per person-year (upper-respiratory symptoms on the ISS, DOMAIN ref 52b); sensitivity = detection net of luck on real data."

    # how far do steps fall around onset?  (median over episodes of the person's median daily steps)
    j_steps = 1
    base, pre, post = [], [], []
    for q in people:
        for o in q.onsets:
            b_ = q.x[max(0, o - 49):max(0, o - 21), j_steps]
            if np.sum(~np.isnan(b_)) < 10:
                continue
            base.append(np.nanmedian(b_))
            pre.append(np.nanmedian(q.x[max(0, o - 10):o, j_steps]) if np.any(~np.isnan(q.x[max(0, o - 10):o, j_steps])) else np.nan)
            post.append(np.nanmedian(q.x[o:o + 5, j_steps]) if np.any(~np.isnan(q.x[o:o + 5, j_steps])) else np.nan)
    steps_drop = {"n_episodes": len(base), "baseline_median": float(np.nanmedian(base)), "ten_days_before_median": float(np.nanmedian(pre)),
                  "onset_to_day4_median": float(np.nanmedian(post))}

    # ---------------- ablations ----------------
    abl = {}
    for key in ["rhr", "rhr_steps", "rhr_act7", "rhr_rhrday_steps"]:
        pe = load_people(SPECS[key]["indicators"])
        r = res if key == "rhr_steps" else run(key, pe, w, p, methods=["fixed", DEPLOYED], budgets=[0.25, 1.0])
        abl[key] = {"label": SPEC_LABELS[key], "n_people": len(pe), "n_events": sum(len(q.onsets) for q in pe),
                    **{m: {str(b): with_net(r["outcomes"][m][b], chance_for(r, pe, m, b, w, p),
                                            (r["outcomes"]["fixed"][b], chance_for(r, pe, "fixed", b, w, p)) if m != "fixed" else None, 2000) for b in [0.25, 1.0]} for m in ["fixed", DEPLOYED]}}
        abl[key]["both_tiers"] = True
        if key == "rhr_act7":
            # this is the activity feature the app itself uses (a 7-day average), so its predictive value is reported too
            for b in ["0.25", "1.0"]:
                sx = abl[key][DEPLOYED][b]
                tr_ = max(0.0, sx["net_detection"]) * URI_PER_PERSON_MONTH
                ppv[b]["with_7_day_activity"] = tr_ / (tr_ + sx["fa_per_person_month"])
            # like-for-like with the simulator: symptom-dated episodes of people the simulator's
            # illness calibration never saw (validation half), same two channels as eval_sim.py
            _, val_e = realdata.split_half(realdata.event_pids(pd.read_csv(INTERIM / "stanford_events.csv")), seed=11)
            like = {}
            for b in [0.25, 1.0]:
                rows = subset(r["outcomes"][DEPLOYED][b], pe, lambda q, i: q.events_meta[i]["kind"] == "covid_symptom" and q.pid in val_e)
                like[str(b)] = with_net(rows, chance_for(r, pe, DEPLOYED, b, w, p), None, 1000)
            abl["like_for_like_real"] = {"label": "Symptom-dated episodes of the validation half, resting heart rate + 7-day mean activity", **like}
    r_adj = run("rhr_steps", people, w, p, adjust=[("rhr", "steps", 1)], methods=[DEPLOYED], budgets=[0.25, 1.0])
    abl["rhr_steps_adjusted"] = {"label": "… + adjust heart rate for the previous day's steps", "n_people": len(people), "n_events": n_ev,
                                 "beta": [float(m.adjust[0][3]) for m in r_adj["models"]],
                                 DEPLOYED: {str(b): with_net(r_adj["outcomes"][DEPLOYED][b], chance_for(r_adj, people, DEPLOYED, b, w, p), None, 1000) for b in [0.25, 1.0]}}
    ps = [q for q in load_people(["rhr", "steps", "sleep_h"]) if np.sum(~np.isnan(q.x[:, 2])) >= MIN_DAYS]
    if len(ps) >= 15:
        ra = cv_run(ps, SPECS["rhr_steps_sleep"], p, w, [1.0], k=5, seed=SEED, methods=[DEPLOYED], strat=[1 if q.onsets else 0 for q in ps])
        ps2 = [Person(pid=q.pid, x=q.x[:, :2], onsets=q.onsets, meta=q.meta, events_meta=q.events_meta) for q in ps]
        rb = cv_run(ps2, SPECS["rhr_steps"], p, w, [1.0], k=5, seed=SEED, methods=[DEPLOYED], strat=[1 if q.onsets else 0 for q in ps2])
        abl["sleep_subset"] = {"n_people": len(ps), "n_events": sum(len(q.onsets) for q in ps),
                               "with_sleep": bootstrap(ra["outcomes"][DEPLOYED][1.0], 1000, SEED), "without_sleep": bootstrap(rb["outcomes"][DEPLOYED][1.0], 1000, SEED),
                               "note": "Only the phase 1 COVID-19 participants have sleep files, so nobody in this subset is illness-free and the false-alert estimate rests on little quiet time."}

    # ---------------- robustness: window, other splits of the people, other fold seeds ----------------
    win = {}
    for pre, post in [(14, 7), (10, 4), (7, 0), (3, 0)]:
        w2 = Windows(det_pre=pre, det_post=post)
        rr, cc = {}, {}
        for m in ["fixed", DEPLOYED]:
            rr[m] = [{**person_outcome(res["scores"][m][i], res["thr_person"][m][1.0][i], q.onsets, w2, p.merge_gap), "pid": q.pid} for i, q in enumerate(people)]
            cc[m] = chance_rows(people, res["scores"][m], res["thr_person"][m][1.0], w2, p.merge_gap, 5, SEED, scored_only=False)
        st = with_net(rr[DEPLOYED], cc[DEPLOYED], (rr["fixed"], cc["fixed"]), 1000)
        win[f"-{pre}..+{post}"] = {"detection_rate": st["detection_rate"], "chance": st["chance_detection_rate"], "net": st["net_detection"], "net_ci": st["net_detection_ci"],
                                   "net_diff_vs_fixed": st["net_diff"], "net_diff_vs_fixed_ci": st["net_diff_ci"]}
    p1 = [q for q in people if q.meta["dataset"] == "phase1"]
    p2 = [q for q in people if q.meta["dataset"] == "phase2"]
    cross = {"train_phase1_test_phase2": train_test(p1, p2, "rhr_steps", w, p), "train_phase2_test_phase1": train_test(p2, p1, "rhr_steps", w, p)}
    seeds = {}
    for sd in [1, 2, 3, 4, 5]:
        r = run("rhr_steps", people, w, p, methods=[DEPLOYED], seed=sd, budgets=[0.25, 1.0])
        seeds[str(sd)] = {str(b): {k: v for k, v in with_net(r["outcomes"][DEPLOYED][b], chance_rows(people, r["scores"][DEPLOYED], r["thr_person"][DEPLOYED][b], w, p.merge_gap, 5, sd, scored_only=False), None, 200).items()
                                   if k in ("detection_rate", "net_detection", "fa_per_person_month", "chance_detection_rate")} for b in [0.25, 1.0]}
    print("cross-phase", {k: {b: (round(v[b]["detection_rate"], 2), round(v[b]["net_detection"], 2), round(v[b]["fa_per_person_month"], 2)) for b in v} for k, v in cross.items()})
    print("fold seeds net@1", [round(v["1.0"]["net_detection"], 2) for v in seeds.values()], "det@1", [round(v["1.0"]["detection_rate"], 2) for v in seeds.values()])

    # ---------------- the app's own configuration on real people ----------------
    # The app cannot calibrate on real people in flight: its model and thresholds come from the
    # simulator.  So score real people with a model fitted on simulated ground people (heart rate +
    # 7-day activity, the two channels both sides have) at the simulator-calibrated thresholds.
    # "Held out" = people neither the simulator's noise fit nor its illness fit ever saw.
    pe7 = load_people(SPECS["rhr_act7"]["indicators"])
    g_tr = ground_people(40, 70000)
    g_model = fit_model(g_tr, SPEC2, p, w)
    g_sc = [x[DEPLOYED] for x in score_people(g_tr, g_model, p)]
    r_sc = [x[DEPLOYED] for x in score_people(pe7, g_model, p)]
    daily_all, events_all, ppl = realdata.stanford()
    qg = ppl[ppl.group.isin(["no_reported_illness", "non_positive"])]
    stq = daily_all.merge(qg[["dataset", "pid"]], on=["dataset", "pid"])
    _, val_s = realdata.split_half(sorted((stq.dataset + ":" + stq.pid).unique()))
    _, val_e2 = realdata.split_half(realdata.event_pids(events_all), seed=11)
    held = [i for i, q in enumerate(pe7) if q.pid in val_s or q.pid in val_e2]
    deployed_cfg = {"label": "Model and thresholds from the simulator, heart rate + 7-day activity, applied unchanged to real people",
                    "n_people_all": len(pe7), "n_events_all": sum(len(q.onsets) for q in pe7),
                    "n_people_held_out": len(held), "n_events_held_out": sum(len(pe7[i].onsets) for i in held), "all": {}, "held_out": {}}
    for b in [0.25, 1.0]:
        thr = calibrate(g_sc, [q.onsets for q in g_tr], b, w, p.merge_gap)
        rows = [{**person_outcome(sc_, thr, q.onsets, w, p.merge_gap), "pid": q.pid} for sc_, q in zip(r_sc, pe7)]
        ch = chance_rows(pe7, r_sc, [thr] * len(pe7), w, p.merge_gap, 5, SEED, scored_only=False)
        ch_by = {r["pid"]: r for r in ch}
        deployed_cfg["all"][str(b)] = with_net(rows, ch, None, 1000)
        deployed_cfg["held_out"][str(b)] = with_net([rows[i] for i in held], [ch_by[pe7[i].pid] for i in held if pe7[i].pid in ch_by], None, 1000)
    print("deployed config (sim thresholds on real people)", {k: {b: (round(v["detection_rate"], 2), round(v["chance_detection_rate"], 2), round(v["net_detection"], 2), [round(x, 2) for x in v["net_detection_ci"]], round(v["fa_per_person_month"], 2))
                                                                   for b, v in deployed_cfg[k].items()} for k in ["all", "held_out"]})

    # ---------------- event-aligned resting heart rate ----------------
    rel = np.arange(-21, 15)
    curves = []
    for q in people:
        for o, em in zip(q.onsets, q.events_meta):
            if em["kind"] == "covid_test_only":
                continue
            base = q.x[max(0, o - 49):max(0, o - 21), 0]
            if np.sum(~np.isnan(base)) < 10:
                continue
            curves.append(np.array([q.x[o + r, 0] - np.nanmedian(base) if 0 <= o + r < len(q.x) else np.nan for r in rel]))
    curves = np.array(curves)
    rng = np.random.default_rng(SEED)
    boot = np.array([np.nanmean(curves[rng.integers(0, len(curves), len(curves))], axis=0) for _ in range(1000)])
    aligned = {"rel_day": rel.tolist(), "mean": np.nanmean(curves, axis=0), "lo": np.percentile(boot, 2.5, axis=0), "hi": np.percentile(boot, 97.5, axis=0),
               "n_events": int(len(curves)), "n_per_day": np.sum(~np.isnan(curves), axis=0)}

    write_json(APP_PUBLIC / "results" / "real_eval.json", {
        "script": "research/scripts/eval_real.py", "commit": git_commit(), "code_version": code_version(), "seed": SEED,
        "data": "Stanford COVID-19 wearables phase 1 (Mishra et al. 2020) and phase 2 subset (Alavi et al. 2022)",
        "indicators": SPEC_LABELS["rhr_steps"], "windows": {"det_pre": w.det_pre, "det_post": w.det_post, "excl_pre": w.excl_pre, "excl_post": w.excl_post},
        "budgets": BUDGETS, "deployed": DEPLOYED, "methods": METHODS, "method_labels": METHOD_LABELS, "cohort": cohort, "main": main_tbl, "breakdown": breakdown,
        "leads": leads, "false_alerts_quiet": fa_dist, "false_alerts_by_group": fa_by_group, "ppv": ppv, "steps_drop": steps_drop, "ablation": abl,
        "window_sensitivity": win, "chance_sensitivity": chance_sens, "open_alert_sensitivity": open_alert, "deployed_config": deployed_cfg,
        "chance_note": "Pretend events are placed on label-quiet days with the same missing data as real windows, and weighted to the device mix of the real episodes. They cannot be matched to the calendar (dates are shifted per person), so exposure, travel, testing and isolation near a real onset are not reproduced; detection above luck is therefore an upper bound on what physiology alone explains.", "cross_phase": cross, "fold_seeds": seeds, "event_aligned_rhr": aligned,
        "published": {"source": "Mishra et al. 2020 (DOMAIN.md ref 58), phase 1 only, their own online CuSum on hourly data",
                      "presymptomatic_detection": 0.63, "false_alarms_per_month_healthy": 0.66,
                      "note": "Different features, protocol and people subset; shown for orientation, not as a like-for-like comparison."},
    }, indent=1)
    print("wrote real_eval.json")


if __name__ == "__main__":
    main()
