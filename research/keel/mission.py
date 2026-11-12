"""Glue between the simulator and the detection/evaluation code."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .core import Phase
from .evaluate import Person
from .simulator import IND, Mission, load_params

ROOT = Path(__file__).resolve().parents[2]


def indicator_table() -> list[dict]:
    return json.loads((ROOT / "shared" / "indicators.json").read_text())["indicators"]


def detect_spec(ids: list[str] | None = None) -> dict:
    tab = {r["id"]: r for r in indicator_table()}
    ids = ids or [r["id"] for r in indicator_table() if r["detect"]]
    return {"indicators": ids, "transform": [tab[i]["transform"] for i in ids],
            "concern": [tab[i]["concern"] for i in ids], "floor": [tab[i]["floor"] for i in ids]}


def rolling_mean(v: np.ndarray, n: int = 7, min_valid: int = 4) -> np.ndarray:
    out = np.full(len(v), np.nan)
    for t in range(len(v)):
        w = v[max(0, t - n + 1):t + 1]
        w = w[~np.isnan(w)]
        if len(w) >= min_valid:
            out[t] = w.mean()
    return out


def features(x: np.ndarray, ids: list[str]) -> np.ndarray:
    """Map simulator columns (T, len(IND)) to detection features (T, len(ids))."""
    cols = []
    for i in ids:
        if i == "ex7":
            cols.append(rolling_mean(x[:, IND.index("ex_min")]))
        else:
            cols.append(x[:, IND.index(i)])
    return np.stack(cols, axis=1)


def adaptation_prior(ids: list[str], P: dict | None = None) -> dict:
    """Expected shift on entering microgravity, per detection feature, in transformed units.
    These are the published/assumed POPULATION values from shared/sim_params.json; each
    simulated crew member deviates from them individually."""
    P = P or load_params()
    shift = {"rhr": P["flight_rhr_shift"], "hrv": P["flight_lnhrv_shift"], "sleep_h": P["flight_sleep_shift"],
             "ex7": P["ex_flight_min"] * 6.15 / 7 - P["ex_ground_min"] * 6.15 / 7, "energy": P["energy_flight_pct"] - 100.0}
    tau = {"ex7": 4.0}
    return {"shift": [float(shift.get(i, 0.0)) for i in ids], "tau": [float(tau.get(i, P["adapt_tau_days"])) for i in ids]}


def phases_for(m: Mission, ids: list[str], aware: bool = True, kappa: float = 2.5) -> list[Phase] | None:
    if not aware:
        return None
    pr = adaptation_prior(ids)
    out = [Phase(m.scenario.pre_days, np.array(pr["shift"]), np.array(pr["tau"]), kappa)]
    if m.scenario.landing_day is not None:
        P = load_params()
        back = -P["lunar_recovery_fraction"] * np.array(pr["shift"])
        back[[i for i, k in enumerate(ids) if k in ("ex7", "energy", "sleep_h")]] = 0.0
        out.append(Phase(m.scenario.pre_days + m.scenario.landing_day, back, np.array(pr["tau"]), kappa))
    return out


def people_from(m: Mission, x: np.ndarray | None = None, ids: list[str] | None = None, aware: bool = True) -> list[Person]:
    """One Person per crew member.  Crew-wide events (crew = -1) count for everyone."""
    spec_ids = ids or detect_spec()["indicators"]
    X = m.x if x is None else x
    out = []
    for i in range(X.shape[0]):
        evs = [e for e in m.events if e.crew in (i, -1) and e.type != "spe"]
        out.append(Person(pid=f"{m.scenario.name}-{m.seed}-c{i}", x=features(X[i], spec_ids), onsets=[e.onset for e in evs],
                          phases=phases_for(m, spec_ids, aware), events_meta=[e.to_json() for e in evs]))
    return out
