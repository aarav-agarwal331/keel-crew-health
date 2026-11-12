"""Physiological mission simulator.

Generates daily indicators for a crew over a pre-flight baseline period and a mission, with
microgravity adaptation, weekly exercise rhythm, sleep debt, a shared cabin environment and
scripted health events.  Every parameter lives in shared/sim_params.json with its provenance
(published / calibrated on real data / assumption).  Output is SIMULATED and is labelled so
wherever it is shown.

Model (per crew member i, day t), documented with equations in docs/METHOD.md section 3:
    latent drivers: adaptation a_t, sleep debt D_t, event intensities E^k_t, deconditioning C_t
    observation:    x_t = trait_i + flight_shift_i * a_t + sum_k beta_k * driver_k + AR(1) noise
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PARAMS_PATH = ROOT / "shared" / "sim_params.json"

IND = ["rhr", "hrv", "spo2", "temp", "sleep_h", "sleep_mid", "ex_min", "pvt_rt", "mood",
       "fluid", "energy", "mass", "sbp", "glucose"]
ENV = ["co2", "rad"]
SYMPTOMS = ["headache", "nausea", "congestion", "sore_throat", "fatigue", "back_pain", "dizziness", "vision"]
EVENT_TYPES = ["illness", "sleep_loss", "co2", "decond", "dehydration", "low_mood", "spe"]


def load_params() -> dict:
    raw = json.loads(PARAMS_PATH.read_text())
    return {k: v["value"] for k, v in raw["params"].items()}


@dataclass
class Event:
    type: str
    crew: int            # index; -1 = whole crew (environment events)
    onset: int           # day index when the condition becomes overt (symptom onset for illness)
    magnitude: float = 1.0
    duration: int = 0    # 0 = template default

    def to_json(self) -> dict:
        return {"type": self.type, "crew": self.crew, "onset": self.onset,
                "magnitude": self.magnitude, "duration": self.duration}


@dataclass
class Scenario:
    name: str = "mars_transit"
    title: str = "Mars transit"
    n_crew: int = 4
    pre_days: int = 30          # ground baseline before launch
    flight_days: int = 180
    gravity: str = "micro"      # 'micro' | 'lunar' (after landing_day)
    landing_day: int | None = None   # flight-day index of a second phase change (lunar landing)
    rad_key: str = "rad_transit"     # which daily dose-rate parameter applies in flight
    events: list[Event] = field(default_factory=list)

    @property
    def T(self) -> int:
        return self.pre_days + self.flight_days


@dataclass
class Mission:
    scenario: Scenario
    seed: int
    x: np.ndarray               # (n_crew, T, len(IND)) true-but-noisy observations, NaN = not measured
    env: np.ndarray             # (T, len(ENV))
    symptoms: np.ndarray        # (n_crew, T, len(SYMPTOMS)) bool
    traits: list[dict]
    events: list[Event]
    latent: dict                # ground-truth drivers, for tests and figures


def _ar1(rng: np.random.Generator, T: int, sd: float, rho: float) -> np.ndarray:
    e = rng.normal(0, sd * math.sqrt(1 - rho * rho), T)
    out = np.zeros(T)
    out[0] = rng.normal(0, sd)
    for t in range(1, T):
        out[t] = rho * out[t - 1] + e[t]
    return out


def _bump(T: int, start: int, rise: int, hold: int, fall: int) -> np.ndarray:
    """0 -> 1 linear rise over `rise` days from `start`, hold, exponential fall (time constant fall/3)."""
    out = np.zeros(T)
    for t in range(max(0, start), T):
        d = t - start
        if d < rise:
            out[t] = (d + 1) / rise
        elif d < rise + hold:
            out[t] = 1.0
        else:
            out[t] = math.exp(-(d - rise - hold + 1) / max(1.0, fall / 3))
            if out[t] < 0.02:
                break
    return out


def event_drivers(ev: Event, T: int, P: dict) -> dict[str, np.ndarray]:
    """Intensity time courses in [0, magnitude] for each latent channel an event drives."""
    z = np.zeros(T)
    m = ev.magnitude
    if ev.type == "illness":
        pro = int(P["illness_prodrome_days"])
        dur = ev.duration or int(P["illness_duration_days"])
        return {"illness": m * _bump(T, ev.onset - pro, pro + 2, int(P.get("illness_hold_days", 2)), dur),
                "symptomatic": (np.arange(T) >= ev.onset) & (np.arange(T) < ev.onset + dur)}
    if ev.type == "sleep_loss":
        dur = ev.duration or 8
        return {"sleep_cut": m * _bump(T, ev.onset, 1, dur, 3)}
    if ev.type == "co2":
        dur = ev.duration or 6
        return {"co2_add": m * _bump(T, ev.onset, 4, dur, 3)}
    if ev.type == "decond":
        dur = ev.duration or 21
        return {"ex_cut": np.clip(m, 0, 1.25) * _bump(T, ev.onset, 1, dur, 2)}
    if ev.type == "dehydration":
        dur = ev.duration or 5
        return {"fluid_cut": m * _bump(T, ev.onset, 2, dur, 3)}
    if ev.type == "low_mood":
        dur = ev.duration or 18
        return {"low_mood": m * _bump(T, ev.onset, 6, dur, 9)}
    if ev.type == "spe":
        return {"spe": m * _bump(T, ev.onset, 1, 1, 3)}
    return {"none": z}


def simulate(sc: Scenario, seed: int, P: dict | None = None) -> Mission:
    P = P or load_params()
    rng = np.random.default_rng(seed)
    T, L, n = sc.T, sc.pre_days, sc.n_crew
    day = np.arange(T)
    flight = day >= L
    fd = np.maximum(0, day - L)                      # flight day
    landing = None if sc.landing_day is None else L + sc.landing_day

    # ---- shared environment -------------------------------------------------------------
    co2 = np.where(flight, P["co2_flight_mean"], P["co2_ground_mean"]) + _ar1(rng, T, P["co2_sd"], 0.7)
    rad = np.where(flight, P[sc.rad_key], P["rad_ground"]) * (1 + _ar1(rng, T, P["rad_rel_sd"], 0.5))
    crew_events = [e for e in sc.events if e.crew < 0]
    for e in crew_events:
        d = event_drivers(e, T, P)
        if "co2_add" in d:
            co2 = co2 + P["co2_event_peak_add"] * d["co2_add"]
        if "spe" in d:
            rad = rad + P["spe_peak_dose"] * d["spe"]
    co2 = np.clip(co2, 0.2, None)
    rad = np.clip(rad, 0, None)
    co2_excess = np.maximum(0.0, co2 - P["co2_effect_threshold"])

    X = np.full((n, T, len(IND)), np.nan)
    S = np.zeros((n, T, len(SYMPTOMS)), dtype=bool)
    traits, latents = [], []
    for i in range(n):
        tr = {
            "rhr": rng.normal(P["rhr_mean"], P["rhr_between_sd"]),
            "lnhrv": rng.normal(math.log(P["hrv_median"]), P["lnhrv_between_sd"]),
            "spo2": min(99.5, rng.normal(P["spo2_mean"], 0.5)),
            "temp": rng.normal(P["temp_mean"], 0.15),
            "sleep_need": rng.normal(P["sleep_ground_mean"], 0.4),
            "chrono": rng.normal(0, 0.4),
            "pvt": rng.normal(P["pvt_mean"], P["pvt_between_sd"]),
            "mood": float(np.clip(rng.normal(4.1, 0.3), 3.2, 4.8)),
            "fluid": rng.normal(P["fluid_mean"], 0.25),
            "mass": rng.normal(76, 9),
            "sbp": rng.normal(118, 7),
            "glucose": rng.normal(90, 5),
            "rest_dow": int(rng.integers(0, 7)),
            # personal response to flight: population shift plus individual variation
            "d_rhr": rng.normal(P["flight_rhr_shift"], P["flight_rhr_shift_sd"]),
            "d_lnhrv": rng.normal(P["flight_lnhrv_shift"], 0.06),
            "d_sleep": rng.normal(P["flight_sleep_shift"], 0.3),
            "sms": bool(rng.random() < P["sms_incidence"]),
        }
        # some people's readings are simply noisier than others' (real wearables show this clearly)
        ns = {k: float(np.exp(rng.normal(0, P.get("within_sd_person_sigma", 0.0)))) for k in ["rhr", "lnhrv", "spo2", "temp", "sleep"]}
        tr["noise_scale"] = ns
        # ---- latent drivers ------------------------------------------------------------
        a = np.where(flight, 1 - np.exp(-fd / P["adapt_tau_days"]), 0.0)
        if landing is not None:  # partial gravity undoes a fraction of the microgravity shift
            a = np.where(day >= landing, a * (1 - P["lunar_recovery_fraction"] * (1 - np.exp(-(day - landing) / P["adapt_tau_days"]))), a)
        drv = {k: np.zeros(T) for k in ["illness", "sleep_cut", "ex_cut", "fluid_cut", "low_mood"]}
        symptomatic = np.zeros(T, dtype=bool)
        for e in sc.events:
            if e.crew == i:
                for k, v in event_drivers(e, T, P).items():
                    if k == "symptomatic":
                        symptomatic |= v
                    elif k in drv:
                        drv[k] = np.maximum(drv[k], v)
        sms = np.where(flight & (fd < P["sms_duration_days"]) & tr["sms"], 1.0, 0.0)
        if landing is not None and tr["sms"]:
            sms = np.maximum(sms, ((day >= landing) & (day < landing + 2)) * 0.5)

        # ---- sleep, sleep debt ---------------------------------------------------------
        n_sleep = _ar1(rng, T, P["sleep_within_sd"] * ns["sleep"], 0.25)
        sleep = (tr["sleep_need"] + tr["d_sleep"] * a - P["sleep_loss_cut_h"] * drv["sleep_cut"]
                 - 0.5 * drv["low_mood"] - 0.35 * np.minimum(co2_excess, 3) - 0.8 * sms
                 + 0.6 * drv["illness"] * (rng.random(T) - 0.6) * 2 + n_sleep)
        sleep = np.clip(sleep, 2.0, 11.0)
        mid = (tr["chrono"] + 2.5 * drv["sleep_cut"] + 0.6 * drv["low_mood"] + _ar1(rng, T, 0.45, 0.3))
        debt = np.zeros(T)
        for t in range(1, T):
            debt[t] = max(0.0, 0.75 * debt[t - 1] + (tr["sleep_need"] - sleep[t - 1]) * 0.5)
        debt = np.minimum(debt, 4.0)

        # ---- exercise and deconditioning ------------------------------------------------
        target = np.where(flight, P["ex_flight_min"], P["ex_ground_min"])
        rest = (day % 7) == tr["rest_dow"]
        ex = target * (1 - 0.8 * drv["ex_cut"]) * (1 - P["illness_exercise_cut"] * np.minimum(1, drv["illness"]) * symptomatic) * (1 - 0.35 * drv["low_mood"]) * (1 - 0.7 * sms)
        missed = rng.random(T) < P["ex_missed_session_prob"]
        ex = np.where(rest | missed, ex * 0.15, ex) + rng.normal(0, P["ex_within_sd"], T)
        ex = np.clip(ex, 0, None)
        dec = np.zeros(T)
        for t in range(1, T):
            wk = ex[max(0, t - 7):t].mean() / max(1.0, target[t] * (6.15 / 7))
            dec[t] = float(np.clip(dec[t - 1] + P["decond_rate"] * (0.7 - wk) if wk < 0.7 else dec[t - 1] - 0.03, 0, 1.5)) if flight[t] else 0.0
        ex_prev = np.concatenate([[ex[0]], ex[:-1]])
        ex_dev = (ex_prev - target) / 60.0

        # ---- hydration and nutrition ----------------------------------------------------
        fluid = np.clip(tr["fluid"] * (1 - 0.45 * drv["fluid_cut"]) * (1 - 0.3 * sms) + _ar1(rng, T, 0.3, 0.2), 0.3, None)
        dehyd = np.zeros(T)
        for t in range(1, T):
            dehyd[t] = float(np.clip(0.6 * dehyd[t - 1] + 0.5 * max(0.0, (tr["fluid"] - fluid[t - 1]) / tr["fluid"] - 0.15), 0, 1))
        energy = np.clip(np.where(flight, P["energy_flight_pct"], 100.0) - 30 * sms - 20 * np.minimum(1, drv["illness"]) * symptomatic
                         - 10 * drv["low_mood"] + _ar1(rng, T, 8, 0.3), 20, 130)
        mass = (tr["mass"] * (1 - P["mass_early_loss_frac"] * np.where(flight, 1 - np.exp(-fd / 10.0), 0.0))
                - 0.02 * np.cumsum(np.maximum(0, 85 - energy) / 15.0) * 0.1 - 1.2 * dehyd + rng.normal(0, 0.25, T))

        # ---- cardiovascular, temperature ------------------------------------------------
        ill = drv["illness"]
        rhr = (tr["rhr"] + tr["d_rhr"] * a + P["rhr_per_debt_h"] * debt + P["rhr_per_ex_hour"] * ex_dev
               + P["illness_rhr_peak"] * ill + P["decond_rhr_max"] * dec + P["dehyd_rhr"] * dehyd
               + 2.0 * sms + _ar1(rng, T, P["rhr_within_sd"] * ns["rhr"], P["rhr_ar1"]))
        lnhrv = (tr["lnhrv"] + tr["d_lnhrv"] * a - 0.04 * debt - 0.03 * ex_dev - P["illness_lnhrv_drop"] * ill
                 - 0.15 * dec - 0.12 * dehyd - 0.08 * drv["low_mood"] + _ar1(rng, T, P["lnhrv_within_sd"] * ns["lnhrv"], 0.4))
        spo2 = np.clip(tr["spo2"] - P["illness_spo2_drop"] * ill + rng.normal(0, P["spo2_within_sd"] * ns["spo2"], T), 85, 100)
        temp = tr["temp"] + P["illness_temp_peak"] * ill + 0.1 * dehyd + _ar1(rng, T, P["temp_within_sd"] * ns["temp"], 0.3)
        sbp = tr["sbp"] + P["flight_sbp_shift"] * a + 3 * dec - 4 * dehyd + rng.normal(0, 5, T)
        glucose = tr["glucose"] + 4 * np.minimum(1, ill) + rng.normal(0, 5, T)

        # ---- cognition and mood ---------------------------------------------------------
        pvt = (tr["pvt"] + P["pvt_per_debt_h"] * debt + P["pvt_per_co2_mmhg"] * co2_excess + 12 * np.minimum(1, ill)
               + 10 * drv["low_mood"] + 8 * sms + _ar1(rng, T, P["pvt_within_sd"], 0.3))
        iso = np.where(flight, P["mood_isolation_drift"] * np.sin(np.pi * np.clip(fd / max(1, sc.flight_days), 0, 1)), 0.0)
        mood_c = (tr["mood"] - 0.25 * debt - P["low_mood_drop"] * drv["low_mood"] - 0.6 * np.minimum(1, ill) * symptomatic
                  - 0.5 * sms - iso - 0.15 * np.minimum(co2_excess, 3) + _ar1(rng, T, 0.45, 0.35))
        mood = np.clip(np.round(mood_c), 1, 5)

        # ---- symptoms -------------------------------------------------------------------
        def bern(p):
            return rng.random(T) < np.clip(p, 0, 0.98)
        # headache: each +1 mmHg of CO2 doubles the odds (Law et al. 2014), anchored at the reference level
        odds = P["headache_base"] / (1 - P["headache_base"]) * P["headache_odds_per_mmhg"] ** (co2 - P["co2_effect_threshold"])
        p_head = odds / (1 + odds) + 0.35 * dehyd + 0.3 * symptomatic + 0.3 * sms
        S[i, :, SYMPTOMS.index("headache")] = bern(p_head)
        S[i, :, SYMPTOMS.index("nausea")] = bern(0.005 + 0.8 * sms + 0.1 * symptomatic)
        S[i, :, SYMPTOMS.index("congestion")] = bern(np.where(flight, 0.08, 0.02) + 0.5 * symptomatic)
        S[i, :, SYMPTOMS.index("sore_throat")] = bern(0.005 + 0.6 * symptomatic)
        S[i, :, SYMPTOMS.index("fatigue")] = bern(0.03 + 0.12 * debt + 0.5 * symptomatic + 0.25 * drv["low_mood"])
        S[i, :, SYMPTOMS.index("back_pain")] = bern(np.where(flight & (fd < 10), 0.35, 0.02))
        S[i, :, SYMPTOMS.index("dizziness")] = bern(0.005 + 0.3 * sms + 0.25 * dehyd)
        S[i, :, SYMPTOMS.index("vision")] = bern(np.where(flight, 0.004 + 0.00004 * fd, 0.001))

        cols = {"rhr": rhr, "hrv": np.exp(lnhrv), "spo2": spo2, "temp": temp, "sleep_h": sleep, "sleep_mid": mid,
                "ex_min": ex, "pvt_rt": pvt, "mood": mood, "fluid": fluid, "energy": energy, "mass": mass,
                "sbp": sbp, "glucose": glucose}
        for j, k in enumerate(IND):
            X[i, :, j] = cols[k]
        # spot measurements are not daily: body mass, blood pressure and glucose weekly
        for k in ["mass", "sbp", "glucose"]:
            keep = (day % 7) == ((i + IND.index(k)) % 7)
            X[i, ~keep, IND.index(k)] = np.nan
        traits.append(tr)
        latents.append({"adapt": a, "debt": debt, "decond": dec, "dehyd": dehyd, "sms": sms, **drv,
                        "symptomatic": symptomatic})

    return Mission(sc, seed, X, np.stack([co2, rad], axis=1), S, traits, list(sc.events), {"crew": latents})


WEARABLE = ["rhr", "hrv", "spo2", "temp", "sleep_h", "sleep_mid"]
CHECKIN = ["pvt_rt", "mood", "fluid", "energy"]


def apply_missing(m: Mission, seed: int, p_wear: float = 0.04, p_checkin: float = 0.10,
                  block_rate: float = 0.01, block_len: int = 4) -> np.ndarray:
    """Return a copy of m.x with realistic missingness: the wearable channels drop together
    (device not worn or charging), check-in channels drop together (check-in skipped), plus
    multi-day wearable outages starting with probability block_rate per day."""
    rng = np.random.default_rng(seed)
    X = m.x.copy()
    n, T, _ = X.shape
    wi = [IND.index(k) for k in WEARABLE]
    ci = [IND.index(k) for k in CHECKIN]
    for i in range(n):
        off = rng.random(T) < p_wear
        for t in np.where(rng.random(T) < block_rate)[0]:
            off[t:t + block_len] = True
        skip = rng.random(T) < p_checkin
        X[i][np.ix_(off, wi)] = np.nan
        X[i][np.ix_(skip, ci)] = np.nan
    return X


def random_events(rng: np.random.Generator, sc: Scenario, n_events: int, types: list[str] | None = None,
                  magnitudes: tuple[float, ...] = (0.5, 1.0, 1.5, 2.0), min_gap: int = 35, illness_spread: bool = True) -> list[Event]:
    """Scatter events through the flight with a quiet gap between them so each can be scored alone."""
    types = types or ["illness", "sleep_loss", "co2", "decond", "dehydration", "low_mood"]
    lo, hi = sc.pre_days + 30, sc.T - 30
    onsets: list[int] = []
    tries = 0
    while len(onsets) < n_events and tries < 500:
        tries += 1
        t = int(rng.integers(lo, hi))
        if all(abs(t - o) >= min_gap for o in onsets):
            onsets.append(t)
    out = []
    sigma = load_params().get("illness_magnitude_sigma", 1.0)
    for t in sorted(onsets):
        ty = str(rng.choice(types))
        crew = -1 if ty in ("co2", "spe") else int(rng.integers(0, sc.n_crew))
        # illness size follows the spread seen between real episodes (log-normal around the
        # fitted mean response); other event types use the fixed grid
        mag = float(np.clip(np.exp(rng.normal(0, sigma)), 0.25, 4.0)) if ty == "illness" and illness_spread else float(rng.choice(magnitudes))
        out.append(Event(ty, crew, t, mag))
    return out
