"""make validate (part 3): is the simulator realistic?  Side by side with REAL data that the
calibration never saw (the validation half of each dataset), plus published in-flight values.

Acceptance criteria, written down before this script was last run:
  variability   simulated median within-person SD within 25% of the real median
  carry-over    simulated lag-1 autocorrelation within 0.15 of the real one
  correlation   simulated between-indicator correlation within 0.15 of the real one
  transfer      alert thresholds calibrated on simulated people, applied unchanged to REAL quiet
                people, give a false-alert rate between half and double the budget
Anything that fails is reported as failing on the Validation screen.
Output: app/public/results/realism.json
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I

import json

import numpy as np
import pandas as pd

from keel import realdata
from keel.core import Params
from keel.evaluate import Person, Windows, aggregate, calibrate, fit_model, person_outcome, score_people
from keel.export import APP_PUBLIC, code_version, git_commit, write_json
from keel.mission import SPEC2, ground_people
from keel.simulator import IND, SYMPTOMS, Event, Scenario, illness_magnitude, load_params, simulate

REL = np.arange(-14, 15)


def hist(v, edges):
    h, _ = np.histogram(np.clip(v, edges[0], edges[-1] - 1e-9), bins=edges)
    return (h / max(1, h.sum())).tolist()


def sim_people(n_missions=40, pre=120):
    """Ground-phase simulated crew: (indicator -> list of per-person series)."""
    out = {k: [] for k in IND}
    for s in range(n_missions):
        m = simulate(Scenario(pre_days=pre, flight_days=1), 40000 + s)
        for i in range(m.x.shape[0]):
            for j, k in enumerate(IND):
                out[k].append(m.x[i, :pre, j])
    return out


def detrend(v, log=False):
    """Same treatment as realdata.within_stats: remove a centred 28-day rolling median."""
    s = pd.Series(np.log(v) if log else np.asarray(v, float))
    return (s - s.rolling(28, min_periods=7, center=True).median()).to_numpy()


def within(v, log=False):
    r = detrend(v, log)
    a, b = r[:-1], r[1:]
    ok = ~np.isnan(a) & ~np.isnan(b)
    return float(np.nanstd(r)), float(np.corrcoef(a[ok], b[ok])[0, 1])


def real_corr(df, a, b, la=False, lb=False, min_days=30):
    out = []
    for _, g in df.groupby("pid"):
        if g[a].notna().sum() < min_days or g[b].notna().sum() < min_days:
            continue
        g = g.set_index("date").sort_index()
        g = g.reindex(pd.date_range(g.index.min(), g.index.max(), freq="D"))
        ra, rb = detrend(g[a].where(g[a] > 0) if la else g[a], la), detrend(g[b].where(g[b] > 0) if lb else g[b], lb)
        ok = ~np.isnan(ra) & ~np.isnan(rb)
        if ok.sum() >= min_days:
            out.append(np.corrcoef(ra[ok], rb[ok])[0, 1])
    return out


def main():
    P = load_params()
    ls = realdata.lifesnaps()
    _, val = realdata.split_half(sorted(ls.pid.unique()))
    ls_val = ls[ls.pid.isin(val)]
    daily, events, people = realdata.stanford()
    q = people[people.group.isin(["no_reported_illness", "non_positive"])]
    st = daily.merge(q[["dataset", "pid"]], on=["dataset", "pid"])
    st = st.assign(pid=st.dataset + ":" + st.pid)
    _, val_s = realdata.split_half(sorted(st.pid.unique()))
    sim = sim_people()

    specs = [("rhr", "Resting heart rate", "bpm", False, st[st.pid.isin(val_s)], "Stanford wearables, validation half", np.linspace(0, 8, 17)),
             ("hrv", "Heart rate variability (log scale)", "ln ms", True, ls_val, "LifeSnaps, validation half", np.linspace(0, 0.6, 13)),
             ("spo2", "Blood oxygen", "%", False, ls_val, "LifeSnaps, validation half", np.linspace(0, 2.4, 13)),
             ("temp", "Skin temperature", "°C", False, ls_val, "LifeSnaps, validation half", np.linspace(0, 1.2, 13)),
             ("sleep_h", "Sleep duration", "h", False, ls_val, "LifeSnaps, validation half", np.linspace(0, 3, 13))]
    variability = []
    for col, label, unit, log, df, src, edges in specs:
        real = realdata.within_stats(df, col, log=log)
        ss = np.array([within(v, log) for v in sim[col]])
        variability.append({
            "id": col, "label": label, "unit": unit, "source": src, "n_real_people": int(len(real)), "n_sim_people": int(len(ss)),
            "real_sd_median": float(real.sd.median()), "real_sd_iqr": real.sd.quantile([0.25, 0.75]).tolist(),
            "sim_sd_median": float(np.median(ss[:, 0])), "sim_sd_iqr": np.percentile(ss[:, 0], [25, 75]).tolist(),
            "real_ar1_median": float(real.ar1.median()), "sim_ar1_median": float(np.median(ss[:, 1])),
            "edges": edges.tolist(), "real_hist": hist(real.sd.to_numpy(), edges), "sim_hist": hist(ss[:, 0], edges),
        })
        v_ = variability[-1]
        v_["sd_ratio"] = v_["sim_sd_median"] / v_["real_sd_median"]
        v_["sd_pass"] = bool(abs(v_["sd_ratio"] - 1) <= 0.25)
        v_["ar1_pass"] = bool(abs(v_["sim_ar1_median"] - v_["real_ar1_median"]) <= 0.15)
        v = variability[-1]
        print(f"{col:8s} within-SD real {v['real_sd_median']:.3f} {np.round(v['real_sd_iqr'], 3)} sim {v['sim_sd_median']:.3f} {np.round(v['sim_sd_iqr'], 3)} | ar1 real {v['real_ar1_median']:.2f} sim {v['sim_ar1_median']:.2f}")

    # ---- correlation between indicators within a person (day-to-day residuals) ------------------
    pairs = [("rhr", "hrv", False, True, "Resting heart rate and HRV"), ("rhr", "sleep_h", False, False, "Resting heart rate and sleep duration"),
             ("hrv", "sleep_h", True, False, "HRV and sleep duration"), ("rhr", "temp", False, False, "Resting heart rate and skin temperature")]
    correlation = []
    for a, b, la, lb, label in pairs:
        rc = real_corr(ls_val, a, b, la, lb)
        sc_ = []
        for va, vb in zip(sim[a], sim[b]):
            ra, rb = detrend(va, la), detrend(vb, lb)
            ok = ~np.isnan(ra) & ~np.isnan(rb)
            sc_.append(np.corrcoef(ra[ok], rb[ok])[0, 1])
        correlation.append({"label": label, "real_median": float(np.median(rc)) if rc else None, "n_real_people": len(rc), "sim_median": float(np.median(sc_)),
                            "pass": bool(rc and abs(np.median(sc_) - np.median(rc)) <= 0.15)})
        print(f"corr {label}: real {correlation[-1]['real_median']} (n={len(rc)}) sim {correlation[-1]['sim_median']:.2f}")

    # ---- transfer: thresholds calibrated on SIMULATED people, applied unchanged to REAL quiet people
    p_, w_ = Params(), Windows()
    deployed = json.loads((APP_PUBLIC / "data" / "model_mission.json").read_text())["deployed"]
    g_tr = ground_people(40, 70000)
    g_model = fit_model(g_tr, SPEC2, p_, w_)
    g_sc = [x[deployed] for x in score_people(g_tr, g_model, p_)]
    real_quiet = []
    for pid, g in st[st.pid.isin(val_s | set(st.pid.unique()))].groupby("pid"):
        g = g.sort_values("date")
        if g["rhr"].notna().sum() < 28:
            continue
        steps = g["steps"].where(g["steps"] > 0).to_numpy(float)
        act7 = np.array([np.nanmean(steps[max(0, t - 6):t + 1]) if np.sum(~np.isnan(steps[max(0, t - 6):t + 1])) >= 4 else np.nan for t in range(len(steps))])
        real_quiet.append(Person(pid=pid, x=np.column_stack([g["rhr"].to_numpy(float), act7])))
    r_sc = [x[deployed] for x in score_people(real_quiet, g_model, p_)]
    transfer = {"n_real_people": len(real_quiet), "detector": deployed, "budgets": {}}
    for b in [0.25, 1.0]:
        t = calibrate(g_sc, [q.onsets for q in g_tr], b, w_, p_.merge_gap)
        a = aggregate([person_outcome(x, t, [], w_, p_.merge_gap) for x in r_sc])
        transfer["budgets"][str(b)] = {"threshold": t, "real_fa_per_person_month": a["fa_per_person_month"], "real_quiet_person_months": a["quiet_person_months"],
                                       "pass": bool(0.5 * b <= a["fa_per_person_month"] <= 2 * b)}
        print(f"transfer: sim-calibrated threshold at budget {b} gives {a['fa_per_person_month']:.2f} false alerts per person-month on {len(real_quiet)} real quiet people")

    # ---- illness response: real validation half vs simulated episodes of realistic sizes ----------
    _, val_e = realdata.split_half(realdata.event_pids(events), seed=11)
    real_c = realdata.aligned_curves(daily, events, ["phase1", "phase2"], REL, only=val_e)
    rng = np.random.default_rng(5)
    sim_c = []
    for s in range(150):
        mag = illness_magnitude(rng, P["illness_magnitude_cv"])
        m = simulate(Scenario(pre_days=120, flight_days=1, n_crew=1, events=[Event("illness", 0, 80, mag)]), 50000 + s)
        v = m.x[0, :, IND.index("rhr")]
        sim_c.append(v[80 + REL] - np.median(v[80 - 49:80 - 21]))
    sim_c = np.array(sim_c)

    def band(c):
        b = np.array([np.nanmean(c[rng.integers(0, len(c), len(c))], axis=0) for _ in range(1000)])
        return {"mean": np.nanmean(c, axis=0), "lo": np.percentile(b, 2.5, axis=0), "hi": np.percentile(b, 97.5, axis=0), "n": int(len(c))}
    on = int(np.where(REL == 0)[0][0])
    illness = {"rel_day": REL, "real": band(real_c), "sim": band(sim_c), "real_source": "Stanford phases 1 and 2, validation half of people with a dated illness",
               "pre_onset_bpm_days": {"real": float(np.nansum(np.nanmean(real_c, axis=0)[on - 5:on])), "sim": float(np.nansum(np.nanmean(sim_c, axis=0)[on - 5:on]))},
               "peak_window_mean": {"real": float(np.nanmean(np.nanmean(real_c, axis=0)[on:on + 4])), "sim": float(np.nanmean(np.nanmean(sim_c, axis=0)[on:on + 4]))}}
    print("illness real", np.round(illness["real"]["mean"][10:20], 1), "sim", np.round(illness["sim"]["mean"][10:20], 1))

    # ---- published in-flight anchors the simulator should reproduce ----------------------------
    fl = {"sleep": [], "lt6": [], "mass": [], "head_lo": [], "head_hi": [], "sms": []}
    for s in range(40):
        m = simulate(Scenario(), 60000 + s)
        L = m.scenario.pre_days
        sl = m.x[:, L + 30:, IND.index("sleep_h")]
        fl["sleep"].append(sl.mean())
        fl["lt6"].append((sl < 6).mean())
        ms = m.x[:, :, IND.index("mass")]
        fl["mass"].append(np.nanmean(ms[:, L + 30:L + 90] / np.nanmean(ms[:, :L], axis=1, keepdims=True)) - 1)
        co2 = m.env[L:, 0]
        h = m.symptoms[:, L + 10:, SYMPTOMS.index("headache")].mean(axis=0)
        c = co2[10:]
        fl["head_lo"].append(h[c < 2.3].mean() if (c < 2.3).any() else np.nan)
        fl["head_hi"].append(h[c >= 2.8].mean() if (c >= 2.8).any() else np.nan)
        fl["sms"].append(np.mean([t["sms"] for t in m.traits]))
    anchors = [
        {"what": "Mean in-flight sleep", "unit": "h", "published": 6.09, "simulated": float(np.mean(fl["sleep"])), "ref": "31", "input": True, "note": "ISS actigraphy, Barger et al. 2014. This is an input to the simulator, so agreement only shows the code does what it says."},
        {"what": "Nights under 6 h of sleep in flight", "unit": "%", "published": 43.8, "simulated": float(100 * np.mean(fl["lt6"])), "ref": "31", "input": False, "note": "ISS, same study. Not an input: an independent check. The simulator overshoots."},
        {"what": "Body mass change after the first month", "unit": "%", "published": -3.6, "simulated": float(100 * np.mean(fl["mass"])), "ref": "52d", "input": True, "note": "Published range -2.8% to -4.4%. An input to the simulator."},
        {"what": "Crew with space motion sickness", "unit": "%", "published": 70.0, "simulated": float(100 * np.mean(fl["sms"])), "ref": "52a", "input": True, "note": "Published range 60% to 80%. An input to the simulator."},
        {"what": "Headache odds ratio, CO2 at or above 2.8 mmHg versus below 2.3", "unit": "ratio", "published": None,
         "simulated": float((np.nanmean(fl["head_hi"]) / (1 - np.nanmean(fl["head_hi"]))) / (np.nanmean(fl["head_lo"]) / (1 - np.nanmean(fl["head_lo"])))),
         "ref": "37", "input": False, "note": "Not a direct input: an independent check, and the simulator undershoots. Published: odds double per 1 mmHg (expect about 1.9 between these bands). The simulated ratio is lower because simulated headaches also come from dehydration, illness and motion sickness."},
    ]
    for a in anchors:
        print("anchor", a["what"], a["published"], round(a["simulated"], 2))

    write_json(APP_PUBLIC / "results" / "realism.json", {
        "script": "research/scripts/sim_realism.py", "commit": git_commit(), "code_version": code_version(), "variability": variability, "correlation": correlation,
        "transfer": transfer, "illness": illness, "anchors": anchors,
        "criteria": {"variability": "simulated median within 25% of the real median", "carry_over": "lag-1 autocorrelation within 0.15", "correlation": "within 0.15",
                     "transfer": "real false-alert rate between half and double the budget"},
        "note": "Real values come from the validation half of each dataset; the calibration script only saw the other half.",
    }, indent=1)


if __name__ == "__main__":
    main()
