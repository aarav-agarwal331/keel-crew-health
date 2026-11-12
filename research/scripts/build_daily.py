"""make data (part 2): reduce the Stanford COVID-19 wearables data to one row per person-day.

Inputs (downloaded by fetch_data.py into data/raw/):
  phase 1  Mishra et al. 2020, Nat Biomed Eng: per-person heart rate, steps and sleep CSVs + Supplementary Table 3/4
  phase 2  Alavi et al. 2022, Nat Med: per-person Fitbit/Apple Watch heart rate and steps + Source Data
Outputs (data/interim/):
  stanford_daily.csv   dataset,pid,date,rhr,rhr_day,steps,sleep_h,wear_min
  stanford_events.csv  dataset,pid,kind,date            kind: covid_symptom | covid_test | other_illness
  stanford_people.csv  dataset,pid,group,device,n_days

Daily features (docs/METHOD.md section 2):
  rhr      median heart rate over minutes between 00:00 and 07:00 with no steps in the previous
           12 minutes (the resting definition of Mishra et al.), needs >= 30 such minutes
  rhr_day  same resting definition over the whole day, needs >= 60 minutes
  steps    total steps that day, only if the device was worn most of the day (Fitbit: >= 600 min of
           heart rate; other devices: step records in >= 10 different hours)
  sleep_h  hours in non-wake sleep stages in the night ending that day (phase 1 only)
Dates in both releases were shifted by the authors to protect identity; only intervals matter.
"""
import gzip
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

import numpy as np
import pandas as pd

RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "interim"


def daily_features(hr: pd.DataFrame, st: pd.DataFrame | None, sleep: pd.DataFrame | None, sparse_hr: bool = False) -> pd.DataFrame:
    hr = hr.dropna()
    hr = hr[(hr["heartrate"] >= 30) & (hr["heartrate"] <= 220)]
    if hr.empty:
        return pd.DataFrame()
    m = hr.set_index("datetime")["heartrate"].resample("1min").mean().dropna()
    if st is not None and not st.empty:
        s = st.set_index("datetime")["steps"].resample("1min").sum()
        lo, hi = min(m.index.min(), s.index.min()), max(m.index.max(), s.index.max())
        s = s.reindex(pd.date_range(lo, hi, freq="1min"), fill_value=0.0)
        still = (s.rolling(12, min_periods=1).sum() == 0).reindex(m.index, fill_value=True)
        steps_day = s.groupby(s.index.date).sum()
        st_hours = st.groupby(st["datetime"].dt.date)["datetime"].agg(lambda v: v.dt.hour.nunique())
    else:
        still = pd.Series(True, index=m.index)
        steps_day = pd.Series(dtype=float)
        st_hours = pd.Series(dtype=float)
    rest = m[still.values]
    night = rest[rest.index.hour < 7]
    g = pd.DataFrame({
        "rhr": night.groupby(night.index.date).agg(lambda v: v.median() if len(v) >= 30 else np.nan),
        "rhr_day": rest.groupby(rest.index.date).agg(lambda v: v.median() if len(v) >= 60 else np.nan),
        "wear_min": m.groupby(m.index.date).size(),
    })
    g["steps"] = steps_day.reindex(g.index)
    # a day's step total is trusted only if the device was worn most of the day.  Fitbit logs
    # heart rate continuously, so 600 minutes of heart rate is the test.  Other devices sample
    # heart rate sparsely, so for them the test is step records in at least 10 different hours.
    worn = (st_hours.reindex(g.index).fillna(0) >= 10) if sparse_hr else (g["wear_min"] >= 600)
    g.loc[~worn, "steps"] = np.nan
    if sleep is not None and not sleep.empty:
        sl = sleep[~sleep["stage"].astype(str).str.lower().isin(["wake", "awake", "restless"])].copy()
        sl["night"] = (sl["datetime"] + pd.Timedelta(hours=6)).dt.date   # 18:00 belongs to the next day's night
        h = sl.groupby("night")["stage_duration"].sum() / 3600.0
        g["sleep_h"] = h.reindex(g.index)
        g.loc[(g["sleep_h"] < 1) | (g["sleep_h"] > 16), "sleep_h"] = np.nan
    else:
        g["sleep_h"] = np.nan
    g.index = pd.to_datetime(g.index)
    full = pd.date_range(g.index.min(), g.index.max(), freq="D")
    return g.reindex(full).rename_axis("date").reset_index()


def parse_dates(cell) -> list[pd.Timestamp]:
    if cell is None:
        return []
    if isinstance(cell, (pd.Timestamp,)) or hasattr(cell, "year"):
        return [pd.Timestamp(cell)]
    return [pd.Timestamp(d) for d in re.findall(r"\d{4}-\d{2}-\d{2}", str(cell))]


def phase1() -> tuple[list[pd.DataFrame], list[dict], list[dict]]:
    import openpyxl
    base = RAW / "stanford_covid_wearables_phase1"
    wb = openpyxl.load_workbook(base / "41551_2020_640_MOESM3_ESM.xlsx", read_only=True, data_only=True)
    events, group = [], {}
    for r in list(wb["SuppTable3_Fig2a_COVID-19"].iter_rows(values_only=True))[4:]:
        if not r[0]:
            continue
        pid, cat = str(r[0]).strip(), str(r[1]).strip()
        group[pid] = "covid" if cat == "COVID-19" else cat.lower()
        if cat != "COVID-19":
            # other illnesses listed in this table carry a symptom date too
            for d in parse_dates(r[2]):
                events.append({"dataset": "phase1", "pid": pid, "kind": "other_illness", "date": d.date()})
            continue
        for d in parse_dates(r[2]):
            events.append({"dataset": "phase1", "pid": pid, "kind": "covid_symptom", "date": d.date()})
        for d in parse_dates(r[3]):
            events.append({"dataset": "phase1", "pid": pid, "kind": "covid_test", "date": d.date()})
    for r in list(wb["SuppTable4_Fig2a_Illnesses"].iter_rows(values_only=True))[5:]:
        if not r[0] or r[1] is None:
            continue
        pid = str(r[0]).strip()
        group.setdefault(pid, "other_illness")
        events.append({"dataset": "phase1", "pid": pid, "kind": "other_illness", "date": pd.Timestamp(r[1]).date()})
    frames, people = [], []
    with zipfile.ZipFile(base / "COVID-19-Wearables.zip") as z:
        names = z.namelist()
        hr_files = sorted(n for n in names if n.endswith("_hr.csv"))
        for i, n in enumerate(hr_files):
            pid = Path(n).name[:-len("_hr.csv")]
            rd = lambda nm, cols: pd.read_csv(z.open(nm), usecols=cols, parse_dates=["datetime"])  # noqa: E731
            hr = rd(n, ["datetime", "heartrate"])
            sn, ln = n.replace("_hr.csv", "_steps.csv"), n.replace("_hr.csv", "_sleep.csv")
            st = rd(sn, ["datetime", "steps"]) if sn in names else None
            sl = rd(ln, ["datetime", "stage_duration", "stage"]) if ln in names else None
            for suffix, target in (("_hr_longterm.csv", "hr"), ("_steps_longterm.csv", "st")):
                lt = n.replace("_hr.csv", suffix)
                if lt in names:   # a few people have an extra long-term file; append what precedes the short-term one
                    extra = rd(lt, ["datetime", "heartrate" if target == "hr" else "steps"])
                    if target == "hr":
                        hr = pd.concat([extra[extra["datetime"] < hr["datetime"].min()], hr])
                    elif st is not None:
                        st = pd.concat([extra[extra["datetime"] < st["datetime"].min()], st])
            g = daily_features(hr, st, sl)
            if g.empty:
                continue
            g.insert(0, "pid", pid)
            g.insert(0, "dataset", "phase1")
            frames.append(g)
            people.append({"dataset": "phase1", "pid": pid, "group": group.get(pid, "no_reported_illness"), "device": "Fitbit", "mode": "retrospective", "n_days": len(g)})
            print(f"phase1 {i + 1}/{len(hr_files)} {pid} {len(g)} days", flush=True)
    return frames, events, people


def phase2() -> tuple[list[pd.DataFrame], list[dict], list[dict]]:
    import openpyxl
    base = RAW / "stanford_covid_wearables_phase2"
    wb = openpyxl.load_workbook(base / "41591_2021_1593_MOESM3_ESM.xlsx", read_only=True, data_only=True)
    events, device, mode = [], {}, {}
    for r in list(wb["SourceData_COVID19_Positives"].iter_rows(values_only=True))[1:]:
        if not r[0]:
            continue
        pid = str(r[0]).strip()
        device[pid] = str(r[4])
        mode[pid] = str(r[3]).strip().lower()
        if r[2] and str(r[2]).strip() not in ("-", "None"):
            events.append({"dataset": "phase2", "pid": pid, "kind": "covid_symptom", "date": pd.Timestamp(str(r[2])).date()})
        if r[1] and str(r[1]).strip() not in ("-", "None"):
            events.append({"dataset": "phase2", "pid": pid, "kind": "covid_test", "date": pd.Timestamp(str(r[1])).date()})
    frames, people = [], []
    dirs = [(d, grp) for grp in ("covid_positive", "non_positive_sample") for d in sorted((base / grp).iterdir()) if d.is_dir()]
    for i, (d, grp) in enumerate(dirs):
        def rd(patterns, col):
            for f in sorted(d.iterdir()):
                if any(p in f.name for p in patterns):
                    try:
                        with gzip.open(f, "rt") as fh:
                            df = pd.read_csv(fh)
                    except pd.errors.EmptyDataError:
                        return None
                    if df.empty:
                        return None
                    df.columns = [c.strip().lower() for c in df.columns]
                    # Fitbit files: datetime,value.  Other devices: device,datetime,heartrate or
                    # device,start_datetime,end_datetime,steps (interval credited to its start minute)
                    tcol = next((c for c in ("datetime", "start_datetime") if c in df.columns), df.columns[0])
                    vcol = col if col in df.columns else df.columns[-1]
                    out = pd.DataFrame({"datetime": pd.to_datetime(df[tcol], errors="coerce"), col: pd.to_numeric(df[vcol], errors="coerce")})
                    return out.dropna()
            return None
        hr = rd(["_HR."], "heartrate")
        st = rd(["_ST."], "steps")
        if hr is None or hr.empty:
            continue
        non_fitbit = any("NonFitbit" in f.name for f in d.iterdir())
        g = daily_features(hr, st, None, sparse_hr=non_fitbit)
        if g.empty:
            continue
        g.insert(0, "pid", d.name)
        g.insert(0, "dataset", "phase2")
        frames.append(g)
        people.append({"dataset": "phase2", "pid": d.name, "group": "covid" if grp == "covid_positive" else "non_positive",
                       "device": device.get(d.name, "Other" if non_fitbit else "Fitbit"), "mode": mode.get(d.name, ""), "n_days": len(g)})
        print(f"phase2 {i + 1}/{len(dirs)} {d.name} {len(g)} days", flush=True)
    return frames, events, people


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    which = sys.argv[1:] or ["phase1", "phase2"]
    frames, events, people = [], [], []
    for w in which:
        f, e, p = phase1() if w == "phase1" else phase2()
        frames += f
        events += e
        people += p
    daily = pd.concat(frames, ignore_index=True)
    daily["date"] = pd.to_datetime(daily["date"]).dt.date
    for c in ["rhr", "rhr_day", "sleep_h"]:
        daily[c] = daily[c].round(2)
    tag = "" if len(which) == 2 else "_" + which[0]
    daily[["dataset", "pid", "date", "rhr", "rhr_day", "steps", "sleep_h", "wear_min"]].to_csv(OUT / f"stanford_daily{tag}.csv", index=False)
    pd.DataFrame(events).drop_duplicates().to_csv(OUT / f"stanford_events{tag}.csv", index=False)
    pd.DataFrame(people).to_csv(OUT / f"stanford_people{tag}.csv", index=False)
    print("people", len(people), "person-days", len(daily), "events", len(events))


if __name__ == "__main__":
    main()
