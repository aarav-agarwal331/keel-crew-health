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
    # the 7-day exercise average lags by construction and crews ramp up over the first week
    tau = {"ex7": 9.0}
    return {"shift": [float(shift.get(i, 0.0)) for i in ids], "tau": [float(tau.get(i, P["adapt_tau_days"])) for i in ids]}


def phases_for(m: Mission, ids: list[str], aware: bool = True, kappa: float = 2.5, prior_scale: float = 1.0) -> list[Phase] | None:
    """prior_scale mis-specifies the expected shift on purpose (0 = no shift expected, 2 = twice
    the simulator's true population shift), to test how much the result leans on a correct prior."""
    if not aware:
        return None
    pr = adaptation_prior(ids)
    pr = {"shift": [v * prior_scale for v in pr["shift"]], "tau": pr["tau"]}
    out = [Phase(m.scenario.pre_days, np.array(pr["shift"]), np.array(pr["tau"]), kappa)]
    if m.scenario.landing_day is not None:
        P = load_params()
        back = -P["lunar_recovery_fraction"] * np.array(pr["shift"])
        back[[i for i, k in enumerate(ids) if k in ("ex7", "energy", "sleep_h")]] = 0.0
        out.append(Phase(m.scenario.pre_days + m.scenario.landing_day, back, np.array(pr["tau"]), kappa))
    return out


def people_from(m: Mission, x: np.ndarray | None = None, ids: list[str] | None = None, aware: bool = True, prior_scale: float = 1.0) -> list[Person]:
    """One Person per crew member.  Crew-wide events (crew = -1) count for everyone."""
    spec_ids = ids or detect_spec()["indicators"]
    X = m.x if x is None else x
    out = []
    for i in range(X.shape[0]):
        evs = [e for e in m.events if e.crew in (i, -1) and e.type != "spe"]
        out.append(Person(pid=f"{m.scenario.name}-{m.seed}-c{i}", x=features(X[i], spec_ids), onsets=[e.onset for e in evs],
                          phases=phases_for(m, spec_ids, aware, prior_scale=prior_scale), events_meta=[e.to_json() for e in evs]))
    return out


# Two-channel setting that exists in BOTH the real illness data and the simulator: overnight
# resting heart rate, and the 7-day mean of daily activity on the log scale (steps on Earth,
# exercise minutes for the simulated crew).  Used for the like-for-like and transfer checks.
SPEC2 = {"indicators": ["rhr", "act7"], "transform": ["none", "log"], "concern": [1, -1], "floor": [1.5, 0.05]}


def ground_people(n_missions: int, seed0: int, events_per: int = 2, p_wear: float = 0.3, days: int = 240) -> list[Person]:
    """Simulated people on the ground (no gravity change), with illnesses of realistic sizes
    and wear time similar to the real data.  Features follow SPEC2."""
    from .simulator import Event, Scenario, apply_missing, illness_magnitude, simulate
    P = load_params()
    rng = np.random.default_rng(seed0)
    out = []
    for s in range(n_missions):
        sc = Scenario(pre_days=days, flight_days=1)
        onsets: list[int] = []
        while len(onsets) < events_per:
            t = int(rng.integers(70, days - 30))
            if all(abs(t - o) >= 35 for o in onsets):
                onsets.append(t)
        sc.events = [Event("illness", int(rng.integers(0, sc.n_crew)), t, illness_magnitude(rng, P["illness_magnitude_cv"])) for t in sorted(onsets)]
        m = simulate(sc, seed0 + s)
        x = apply_missing(m, seed0 + s, p_wear=p_wear)
        for i in range(x.shape[0]):
            ev = [e for e in sc.events if e.crew == i]
            out.append(Person(pid=f"ground-{seed0 + s}-c{i}", x=features(x[i, :days], ["rhr", "ex7"]), onsets=[e.onset for e in ev], events_meta=[e.to_json() for e in ev]))
    return out
