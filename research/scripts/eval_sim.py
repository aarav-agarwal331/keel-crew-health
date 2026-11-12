"""make validate (part 2): detection on SIMULATED missions with injected events.

Everything here is simulation.  Training missions (seeds 5000+) fit the model and thresholds;
test missions (seeds 9000+) are scored once.  Reports the same metrics as the real-data
evaluation, plus event size, event type, missing data, sensor dropout and component ablations.
Output: app/public/results/sim_eval.json
"""
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I

import numpy as np

from keel.core import Params
from keel.evaluate import METHOD_LABELS, METHODS, Windows, aggregate, bootstrap, calibrate, chance_rows, fit_model, net_stats, person_outcome, score_people
from keel.export import APP_PUBLIC, code_version, git_commit, write_json
from keel.mission import SPEC2, detect_spec, ground_people, people_from
from keel.simulator import IND, WEARABLE, CHECKIN, Event, Scenario, apply_missing, random_events, simulate

BUDGETS = [0.25, 0.5, 1.0, 2.0, 4.0]
N_TRAIN, N_TEST = 60, 100   # N_TRAIN must match fit_mission_model.py
SEED_TRAIN, SEED_TEST = 5000, 9000
TYPES = ["illness", "sleep_loss", "co2", "decond", "dehydration", "low_mood"]
TYPE_LABELS = {"illness": "Illness (infection-like)", "sleep_loss": "Sleep restriction", "co2": "Cabin CO2 rise (crew-wide)",
               "decond": "Exercise outage", "dehydration": "Low fluid intake", "low_mood": "Low-mood period"}
import json

DEPLOYED = json.loads((APP_PUBLIC / "data" / "model_mission.json").read_text())["deployed"]   # chosen on training missions by fit_mission_model.py


def missions(n, seed0, events_per=2, **kw):
    rng = np.random.default_rng(seed0)
    out = []
    for s in range(n):
        sc = Scenario()
        sc.events = random_events(rng, sc, events_per, **kw)
        out.append(simulate(sc, seed0 + s))
    return out


def people(ms, seed0, aware=True, ids=None, drop=None, prior_scale=1.0, **miss):
    out = []
    for k, m in enumerate(ms):
        x = apply_missing(m, seed0 + k, **miss)
        if drop:
            for name in drop:
                x[:, :, IND.index("ex_min" if name == "ex7" else name)] = np.nan
        out += people_from(m, x, ids=ids, aware=aware, prior_scale=prior_scale)
    return out


def mission_rows(rows, per=4):
    """Crew of one mission share a cabin, so bootstrap over missions, not over people."""
    out = []
    for i in range(0, len(rows), per):
        g = rows[i:i + per]
        out.append({"fa": sum(r["fa"] for r in g), "quiet_days": sum(r["quiet_days"] for r in g), "alert_days": sum(r["alert_days"] for r in g),
                    "leads": [l for r in g for l in r["leads"]], "scorable": [s for r in g for s in r["scorable"]]})
    return out


def evaluate(train, test, spec, p, w, methods=METHODS, budgets=BUDGETS, keep=False):
    model = fit_model(train, spec, p, w)
    tr = score_people(train, model, p)
    te = score_people(test, model, p)
    on = [q.onsets for q in train]
    out, thr = {}, {}
    for m in methods:
        out[m] = {}
        for b in budgets:
            t = calibrate([s[m] for s in tr], on, b, w, p.merge_gap)
            thr[(m, b)] = t
            out[m][b] = [{**person_outcome(s[m], t, q.onsets, w, p.merge_gap), "pid": q.pid} for s, q in zip(te, test)]
    return (out, thr, te, model) if keep else out


def sc_len() -> int:
    return Scenario().flight_days


def by_mission(rows):
    """Merge rows (real outcomes or pseudo-event rows) of crewmates into one row per mission,
    so bootstrap intervals resample missions.  pids look like '<scenario>-<seed>-c<i>'."""
    out: dict[str, dict] = {}
    for r in rows:
        key = r["pid"].rsplit("-c", 1)[0]
        g = out.setdefault(key, {"pid": key, "fa": 0, "quiet_days": 0, "alert_days": 0, "leads": [], "scorable": []})
        g["fa"] += r["fa"]
        g["quiet_days"] += r["quiet_days"]
        g["alert_days"] += r.get("alert_days", 0)
        g["leads"] += r["leads"]
        g["scorable"] += r["scorable"]
    return list(out.values())


def net_m(rows, ch, n_boot=600, other=None):
    return net_stats(by_mission(rows), by_mission(ch), n_boot, 1, (by_mission(other[0]), by_mission(other[1])) if other else None)


def stat(rows, n_boot=1000):
    return bootstrap(mission_rows(rows), n_boot, 1)


def main():
    p, w = Params(), Windows()
    spec = detect_spec()
    tr_m, te_m = missions(N_TRAIN, SEED_TRAIN), missions(N_TEST, SEED_TEST)
    train, test = people(tr_m, SEED_TRAIN), people(te_m, SEED_TEST)
    out, thr, te_scores, model = evaluate(train, test, spec, p, w, keep=True)

    main_tbl = {}
    chance = {(m, b): chance_rows(test, [s[m] for s in te_scores], [thr[(m, b)]] * len(test), w, p.merge_gap, 3, 1) for m in METHODS for b in BUDGETS}
    for m in METHODS:
        main_tbl[m] = {}
        for b in BUDGETS:
            st = stat(out[m][b])
            st["chance_detection_rate"] = aggregate(chance[(m, b)])["detection_rate"]
            st.update(net_m(out[m][b], chance[(m, b)], 600, (out["fixed"][b], chance[("fixed", b)]) if m != "fixed" else None))
            main_tbl[m][str(b)] = st
        s = main_tbl[m]["1.0"]
        print(f"{m:8s} @1.0 det {s['detection_rate']:.2f} chance {s['chance_detection_rate']:.2f} net {s['net_detection']:.2f} [{s['net_detection_ci'][0]:.2f},{s['net_detection_ci'][1]:.2f}] FA {s['fa_per_person_month']:.2f}"
              f" | @0.25 det {main_tbl[m]['0.25']['detection_rate']:.2f} net {main_tbl[m]['0.25']['net_detection']:.2f} FA {main_tbl[m]['0.25']['fa_per_person_month']:.2f}")

    # ---- by event type and size (deployed detector, both tiers) --------------------------------
    by_type = {}
    for b in [0.25, 1.0]:
        rows = out[DEPLOYED][b]
        bt = {}
        for ty in TYPES:
            leads = [l for r, q in zip(rows, test) for l, s, e in zip(r["leads"], r["scorable"], q.events_meta) if s and e["type"] == ty]
            det = [l for l in leads if l is not None]
            after = [-l for l in det if l <= 0]
            # detection above luck for this type alone, interval over missions (every event counts)
            sub = [{**r, "leads": [l for l, e in zip(r["leads"], q.events_meta) if e["type"] == ty],
                    "scorable": [s for s, e in zip(r["scorable"], q.events_meta) if e["type"] == ty]} for r, q in zip(rows, test)]
            nt = net_m(sub, chance[(DEPLOYED, b)], 400)
            bt[ty] = {"label": TYPE_LABELS[ty], "n": len(leads), "detection_rate": len(det) / max(1, len(leads)),
                      "net_detection": nt["net_detection"], "net_detection_ci": nt["net_detection_ci"],
                      "share_alert_before_onset": sum(1 for l in det if l > 0) / max(1, len(leads)),
                      "median_delay_days": float(np.median(after)) if after else None}
        by_type[str(b)] = bt
    # dose-response: one event type at a time, fixed sizes, fresh missions per cell
    sizes = [0.5, 1.0, 1.5, 2.0, 3.0]
    dose = {}
    for ty in TYPES:
        dose[ty] = {"label": TYPE_LABELS[ty], "sizes": sizes, "0.25": [], "1.0": [], "n": []}
        for k, mag in enumerate(sizes):
            ms = missions(40, 20000 + 100 * TYPES.index(ty) + k, events_per=2, types=[ty], magnitudes=(mag,), illness_spread=False)
            pe = people(ms, 20000 + k)
            sc = [r[DEPLOYED] for r in score_people(pe, model, p)]
            for b in [0.25, 1.0]:
                rows = [person_outcome(s, thr[(DEPLOYED, b)], q.onsets, w, p.merge_gap) for s, q in zip(sc, pe)]
                dose[ty][str(b)].append(aggregate(rows)["detection_rate"])
            dose[ty]["n"].append(aggregate(rows)["n_events"])
        print("dose", ty, [round(v, 2) for v in dose[ty]["1.0"]])

    # ---- missing data and sensor dropout (thresholds stay as trained on nominal data) ----------
    def fixed_thr(pe):
        sc = [r[DEPLOYED] for r in score_people(pe, model, p)]
        return {str(b): stat([person_outcome(s, thr[(DEPLOYED, b)], q.onsets, w, p.merge_gap) for s, q in zip(sc, pe)], 400) for b in [0.25, 1.0]}
    missing = []
    for label, kw in [("Nominal: 4% of nights unworn, 10% of check-ins skipped", {}),
                      ("Wearable unworn 20% of nights", {"p_wear": 0.2}), ("Wearable unworn 40% of nights", {"p_wear": 0.4}),
                      ("Check-in skipped 30% of days", {"p_checkin": 0.3}), ("Check-in skipped 60% of days", {"p_checkin": 0.6}),
                      ("Week-long wearable outages (about one per month)", {"block_rate": 0.033, "block_len": 7}),
                      ("Both: 40% unworn and 60% skipped", {"p_wear": 0.4, "p_checkin": 0.6})]:
        missing.append({"label": label, **fixed_thr(people(te_m, SEED_TEST, **kw))})
        print("missing", label, round(missing[-1]["1.0"]["detection_rate"], 2), round(missing[-1]["1.0"]["fa_per_person_month"], 2))
    dropout = []
    for label, drop in [("All sensors", None), ("No HRV", ["hrv"]), ("No temperature", ["temp"]), ("No blood oxygen", ["spo2"]), ("No resting heart rate", ["rhr"]),
                        ("No sleep tracking", ["sleep_h", "sleep_mid"]), ("No exercise log", ["ex7"]), ("No reaction test", ["pvt_rt"]), ("No mood check-in", ["mood"]),
                        ("No fluid log", ["fluid"]), ("No food log", ["energy"]), ("Wearable only (no check-ins at all)", CHECKIN), ("Check-ins only (no wearable)", WEARABLE)]:
        dropout.append({"label": label, **fixed_thr(people(te_m, SEED_TEST, drop=drop))})
        print("dropout", label, round(dropout[-1]["1.0"]["detection_rate"], 2), round(dropout[-1]["1.0"]["fa_per_person_month"], 2))

    # ---- ablations: refit and recalibrate for each variant ---------------------------------------
    def variant(label, pp=p, aware=True, ids=None, prior_scale=1.0):
        sp = detect_spec(ids) if ids else spec
        tr_ = people(tr_m, SEED_TRAIN, aware=aware, ids=ids, prior_scale=prior_scale)
        te_ = people(te_m, SEED_TEST, aware=aware, ids=ids, prior_scale=prior_scale)
        o, t_, sc_, _ = evaluate(tr_, te_, sp, pp, w, methods=[DEPLOYED], budgets=[0.25, 1.0], keep=True)
        res = {"label": label, **{str(b): stat(o[DEPLOYED][b], 400) for b in [0.25, 1.0]}}
        # false alerts in the first 30 flight days: is adaptation mistaken for a problem?
        early = []
        for s, q in zip(sc_, te_):
            L = q.phases[0].start if q.phases else 30
            seg = s[DEPLOYED][L:L + 30]
            early.append(person_outcome(seg, t_[(DEPLOYED, 1.0)], [], w, pp.merge_gap))
        res["first_30_flight_days_fa_per_person_month"] = aggregate(early)["fa_per_person_month"]
        print("ablation", label, round(res["1.0"]["detection_rate"], 2), round(res["1.0"]["fa_per_person_month"], 2), "early FA", round(res["first_30_flight_days_fa_per_person_month"], 2))
        return res
    wear_ids = [i for i in spec["indicators"] if i in WEARABLE]
    ablation = [
        variant("Keel as deployed"),
        variant("Without mission-phase handling (naive rolling baseline)", aware=False),
        variant("Phase handling told to expect no shift at all (prior x 0)", prior_scale=0.0),
        variant("Phase handling with half the true shift (prior x 0.5)", prior_scale=0.5),
        variant("Phase handling with twice the true shift (prior x 2)", prior_scale=2.0),
        variant("Baseline window 14 days", replace(p, window=14)),
        variant("Baseline window 56 days", replace(p, window=56)),
        variant("No gap before the baseline window", replace(p, gap=0)),
        variant("Slower smoothing (lambda 0.15)", replace(p, ewma_lambda=0.15)),
        variant("Faster smoothing (lambda 0.5)", replace(p, ewma_lambda=0.5)),
        variant("Heart indicators only (resting HR, HRV)", ids=["rhr", "hrv"]),
        variant("Wearable indicators only", ids=wear_ids),
    ]

    # ---- does the widened band after launch hide real events?  Events in flight days 3 to 25 ------
    early_tr = missions(40, 80000, events_per=1, first_day=3, last_margin=sc_len() - 25, min_gap=1)
    early_te = missions(80, 81000, events_per=1, first_day=3, last_margin=sc_len() - 25, min_gap=1)
    early_events = {}
    for label, aware in [("phase-aware", True), ("naive", False)]:
        o, t_, sc_, _ = evaluate(people(early_tr + tr_m, 80000, aware=aware), people(early_te, 81000, aware=aware), spec, p, w, methods=[DEPLOYED], budgets=[1.0], keep=True)
        te_ = people(early_te, 81000, aware=aware)
        ch = chance_rows(te_, [s[DEPLOYED] for s in sc_], [t_[(DEPLOYED, 1.0)]] * len(te_), w, p.merge_gap, 3, 1)
        early_events[label] = {**stat(o[DEPLOYED][1.0], 400), **net_m(o[DEPLOYED][1.0], ch, 400)}
        print("events in the first 25 flight days,", label, round(early_events[label]["detection_rate"], 2), "net", round(early_events[label]["net_detection"], 2), "FA", round(early_events[label]["fa_per_person_month"], 2))

    # ---- like-for-like check against real data: simulated people on the ground, illness only,
    # the same two channels the real illness data has, similar wear time (eval_real.py scores
    # the real validation-half episodes the same way) ------------------------------------------
    g_tr, g_te = ground_people(40, 70000), ground_people(60, 71000)
    g_model = fit_model(g_tr, SPEC2, p, w)
    g_trs = [s[DEPLOYED] for s in score_people(g_tr, g_model, p)]
    g_tes = [s[DEPLOYED] for s in score_people(g_te, g_model, p)]
    like = {"indicators": "Resting heart rate + 7-day mean activity (log scale), 30% of nights unworn, simulated illnesses with the real spread of sizes, people on the ground"}
    for b in [0.25, 1.0]:
        t = calibrate(g_trs, [q.onsets for q in g_tr], b, w, p.merge_gap)
        rows = [{**person_outcome(s, t, q.onsets, w, p.merge_gap), "pid": q.pid} for s, q in zip(g_tes, g_te)]
        ch = chance_rows(g_te, g_tes, [t] * len(g_te), w, p.merge_gap, 3, 1)
        like[str(b)] = {**bootstrap(by_mission(rows), 600, 1), "chance_detection_rate": aggregate(ch)["detection_rate"], **net_m(rows, ch, 600), "threshold": t}
    print("like-for-like sim: det", round(like["1.0"]["detection_rate"], 2), "net", round(like["1.0"]["net_detection"], 2), "| @0.25", round(like["0.25"]["detection_rate"], 2), "net", round(like["0.25"]["net_detection"], 2))

    # ---- false alerts over long quiet periods: missions with no events at all -------------------
    quiet_m = [simulate(Scenario(), 30000 + s) for s in range(40)]
    qp = people(quiet_m, 30000)
    qs = [r[DEPLOYED] for r in score_people(qp, model, p)]
    quiet = {}
    for b in [0.25, 1.0]:
        rows = [{**person_outcome(s, thr[(DEPLOYED, b)], [], w, p.merge_gap), "pid": q.pid} for s, q in zip(qs, qp)]
        per = [r["fa"] / (r["quiet_days"] / 30.44) for r in rows]
        quiet[str(b)] = {**{k: v for k, v in stat(rows).items() if k.startswith("fa_") or k in ("quiet_person_months", "false_alerts", "quiet_days_in_alert_frac")},
                         "share_of_people_with_zero": float(np.mean([v == 0 for v in per])), "per_person_p90": float(np.percentile(per, 90))}

    write_json(APP_PUBLIC / "results" / "sim_eval.json", {
        "script": "research/scripts/eval_sim.py", "commit": git_commit(), "code_version": code_version(), "simulated": True, "deployed": DEPLOYED,
        "design": {"train_missions": N_TRAIN, "test_missions": N_TEST, "crew": 4, "flight_days": 180, "events_per_mission": 2,
                   "seeds": {"train": SEED_TRAIN, "test": SEED_TEST}, "n_test_events": sum(len(q.onsets) for q in test),
                   "windows": {"det_pre": w.det_pre, "det_post": w.det_post}},
        "budgets": BUDGETS, "methods": METHODS, "method_labels": METHOD_LABELS, "main": main_tbl, "by_type": by_type, "dose": dose,
        "luck_note": "Tables by size, missing data, sensor loss and design choice show raw flagged rates; luck at these budgets is the chance rate in the main table.",
        "missing": missing, "dropout": dropout, "ablation": ablation, "early_events": early_events, "quiet": quiet, "like_for_like": like,
    }, indent=1)
    print("wrote sim_eval.json")


if __name__ == "__main__":
    main()
