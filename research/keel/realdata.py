"""Loaders for the real datasets (after build_daily.py), shared by calibration, evaluation and realism scripts."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
INTERIM = ROOT / "data" / "interim"
LIFESNAPS = ROOT / "data" / "raw" / "lifesnaps" / "extracted" / "daily_fitbit_sema_df_unprocessed.csv"


def stanford() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    daily = pd.read_csv(INTERIM / "stanford_daily.csv", parse_dates=["date"])
    events = pd.read_csv(INTERIM / "stanford_events.csv", parse_dates=["date"])
    people = pd.read_csv(INTERIM / "stanford_people.csv")
    return daily, events, people


def lifesnaps() -> pd.DataFrame:
    """LifeSnaps daily table mapped to Keel indicator names.  One row per user-day."""
    d = pd.read_csv(LIFESNAPS, low_memory=False)
    out = pd.DataFrame({
        "pid": d["id"].astype(str), "date": pd.to_datetime(d["date"]),
        "rhr": d["nremhr"],                              # heart rate in non-REM sleep: closest to overnight resting HR
        "hrv": d["rmssd"], "spo2": d["spo2"], "temp": d["nightly_temperature"],
        "sleep_h": d["minutesAsleep"] / 60.0, "steps": d["steps"],
        "ex_min": d["very_active_minutes"].fillna(0) + d["moderately_active_minutes"].fillna(0),
    })
    out.loc[(out["sleep_h"] < 1) | (out["sleep_h"] > 16), "sleep_h"] = np.nan
    out.loc[out["hrv"] <= 0, "hrv"] = np.nan
    # several rows per user-day exist in the release; keep the most complete one
    out["n"] = out[["rhr", "hrv", "spo2", "temp", "sleep_h"]].notna().sum(axis=1)
    out = out.sort_values(["pid", "date", "n"]).drop_duplicates(["pid", "date"], keep="last").drop(columns="n")
    return out.sort_values(["pid", "date"]).reset_index(drop=True)


def split_half(pids: list[str], seed: int = 7) -> tuple[set[str], set[str]]:
    """Deterministic split of people into a calibration half and a validation half."""
    rng = np.random.default_rng(seed)
    p = sorted(pids)
    idx = rng.permutation(len(p))
    cal = {p[i] for i in idx[: len(p) // 2]}
    return cal, set(p) - cal


def within_stats(df: pd.DataFrame, col: str, log: bool = False, min_days: int = 21) -> pd.DataFrame:
    """Per-person mean, within-person SD (of day-to-day values) and lag-1 autocorrelation."""
    rows = []
    for pid, g in df.groupby("pid"):
        g = g.set_index("date")[col].astype(float)
        g = g.reindex(pd.date_range(g.index.min(), g.index.max(), freq="D"))
        v = np.log(g.where(g > 0)) if log else g
        if v.notna().sum() < min_days:
            continue
        # remove slow drift with a 28-day rolling median so the SD is day-to-day variation
        r = v - v.rolling(28, min_periods=7, center=True).median()
        a, b = r.iloc[:-1].to_numpy(), r.iloc[1:].to_numpy()
        ok = ~np.isnan(a) & ~np.isnan(b)
        ac = float(np.corrcoef(a[ok], b[ok])[0, 1]) if ok.sum() >= 10 else np.nan
        rows.append({"pid": pid, "mean": float(np.nanmean(v)), "sd": float(np.nanstd(r)), "ar1": ac, "n": int(v.notna().sum())})
    return pd.DataFrame(rows)


def event_pids(events: pd.DataFrame) -> list[str]:
    ev = events[events.kind.isin(["covid_symptom", "other_illness"])]
    return sorted(set(ev.dataset + ":" + ev.pid))


def aligned_curves(daily: pd.DataFrame, events: pd.DataFrame, datasets: list[str], rel: np.ndarray, col: str = "rhr",
                   only: set[str] | None = None) -> np.ndarray:
    """Event-aligned change from each person's own earlier baseline (days -49..-22 before onset).
    `only` restricts to people whose "dataset:pid" key is in the set."""
    curves = []
    for (ds, pid), g in daily[daily.dataset.isin(datasets)].groupby(["dataset", "pid"]):
        if only is not None and f"{ds}:{pid}" not in only:
            continue
        ev = events[(events.dataset == ds) & (events.pid == pid) & (events.kind.isin(["covid_symptom", "other_illness"]))]
        if ev.empty:
            continue
        g = g.set_index("date")[col]
        last = None
        for d in sorted(ev["date"]):
            if last is not None and (d - last).days <= 28:
                continue
            last = d
            base = g[(g.index >= d - pd.Timedelta(days=49)) & (g.index < d - pd.Timedelta(days=21))]
            if base.notna().sum() < 10:
                continue
            curves.append([g.get(d + pd.Timedelta(days=int(r)), np.nan) - base.median() for r in rel])
    return np.array(curves, float)
