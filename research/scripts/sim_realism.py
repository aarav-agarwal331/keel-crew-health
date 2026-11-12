"""make validate (part 3): is the simulator realistic?  Side by side with REAL data that the
calibration never saw (the validation half of each dataset), plus published in-flight anchors.
Output: app/public/results/realism.json
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I

import numpy as np

from keel import realdata
from keel.export import APP_PUBLIC, git_commit, write_json
from keel.simulator import IND, SYMPTOMS, Event, Scenario, load_params, simulate

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


def within(v, log=False):
    v = np.log(v) if log else np.asarray(v, float)
    r = v - np.nanmedian(v)
    a, b = r[:-1], r[1:]
    ok = ~np.isnan(a) & ~np.isnan(b)
    return float(np.nanstd(r)), float(np.corrcoef(a[ok], b[ok])[0, 1])


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
        v = variability[-1]
        print(f"{col:8s} within-SD real {v['real_sd_median']:.3f} {np.round(v['real_sd_iqr'], 3)} sim {v['sim_sd_median']:.3f} {np.round(v['sim_sd_iqr'], 3)} | ar1 real {v['real_ar1_median']:.2f} sim {v['sim_ar1_median']:.2f}")

    # ---- illness response: real validation half vs simulated episodes of realistic sizes ----------
    _, val_e = realdata.split_half(realdata.event_pids(events), seed=11)
    real_c = realdata.aligned_curves(daily, events, ["phase1", "phase2"], REL, only=val_e)
    rng = np.random.default_rng(5)
    sim_c = []
    for s in range(150):
        mag = float(np.clip(np.exp(rng.normal(0, P["illness_magnitude_sigma"])), 0.25, 4.0))
        m = simulate(Scenario(pre_days=120, flight_days=1, n_crew=1, events=[Event("illness", 0, 80, mag)]), 50000 + s)
        v = m.x[0, :, IND.index("rhr")]
        sim_c.append(v[80 + REL] - np.median(v[80 - 49:80 - 21]))
    sim_c = np.array(sim_c)

    def band(c):
        b = np.array([np.nanmean(c[rng.integers(0, len(c), len(c))], axis=0) for _ in range(1000)])
        return {"mean": np.nanmean(c, axis=0), "lo": np.percentile(b, 2.5, axis=0), "hi": np.percentile(b, 97.5, axis=0), "n": int(len(c))}
    illness = {"rel_day": REL, "real": band(real_c), "sim": band(sim_c), "real_source": "Stanford phases 1 and 2, validation half of people with a dated illness"}
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
        {"what": "Mean in-flight sleep", "unit": "h", "published": 6.09, "simulated": float(np.mean(fl["sleep"])), "ref": "31", "note": "ISS actigraphy, Barger et al. 2014"},
        {"what": "Nights under 6 h of sleep in flight", "unit": "%", "published": 43.8, "simulated": float(100 * np.mean(fl["lt6"])), "ref": "31", "note": "ISS, same study. Not used to tune the simulator."},
        {"what": "Body mass change after the first month", "unit": "%", "published": -3.6, "simulated": float(100 * np.mean(fl["mass"])), "ref": "52d", "note": "Published range -2.8% to -4.4%"},
        {"what": "Crew with space motion sickness", "unit": "%", "published": 70.0, "simulated": float(100 * np.mean(fl["sms"])), "ref": "52a", "note": "Published range 60% to 80%"},
        {"what": "Headache odds ratio, CO2 at or above 2.8 mmHg versus below 2.3", "unit": "ratio", "published": None,
         "simulated": float((np.nanmean(fl["head_hi"]) / (1 - np.nanmean(fl["head_hi"]))) / (np.nanmean(fl["head_lo"]) / (1 - np.nanmean(fl["head_lo"])))),
         "ref": "37", "note": "Published: odds double per 1 mmHg (expect about 1.9 between these bands). The simulated ratio is lower because simulated headaches also come from dehydration, illness and motion sickness."},
    ]
    for a in anchors:
        print("anchor", a["what"], a["published"], round(a["simulated"], 2))

    write_json(APP_PUBLIC / "results" / "realism.json", {
        "script": "research/scripts/sim_realism.py", "commit": git_commit(), "variability": variability, "illness": illness, "anchors": anchors,
        "note": "Real values come from the validation half of each dataset; the calibration script only saw the other half.",
    }, indent=1)


if __name__ == "__main__":
    main()
