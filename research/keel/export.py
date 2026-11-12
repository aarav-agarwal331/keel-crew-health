"""Write models, missions and results as static JSON for the app."""
from __future__ import annotations

import json
import subprocess
from dataclasses import asdict
from pathlib import Path

import numpy as np

from .core import Model, Params
from .simulator import ENV, IND, SYMPTOMS, Mission

ROOT = Path(__file__).resolve().parents[2]
APP_PUBLIC = ROOT / "app" / "public"


def git_commit() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip() or "uncommitted"
    except Exception:
        return "unknown"


def clean(o):
    """JSON-safe: NaN/inf -> None, numpy -> python."""
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, np.ndarray):
        return clean(o.tolist())
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return f if np.isfinite(f) else None
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    return o


def write_json(path: Path, obj, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean(obj), indent=indent, ensure_ascii=False, separators=None if indent else (",", ":")))


def model_json(model: Model, p: Params, thresholds: dict, meta: dict) -> dict:
    return {
        **meta,
        "indicators": model.indicators, "transform": model.transform, "concern": model.concern, "floor": model.floor,
        "pop_mean": model.pop_mean, "pop_sd": model.pop_sd, "corr": model.corr,
        "h_cusum": model.h_cusum, "h_mewma": model.h_mewma,
        "adjust": [{"target": model.indicators[t], "cov": model.indicators[c], "lag": lag, "beta": b} for t, c, lag, b in model.adjust],
        "params": asdict(p), "thresholds": thresholds,
    }


def r(v: np.ndarray, nd: int) -> list:
    return [None if np.isnan(a) else round(float(a), nd) for a in v]


DEC = {"rhr": 1, "hrv": 1, "spo2": 1, "temp": 2, "sleep_h": 2, "sleep_mid": 2, "ex_min": 0, "pvt_rt": 0, "mood": 0,
       "fluid": 2, "energy": 0, "mass": 1, "sbp": 0, "glucose": 0}


def mission_json(m: Mission, x: np.ndarray, crew: list[dict], phases: list[dict], extra: dict) -> dict:
    sc = m.scenario
    series, symptoms = {}, {}
    for i, c in enumerate(crew):
        series[c["id"]] = {k: r(x[i, :, j], DEC[k]) for j, k in enumerate(IND)}
        symptoms[c["id"]] = {s: [int(t) for t in np.where(m.symptoms[i, :, j])[0]] for j, s in enumerate(SYMPTOMS)}
    return {
        "id": sc.name, "title": sc.title, "simulated": True, "seed": m.seed,
        "days": sc.T, "pre_days": sc.pre_days, "flight_days": sc.flight_days, "landing_day": sc.landing_day,
        "crew": crew, "phases": phases, "series": series, "symptoms": symptoms,
        "env": {"co2": r(m.env[:, 0], 2), "rad": r(m.env[:, 1], 3)},
        "truth": [e.to_json() for e in m.events], **extra,
    }
