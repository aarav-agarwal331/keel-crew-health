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
from keel.export import APP_PUBLIC, code_version, git_commit, write_json
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
    record = {"script": "research/scripts/calibrate_sim.py", "commit": git_commit(), "code_version": code_version(), "targets": {}}

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
    # correlation between indicators' day-to-day residuals within a person (LifeSnaps calibration
    # half): one shared factor reproduces them.  rhr and HRV load equally and oppositely.
    def med_corr(a, b, la=False, lb=False):
        import pandas as pd
        out = []
        for _, g in ls_cal.groupby("pid"):
            if g[a].notna().sum() < 30 or g[b].notna().sum() < 30:
                continue
            g = g.set_index("date").sort_index()
            g = g.reindex(pd.date_range(g.index.min(), g.index.max(), freq="D"))
            va = np.log(g[a].where(g[a] > 0)) if la else g[a]
            vb = np.log(g[b].where(g[b] > 0)) if lb else g[b]
            ra = (va - va.rolling(28, min_periods=7, center=True).median()).to_numpy()
            rb = (vb - vb.rolling(28, min_periods=7, center=True).median()).to_numpy()
            ok = ~np.isnan(ra) & ~np.isnan(rb)
            if ok.sum() >= 30:
                out.append(np.corrcoef(ra[ok], rb[ok])[0, 1])
        return float(np.median(out)) if out else 0.0, len(out)
    r_rh, n_rh = med_corr("rhr", "hrv", False, True)
    r_rt, _ = med_corr("rhr", "temp")
    r_rs, _ = med_corr("rhr", "sleep_h")
    l = float(np.sqrt(min(0.9, abs(r_rh))))
    loads = {"rhr": l, "lnhrv": -l if r_rh < 0 else l, "temp": float(np.clip(r_rt / l, -0.9, 0.9)), "sleep": float(np.clip(r_rs / l, -0.9, 0.9))}
    for k, v in loads.items():
        P[f"noise_load_{k}"] = v
        set_param(J, f"noise_load_{k}", v, f"Loading on a shared day-to-day factor, from within-person correlations in LifeSnaps (calibration half, {n_rh} people): heart rate with HRV {r_rh:.2f}, with skin temperature {r_rt:.2f}, with sleep {r_rs:.2f}")
    record["correlation"] = {"rhr_hrv": r_rh, "rhr_temp": r_rt, "rhr_sleep": r_rs, "n_people": n_rh, "loadings": loads}
    print(f"within-person correlations (calibration half, n={n_rh}): rhr-hrv {r_rh:.2f}, rhr-temp {r_rt:.2f}, rhr-sleep {r_rs:.2f} -> loadings {loads}")

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
    for pro in range(0, 5):                  # days of rise before symptom onset
        for after in (1, 2, 3):              # days from onset to the peak
            for hold in range(0, 4):
                for dur in range(3, 13):
                    shape = _bump(T, on - pro, pro + after, hold, dur)
                    amp = float(shape @ mean / (shape @ shape))
                    sse = float(np.sum((amp * shape - mean) ** 2))
                    if best is None or sse < best[0]:
                        best = (sse, pro, after, hold, dur, amp)
    _, pro, after, hold, dur, amp = best
    # spread of the response between episodes.  Per-episode peak = mean of days 0..3 minus mean of
    # days -14..-8; its measurement noise (from night-to-night variation) is subtracted so that
    # the simulator is given the spread of the TRUE response, not of the noisy estimate.
    n1 = np.sum(~np.isnan(curves[:, on:on + 4]), axis=1)
    n0 = np.sum(~np.isnan(curves[:, :7]), axis=1)
    ok = (n1 >= 2) & (n0 >= 3)
    pk = np.nanmean(curves[ok][:, on:on + 4], axis=1) - np.nanmean(curves[ok][:, :7], axis=1)
    sd_night = float(targets["rhr"][0]["sd"].median())
    noise_var = float(np.mean(sd_night ** 2 * (1 / n1[ok] + 1 / n0[ok])))
    true_sd = float(np.sqrt(max(0.0, np.var(pk, ddof=1) - noise_var)))
    cv = float(np.clip(true_sd / max(0.5, np.mean(pk)), 0.3, 2.0))
    q25, q50, q75 = np.percentile(pk, [25, 50, 75])
    note = f"mean resting-heart-rate change around {len(curves)} dated illness onsets (calibration half, Stanford phases 1 and 2)"
    set_param(J, "illness_prodrome_days", pro, f"Fitted to the {note}")
    set_param(J, "illness_duration_days", dur, "Fitted with the prodrome (same fit)")
    set_param(J, "illness_rhr_peak", amp, f"Fitted peak of the {note}. Observed per-episode quartiles {q25:.1f} / {q50:.1f} / {q75:.1f} bpm; the published median among detected cases is 7 bpm (DOMAIN ref 58)")
    for key, v, txt in [("illness_hold_days", hold, "Fitted with the prodrome (same fit)"), ("illness_rise_after_days", after, "Days from symptom onset to the peak (same fit)"),
                        ("illness_magnitude_cv", cv, f"Between-episode SD of the true response over its mean: observed SD {np.std(pk, ddof=1):.1f} bpm, of which {np.sqrt(noise_var):.1f} bpm is measurement noise")]:
        J["params"].setdefault(key, {"unit": "days" if "days" in key else "ratio"})
        set_param(J, key, v, txt)
    J["params"].pop("illness_magnitude_sigma", None)
    J["params"]["illness_temp_peak"]["value"] = round(amp / 8.5, 2)
    J["params"]["illness_temp_peak"]["note"] = "Fitted heart-rate peak divided by a second-hand 8.5 bpm per degree C (DOMAIN ref 60)"
    record["illness"] = {"source": "Stanford phases 1 and 2, dated illness episodes, calibration half of the people", "n_events": int(len(curves)), "rel_day": REL,
                         "real_mean": mean, "fit": amp * _bump(T, on - pro, pro + after, hold, dur), "prodrome_days": pro, "days_to_peak": after, "hold_days": hold,
                         "duration_days": dur, "peak_bpm": amp, "per_episode_quartiles": [q25, q50, q75], "per_episode_observed_sd": float(np.std(pk, ddof=1)),
                         "per_episode_noise_sd": float(np.sqrt(noise_var)), "magnitude_cv": cv}
    print(f"illness: rise from {pro} d before onset, peak {after} d after, hold {hold} d, recovery {dur} d, peak {amp:.1f} bpm, {len(curves)} episodes; "
          f"observed per-episode SD {np.std(pk, ddof=1):.1f}, noise {np.sqrt(noise_var):.1f}, true-response cv {cv:.2f}")

    PARAMS.write_text(json.dumps(J, indent=1, ensure_ascii=False))
    write_json(APP_PUBLIC / "results" / "calibration.json", record, indent=1)


if __name__ == "__main__":
    main()
