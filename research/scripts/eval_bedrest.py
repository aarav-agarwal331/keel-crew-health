"""make validate (part 4): does the mission-phase handling work on REAL analog data?

Data: NASA Life Sciences Data Archive, public head-down-tilt bed-rest campaigns (UTMB campaigns
1, 3 and the 70-day CFT70 study): one nurse-taken pulse per subject per day, with the protocol
phase (before, during, after bed rest) on every row.  Going into and coming out of bed rest is a
gravity-like transition for the cardiovascular system, so it is the closest open, real stand-in
for "entering microgravity" and "landing".

Question: around each transition, how often would a personal baseline raise a pulse flag
(a) with a naive rolling baseline, (b) with Keel's phase-aware baseline whose expected shift is
learned from OTHER subjects (calibration half)?
Output: app/public/results/bedrest.json
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I

import numpy as np
import pandas as pd

from keel.core import Model, Params, Phase, concern_dev, zscores
from keel.export import APP_PUBLIC, code_version, git_commit, write_json
from keel.realdata import split_half

BASE = ROOT / "data" / "raw" / "nasa_lsda_nlsp_public" / "CRF"
DIRS = ["UTMB_Bedrest_Campaign_3_Daily_Vitals", "UTMB_Bedrest_Campaign_1_Daily_Vitals", "CRF_CFT70_VITALS_DATA"]
WINDOW_AFTER = 14     # days after a transition that are examined
FLAG_U = 2.0          # a flag = pulse at least 2 robust SD above the personal baseline ...
K, N = 2, 3           # ... on 2 of 3 consecutive days


def load() -> dict[str, pd.DataFrame]:
    out = {}
    for d in DIRS:
        for f in sorted((BASE / d).glob("*.csv")):
            df = pd.read_csv(f, encoding="utf-8-sig")
            cols = {c.lower().strip(): c for c in df.columns}
            pick = lambda *names: next((cols[k] for k in cols for n in names if k.startswith(n)), None)  # noqa: E731
            c_date, c_phase, c_pulse = pick("date"), pick("test_phase", "phase"), pick("pulse", "heart rate", "hr")
            if not (c_date and c_phase and c_pulse):
                continue
            g = pd.DataFrame({"date": pd.to_datetime(df[c_date], errors="coerce"), "phase": df[c_phase].astype(str).str.upper().str.strip(),
                              "pulse": pd.to_numeric(df[c_pulse], errors="coerce")}).dropna(subset=["date"])
            g = g[(g.pulse.isna()) | ((g.pulse > 30) & (g.pulse < 160))]
            g = g.groupby("date").agg(phase=("phase", "first"), pulse=("pulse", "mean")).sort_index()
            if g.pulse.notna().sum() >= 40 and {"PRE_TEST", "IN_TEST"} <= set(g.phase):
                out[f"{d.split('_')[2] if 'Campaign' in d else 'CFT70'}:{f.stem[-8:]}"] = g
    return out


def transitions(g: pd.DataFrame) -> tuple[np.ndarray, list[tuple[int, str]]]:
    full = g.reindex(pd.date_range(g.index.min(), g.index.max(), freq="D"))
    ph = full.phase.ffill().to_numpy()
    tr = [(i, f"{ph[i - 1]}>{ph[i]}") for i in range(1, len(ph)) if ph[i] != ph[i - 1] and f"{ph[i - 1]}>{ph[i]}" in ("PRE_TEST>IN_TEST", "IN_TEST>POST_TEST")]
    return full.pulse.to_numpy(float), tr


def main():
    subj = load()
    cal, val = split_half(sorted(subj))
    p = Params()
    model = Model(indicators=["pulse"], transform=["none"], concern=np.array([1.0]), floor=np.array([2.0]), pop_mean=np.zeros(1), pop_sd=np.ones(1), corr=np.eye(1))
    # expected shift at each transition, from the calibration half: median over subjects of
    # (median of days 4-14 after) - (median of the 14 days before)
    shift = {}
    for name in ("PRE_TEST>IN_TEST", "IN_TEST>POST_TEST"):
        d = []
        for s in cal:
            x, tr = transitions(subj[s])
            for i, n in tr:
                if n == name and np.sum(~np.isnan(x[max(0, i - 14):i])) >= 5 and np.sum(~np.isnan(x[i + 3:i + 14])) >= 3:
                    d.append(np.nanmedian(x[i + 3:i + 14]) - np.nanmedian(x[max(0, i - 14):i]))
        shift[name] = {"median": float(np.median(d)), "iqr": [float(v) for v in np.percentile(d, [25, 75])], "n": len(d)}
    print("expected pulse shift from the calibration half:", shift)

    def flags(u: np.ndarray, i: int) -> bool:
        seg = u[i:i + WINDOW_AFTER]
        hit = np.nan_to_num(seg, nan=-9) >= FLAG_U
        return any(hit[t:t + N].sum() >= K for t in range(0, max(1, len(seg) - N + 1)))

    variants = {
        "naive": lambda tr: None,
        "reset": lambda tr: [Phase(i, np.array([0.0]), np.array([4.0]), 1.0) for i, n in tr],          # baseline restarts at the transition, nothing else
        "reset_widen": lambda tr: [Phase(i, np.array([0.0]), np.array([4.0]), 2.5) for i, n in tr],    # ... and the band is widened
        "aware": lambda tr: [Phase(i, np.array([shift[n]["median"]]), np.array([4.0]), 2.5) for i, n in tr],  # ... and the learned shift is expected
    }
    rows = []
    qd = {k: 0 for k in variants}
    qf = {k: 0 for k in variants}
    for s in val:
        x, tr = transitions(subj[s])
        zs = {k: concern_dev(zscores(x[:, None], model, p, mk(tr))[0], model.concern)[:, 0] for k, mk in variants.items()}
        near = np.zeros(len(x), bool)
        for i, n in tr:
            near[i:i + WINDOW_AFTER] = True
            if all(np.sum(~np.isnan(z[i:i + WINDOW_AFTER])) >= 5 for z in zs.values()):
                rows.append({"subject": s, "transition": n, **{k: bool(flags(z, i)) for k, z in zs.items()},
                             "naive_mean_u": float(np.nanmean(zs["naive"][i:i + WINDOW_AFTER])), "aware_mean_u": float(np.nanmean(zs["aware"][i:i + WINDOW_AFTER]))})
        for key, z in zs.items():
            far = ~near & ~np.isnan(z)
            qd[key] += int(far.sum())
            qf[key] += int((z[far] >= FLAG_U).sum())

    def mcnemar(a: list[bool], b: list[bool]) -> float:
        """Exact two-sided McNemar test on paired yes/no outcomes."""
        from math import comb
        n01 = sum(1 for u, v in zip(a, b) if u and not v)
        n10 = sum(1 for u, v in zip(a, b) if v and not u)
        n = n01 + n10
        if n == 0:
            return 1.0
        k = min(n01, n10)
        return min(1.0, 2 * sum(comb(n, j) for j in range(k + 1)) / 2 ** n)

    res = {}
    for name in ("PRE_TEST>IN_TEST", "IN_TEST>POST_TEST"):
        r = [q for q in rows if q["transition"] == name]
        res[name] = {"n": len(r), **{f"{k}_flagged": sum(q[k] for q in r) for k in variants},
                     "p_naive_vs_aware": mcnemar([q["naive"] for q in r], [q["aware"] for q in r]),
                     "naive_mean_u": float(np.mean([q["naive_mean_u"] for q in r])) if r else None, "aware_mean_u": float(np.mean([q["aware_mean_u"] for q in r])) if r else None}
        print(name, res[name])
    write_json(APP_PUBLIC / "results" / "bedrest.json", {
        "script": "research/scripts/eval_bedrest.py", "commit": git_commit(), "code_version": code_version(),
        "data": "NASA Life Sciences Data Archive, public head-down-tilt bed-rest campaigns (UTMB campaigns 1 and 3, CFT70): daily nurse-taken pulse",
        "n_subjects": len(subj), "n_calibration": len(cal), "n_validation": len(val), "expected_shift_bpm": shift, "transitions": res,
        "days_outside_transitions": {k: {"days": qd[k], "share_of_days_at_or_above_2sd": qf[k] / max(1, qd[k])} for k in qd},
        "flag_rule": f"pulse at least {FLAG_U} robust SD above the personal baseline on {K} of {N} consecutive days within {WINDOW_AFTER} days after the transition",
        "labels": {"PRE_TEST>IN_TEST": "Going into bed rest (head-down tilt)", "IN_TEST>POST_TEST": "Getting up after bed rest (return to upright)"},
    }, indent=1)


if __name__ == "__main__":
    main()
