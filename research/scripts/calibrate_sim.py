"""make sim (part 1): calibrate the simulator's day-to-day variability and its illness response
to REAL data, using a calibration half of each dataset.  The other half is held out and used
only by sim_realism.py to check the result.

Writes the fitted values into shared/sim_params.json (basis = "calibrated") and a record of
what was fitted to app/public/results/calibration.json.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I

import numpy as np

from keel import realdata
from keel.export import APP_PUBLIC, git_commit, write_json
from keel.simulator import IND, Scenario, _bump, simulate

PARAMS = ROOT / "shared" / "sim_params.json"
REL = np.arange(-14, 15)


def set_param(J: dict, key: str, value: float, note: str) -> None:
    J["params"][key]["value"] = round(float(value), 4)
    J["params"][key]["basis"] = "calibrated"
    J["params"][key]["ref"] = None
    J["params"][key]["note"] = note


def sim_within(P: dict, col: str, log: bool) -> tuple[float, float]:
    """Within-person SD and lag-1 autocorrelation the simulator produces on the ground phase."""
    sds, acs = [], []
    for s in range(12):
        m = simulate(Scenario(pre_days=120, flight_days=1), 700 + s, P)
        for i in range(m.x.shape[0]):
            v = m.x[i, :120, IND.index(col)]
            v = np.log(v) if log else v
            r = v - np.median(v)
            sds.append(np.std(r))
            acs.append(np.corrcoef(r[:-1], r[1:])[0, 1])
    return float(np.median(sds)), float(np.median(acs))


def main():
    J = json.loads(PARAMS.read_text())
    P = {k: v["value"] for k, v in J["params"].items()}
    record = {"script": "research/scripts/calibrate_sim.py", "commit": git_commit(), "targets": {}}

    # ---- day-to-day variability -------------------------------------------------------------
    ls = realdata.lifesnaps()
    cal, _ = realdata.split_half(sorted(ls.pid.unique()))
    ls_cal = ls[ls.pid.isin(cal)]
    daily, events, people = realdata.stanford()
    quiet_pids = people[people.group.isin(["no_reported_illness", "non_positive"])]
    st = daily.merge(quiet_pids[["dataset", "pid"]], on=["dataset", "pid"])
    st = st.assign(pid=st.dataset + ":" + st.pid)
    cal_s, _ = realdata.split_half(sorted(st.pid.unique()))
    targets = {
        "rhr": (realdata.within_stats(st[st.pid.isin(cal_s)], "rhr"), "rhr_within_sd", False, "Stanford wearables, people with no reported illness (calibration half)"),
        "hrv": (realdata.within_stats(ls_cal, "hrv", log=True), "lnhrv_within_sd", True, "LifeSnaps (calibration half)"),
        "spo2": (realdata.within_stats(ls_cal, "spo2"), "spo2_within_sd", False, "LifeSnaps (calibration half)"),
        "temp": (realdata.within_stats(ls_cal, "temp"), "temp_within_sd", False, "LifeSnaps nightly skin temperature (calibration half)"),
        "sleep_h": (realdata.within_stats(ls_cal, "sleep_h"), "sleep_within_sd", False, "LifeSnaps (calibration half)"),
    }
    # how much people differ in their own variability: IQR ratio of the within-person SD
    sig = [float(np.log(st_["sd"].quantile(0.75) / st_["sd"].quantile(0.25)) / 1.349) for st_, _, _, _ in targets.values()]
    P["within_sd_person_sigma"] = float(np.mean(sig))
    set_param(J, "within_sd_person_sigma", P["within_sd_person_sigma"], "Mean over five indicators of ln(Q3/Q1)/1.349 of the within-person SD across people (calibration halves)")
    for col, (stats, key, log, src) in targets.items():
        tgt_sd, tgt_ar, n = float(stats["sd"].median()), float(stats["ar1"].median()), int(len(stats))
        # the simulator's total day-to-day SD also contains sleep-debt and exercise effects, so
        # scale the noise parameter until the simulated total matches the real total
        for _ in range(4):
            sd_sim, _ = sim_within(P, col, log)
            P[key] = P[key] * tgt_sd / sd_sim
        if col == "rhr":
            for _ in range(3):
                _, ar_sim = sim_within(P, col, log)
                P["rhr_ar1"] = float(np.clip(P["rhr_ar1"] + (tgt_ar - ar_sim), 0.05, 0.9))
            set_param(J, "rhr_ar1", P["rhr_ar1"], f"Lag-1 autocorrelation {tgt_ar:.2f} in {src}, n = {n} people")
        sd_sim, ar_sim = sim_within(P, col, log)
        set_param(J, key, P[key], f"Fitted so simulated within-person SD matches {tgt_sd:.3f} from {src}, n = {n} people")
        record["targets"][col] = {"source": src, "n_people": n, "real_within_sd": tgt_sd, "real_ar1": tgt_ar, "sim_within_sd": sd_sim, "sim_ar1": ar_sim, "log_scale": log}
        print(f"{col:8s} real sd {tgt_sd:.3f} ar1 {tgt_ar:.2f} -> sim sd {sd_sim:.3f} ar1 {ar_sim:.2f} ({key} = {P[key]:.3f})")

    # ---- illness response: resting heart rate around symptom onset --------------------------
    # calibration half of the people with a dated illness (both phases pooled); the other half
    # is only used by sim_realism.py
    cal_e, _ = realdata.split_half(realdata.event_pids(events), seed=11)
    curves = realdata.aligned_curves(daily, events, ["phase1", "phase2"], REL, only=cal_e)
    mean = np.nanmean(curves, axis=0)
    mean = mean - np.nanmean(mean[:6])       # level before the template can act
    best = None
    T = len(REL)
    on = int(np.where(REL == 0)[0][0])
    for pro in range(0, 7):
        for hold in range(0, 4):
            for dur in range(3, 15):
                shape = _bump(T, on - pro, pro + 2, hold, dur)
                amp = float(shape @ mean / (shape @ shape))
                sse = float(np.sum((amp * shape - mean) ** 2))
                if best is None or sse < best[0]:
                    best = (sse, pro, hold, dur, amp)
    _, pro, hold, dur, amp = best
    # spread of the response between episodes: peak = mean of days 0..3 minus mean of days -14..-8
    pk = np.nanmean(curves[:, on:on + 4], axis=1) - np.nanmean(curves[:, :7], axis=1)
    pk = pk[~np.isnan(pk)]
    q25, q50, q75 = np.percentile(pk, [25, 50, 75])
    sigma = float(np.clip(np.log(max(q75, 0.5) / max(q50, 0.5)) / 0.6745, 0.3, 1.2))
    note = f"mean resting-heart-rate change around {len(curves)} dated illness onsets (calibration half, Stanford phases 1 and 2)"
    set_param(J, "illness_prodrome_days", pro, f"Fitted to the {note}")
    set_param(J, "illness_duration_days", dur, "Fitted with the prodrome (same fit)")
    set_param(J, "illness_rhr_peak", amp, f"Fitted peak of the {note}. Per-episode quartiles {q25:.1f} / {q50:.1f} / {q75:.1f} bpm; the published median among detected cases is 7 bpm (DOMAIN ref 58)")
    J["params"].setdefault("illness_hold_days", {"unit": "days"})
    set_param(J, "illness_hold_days", hold, "Fitted with the prodrome (same fit)")
    J["params"].setdefault("illness_magnitude_sigma", {"unit": "log units"})
    set_param(J, "illness_magnitude_sigma", sigma, "Spread of the per-episode response (log-normal), from the upper quartile over the median")
    J["params"]["illness_temp_peak"]["value"] = round(amp / 8.5, 2)
    J["params"]["illness_temp_peak"]["note"] = "Fitted heart-rate peak divided by a second-hand 8.5 bpm per degree C (DOMAIN ref 60)"
    record["illness"] = {"source": "Stanford phases 1 and 2, dated illness episodes, calibration half of the people", "n_events": int(len(curves)), "rel_day": REL,
                         "real_mean": mean, "fit": amp * _bump(T, on - pro, pro + 2, hold, dur), "prodrome_days": pro, "hold_days": hold,
                         "duration_days": dur, "peak_bpm": amp, "per_episode_quartiles": [q25, q50, q75], "magnitude_sigma": sigma}
    print(f"illness: prodrome {pro} d, hold {hold} d, recovery {dur} d, peak {amp:.1f} bpm from {len(curves)} episodes; per-episode quartiles {q25:.1f}/{q50:.1f}/{q75:.1f}, sigma {sigma:.2f}")

    PARAMS.write_text(json.dumps(J, indent=1, ensure_ascii=False))
    write_json(APP_PUBLIC / "results" / "calibration.json", record, indent=1)


if __name__ == "__main__":
    main()
