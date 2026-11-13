"""make sim: generate the demo missions shown in the app.  Everything written here is SIMULATED.

Outputs: app/public/data/missions/mars_transit.json, lunar_surface.json
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))  # our own package; scripts run with python -I
import numpy as np

from keel.export import APP_PUBLIC, git_commit, mission_json, write_json
from keel.mission import adaptation_prior, detect_spec
from keel.simulator import Event, Scenario, apply_missing, load_params, simulate

CREW = [
    {"id": "c0", "name": "Amara Okafor", "role": "commander", "role_label": "Commander"},
    {"id": "c1", "name": "Kenji Sato", "role": "cmo", "role_label": "Crew medical officer"},
    {"id": "c2", "name": "Lucía Reyes", "role": "crew", "role_label": "Flight engineer"},
    {"id": "c3", "name": "Tomás Novák", "role": "crew", "role_label": "Mission specialist"},
]
EVENT_LABELS = {
    "illness": "Scripted illness (infection-like strain)", "sleep_loss": "Scripted sleep restriction (schedule shift)",
    "co2": "Scripted cabin CO2 rise (scrubber degradation)", "decond": "Scripted exercise device outage",
    "dehydration": "Scripted low fluid intake", "low_mood": "Scripted low-mood period", "spe": "Scripted solar particle event",
}


def phases_json(sc: Scenario, ids: list[str]) -> list[dict]:
    P = load_params()
    pr = adaptation_prior(ids)
    out = [{"start": sc.pre_days, "name": "Microgravity", "label": "Launch: entering microgravity",
            "indicators": ids, "shift": pr["shift"], "tau": pr["tau"], "kappa": 2.5}]
    if sc.landing_day is not None:
        back = [0.0 if k in ("ex7", "energy", "sleep_h") else -P["lunar_recovery_fraction"] * s for k, s in zip(ids, pr["shift"])]
        out.append({"start": sc.pre_days + sc.landing_day, "name": "Lunar gravity", "label": "Landing: one-sixth gravity",
                    "indicators": ids, "shift": back, "tau": pr["tau"], "kappa": 2.5})
    return out


def build(sc: Scenario, seed: int, extra: dict) -> dict:
    m = simulate(sc, seed)
    x = apply_missing(m, seed + 1)
    ids = detect_spec()["indicators"]
    j = mission_json(m, x, CREW, phases_json(sc, ids), {"script": "research/scripts/run_sim.py", "commit": git_commit(), **extra})
    P = load_params()
    for e in j["truth"]:
        e["label"] = EVENT_LABELS[e["type"]]
        if e["type"] == "illness":
            e["detail"] = (f"Scripted at {e['magnitude']:g} times the simulator's illness template (fitted to real data; template peak {P['illness_rhr_peak']:.1f} bpm, while real episodes rose about 4.6 bpm on average over the four days from onset): "
                           f"a peak resting heart rate rise of about {e['magnitude'] * P['illness_rhr_peak']:.0f} bpm. That matches the published median among cases a detector caught, "
                           f"so this is an easy case. The simulated rise starts up to {P['illness_prodrome_days']:.0f} days before the symptom day. "
                           "Real responses vary widely; in the simulator about three illnesses in ten have no heart-rate rise at all.")
    return j


def main(ill_fd: dict | None = None):
    """ill_fd optionally moves the scripted illness (flight day) in each demo mission; it is set
    by fit_mission_model.py so that the replay starts from two quiet weeks."""
    ill_fd = {"mars_transit": 124, "lunar_surface": 30, **(ill_fd or {})}
    L = 30
    # the scripted illness peaks at about 7 bpm: the published median rise among detected cases
    # (DOMAIN ref 58) and near the upper quartile of the real episodes the simulator was fitted to
    ILL = round(7.0 / load_params()["illness_rhr_peak"], 2)
    mars = Scenario(name="mars_transit", title="Mars transit", pre_days=L, flight_days=180, events=[
        Event("co2", -1, L + 38, 1.0), Event("dehydration", 3, L + 52, 1.0), Event("sleep_loss", 0, L + 64, 1.0),
        Event("decond", 1, L + 78, 1.0), Event("illness", 2, L + ill_fd["mars_transit"], ILL), Event("low_mood", 3, L + 150, 1.0),
        Event("spe", -1, L + 163, 1.0),
    ])
    write_json(APP_PUBLIC / "data" / "missions" / "mars_transit.json", build(mars, 2039, {
        "environment": "Deep-space transit vehicle", "link": {"profile": "mars_transit"},
        "default_day": L + 122, "default_crew": "c2", "kind": "simulated",
        "blurb": "Four crew, 30 days of pre-flight baseline, then a 180-day outbound transit to Mars."}))
    moon = Scenario(name="lunar_surface", title="Lunar surface stay", pre_days=L, flight_days=40, landing_day=5,
                    rad_key="rad_lunar_surface", events=[Event("sleep_loss", 2, L + 14, 1.0), Event("dehydration", 0, L + 24, 1.5),
                                                         Event("illness", 3, L + ill_fd["lunar_surface"], ILL)])
    write_json(APP_PUBLIC / "data" / "missions" / "lunar_surface.json", build(moon, 2031, {
        "environment": "Lunar surface habitat and rover", "link": {"profile": "lunar"},
        "default_day": L + 31, "default_crew": "c3", "kind": "simulated",
        "blurb": "Four crew, a five-day transit, then a 35-day stay at a south-polar surface base in one-sixth gravity."}))
    # optional list of extra data sets; shipped empty so the app never requests a missing file
    write_json(APP_PUBLIC / "data" / "missions" / "index.json", [])
    print("missions written")


if __name__ == "__main__":
    main()
