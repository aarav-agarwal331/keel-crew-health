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
from keel.evaluate import METHOD_LABELS, METHODS, Windows, aggregate, bootstrap, calibrate, chance_rows, fit_model, person_outcome, score_people
from keel.export import APP_PUBLIC, git_commit, write_json
from keel.mission import detect_spec, people_from
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


def people(ms, seed0, aware=True, ids=None, drop=None, **miss):
    out = []
    for k, m in enumerate(ms):
        x = apply_missing(m, seed0 + k, **miss)
        if drop:
            for name in drop:
                x[:, :, IND.index("ex_min" if name == "ex7" else name)] = np.nan
        out += people_from(m, x, ids=ids, aware=aware)
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
            out[m][b] = [person_outcome(s[m], t, q.onsets, w, p.merge_gap) for s, q in zip(te, test)]
    return (out, thr, te, model) if keep else out


def stat(rows, n_boot=1000):
    return bootstrap(mission_rows(rows), n_boot, 1)


def main():
    p, w = Params(), Windows()
    spec = detect_spec()
    tr_m, te_m = missions(N_TRAIN, SEED_TRAIN), missions(N_TEST, SEED_TEST)
    train, test = people(tr_m, SEED_TRAIN), people(te_m, SEED_TEST)
    out, thr, te_scores, model = evaluate(train, test, spec, p, w, keep=True)

    main_tbl = {}
    for m in METHODS:
        main_tbl[m] = {}
        for b in BUDGETS:
            st = stat(out[m][b])
            ch = chance_rows(test, [s[m] for s in te_scores], [thr[(m, b)]] * len(test), w, p.merge_gap, 3, 1)
            st["chance_detection_rate"] = aggregate(ch)["detection_rate"]
            main_tbl[m][str(b)] = st
        s = main_tbl[m]["1.0"]
        print(f"{m:8s} @1.0 det {s['detection_rate']:.2f} [{s['detection_rate_ci'][0]:.2f},{s['detection_rate_ci'][1]:.2f}] chance {s['chance_detection_rate']:.2f} lead {s['median_lead']} FA {s['fa_per_person_month']:.2f}"
              f" | @0.25 det {main_tbl[m]['0.25']['detection_rate']:.2f} FA {main_tbl[m]['0.25']['fa_per_person_month']:.2f}")

    # ---- by event type and size (deployed detector, both tiers) --------------------------------
    by_type = {}
    for b in [0.25, 1.0]:
        rows = out[DEPLOYED][b]
        bt = {}
        for ty in TYPES:
            leads = [l for r, q in zip(rows, test) for l, s, e in zip(r["leads"], r["scorable"], q.events_meta) if s and e["type"] == ty]
            det = [l for l in leads if l is not None]
            bt[ty] = {"label": TYPE_LABELS[ty], "n": len(leads), "detection_rate": len(det) / max(1, len(leads)),
                      "median_delay_days": float(-np.median(det)) if det else None}
        by_type[str(b)] = bt
    # dose-response: one event type at a time, fixed sizes, fresh missions per cell
    sizes = [0.5, 1.0, 1.5, 2.0, 3.0]
    dose = {}
    for ty in TYPES:
        dose[ty] = {"label": TYPE_LABELS[ty], "sizes": sizes, "0.25": [], "1.0": []}
        for k, mag in enumerate(sizes):
            ms = missions(24, 20000 + 100 * TYPES.index(ty) + k, events_per=2, types=[ty], magnitudes=(mag,), illness_spread=False)
            pe = people(ms, 20000 + k)
            sc = [r[DEPLOYED] for r in score_people(pe, model, p)]
            for b in [0.25, 1.0]:
                rows = [person_outcome(s, thr[(DEPLOYED, b)], q.onsets, w, p.merge_gap) for s, q in zip(sc, pe)]
                dose[ty][str(b)].append(aggregate(rows)["detection_rate"])
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
    def variant(label, pp=p, aware=True, ids=None):
        sp = detect_spec(ids) if ids else spec
        tr_, te_ = people(tr_m, SEED_TRAIN, aware=aware, ids=ids), people(te_m, SEED_TEST, aware=aware, ids=ids)
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
        variant("Baseline window 14 days", replace(p, window=14)),
        variant("Baseline window 56 days", replace(p, window=56)),
        variant("No gap before the baseline window", replace(p, gap=0)),
        variant("Slower smoothing (lambda 0.15)", replace(p, ewma_lambda=0.15)),
        variant("Faster smoothing (lambda 0.5)", replace(p, ewma_lambda=0.5)),
        variant("Heart indicators only (resting HR, HRV)", ids=["rhr", "hrv"]),
        variant("Wearable indicators only", ids=wear_ids),
    ]

    # ---- like-for-like check against real data: illness only, on the two channels the real
    # illness data has (resting heart rate + activity), with similar wear time ---------------------
    lf_tr = missions(40, 70000, types=["illness"])
    lf_te = missions(60, 71000, types=["illness"])
    ids2 = ["rhr", "ex7"]
    o2, _, _, _ = evaluate(people(lf_tr, 70000, ids=ids2, p_wear=0.3), people(lf_te, 71000, ids=ids2, p_wear=0.3), detect_spec(ids2), p, w,
                           methods=[DEPLOYED], budgets=[0.25, 1.0], keep=True)
    like = {"indicators": "Resting heart rate + exercise only, 30% of nights unworn, illness events with the real spread of sizes",
            **{str(b): stat(o2[DEPLOYED][b], 400) for b in [0.25, 1.0]}}
    print("like-for-like", round(like["1.0"]["detection_rate"], 2), round(like["0.25"]["detection_rate"], 2))

    # ---- false alerts over long quiet periods: missions with no events at all -------------------
    quiet_m = [simulate(Scenario(), 30000 + s) for s in range(40)]
    qp = people(quiet_m, 30000)
    qs = [r[DEPLOYED] for r in score_people(qp, model, p)]
    quiet = {}
    for b in [0.25, 1.0]:
        rows = [person_outcome(s, thr[(DEPLOYED, b)], [], w, p.merge_gap) for s in qs]
        per = [r["fa"] / (r["quiet_days"] / 30.44) for r in rows]
        quiet[str(b)] = {**{k: v for k, v in stat(rows).items() if k.startswith("fa_") or k in ("quiet_person_months", "false_alerts", "quiet_days_in_alert_frac")},
                         "share_of_people_with_zero": float(np.mean([v == 0 for v in per])), "per_person_p90": float(np.percentile(per, 90))}

    write_json(APP_PUBLIC / "results" / "sim_eval.json", {
        "script": "research/scripts/eval_sim.py", "commit": git_commit(), "simulated": True, "deployed": DEPLOYED,
        "design": {"train_missions": N_TRAIN, "test_missions": N_TEST, "crew": 4, "flight_days": 180, "events_per_mission": 2,
                   "seeds": {"train": SEED_TRAIN, "test": SEED_TEST}, "n_test_events": sum(len(q.onsets) for q in test),
                   "windows": {"det_pre": w.det_pre, "det_post": w.det_post}},
        "budgets": BUDGETS, "methods": METHODS, "method_labels": METHOD_LABELS, "main": main_tbl, "by_type": by_type, "dose": dose,
        "missing": missing, "dropout": dropout, "ablation": ablation, "quiet": quiet, "like_for_like": like,
    }, indent=1)
    print("wrote sim_eval.json")


if __name__ == "__main__":
    main()
