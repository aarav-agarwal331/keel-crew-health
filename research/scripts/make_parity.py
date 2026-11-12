"""Write shared/parity.json: inputs and Python outputs that the TypeScript detector must reproduce."""
import common  # noqa: F401
import json

import numpy as np

from keel.core import Model, Params, all_scores
from keel.export import APP_PUBLIC, ROOT, clean
from keel.mission import detect_spec, people_from
from keel.simulator import Event, Scenario, apply_missing, simulate


def main():
    mj = json.loads((APP_PUBLIC / "data" / "model_mission.json").read_text())
    model = Model(indicators=mj["indicators"], transform=mj["transform"], concern=np.array(mj["concern"], float),
                  floor=np.array(mj["floor"], float), pop_mean=np.array(mj["pop_mean"]), pop_sd=np.array(mj["pop_sd"]),
                  corr=np.array(mj["corr"]), h_cusum=mj["h_cusum"], h_mewma=mj["h_mewma"])
    # exercise the covariate-adjustment path too, with an arbitrary slope
    ids = model.indicators
    model.adjust = [(ids.index("rhr"), ids.index("ex7"), 1, 0.02)]
    p = Params(**mj["params"])
    sc = Scenario(pre_days=30, flight_days=90, landing_day=40, events=[Event("illness", 0, 80, 1.5), Event("co2", -1, 100, 1.0)])
    m = simulate(sc, 4242)
    people = people_from(m, apply_missing(m, 7, p_wear=0.1, p_checkin=0.2))
    cases = []
    for q in people[:2]:
        sc_ = all_scores(q.x, model, p, q.phases)
        cases.append({
            "x": q.x, "phases": [{"start": ph.start, "name": "p", "label": "p", "indicators": ids, "shift": ph.shift, "tau": ph.tau, "kappa": ph.kappa} for ph in q.phases],
            "z": sc_["_z"], "m": sc_["_m"], "s": sc_["_s"],
            "scores": {k: sc_[k] for k in ["fixed", "zscore", "cusum", "mewma", "fusion"]},
        })
    model_json = dict(mj)
    model_json["adjust"] = [{"target": "rhr", "cov": "ex7", "lag": 1, "beta": 0.02}]
    (ROOT / "shared" / "parity.json").write_text(json.dumps(clean({"model": model_json, "cases": cases})))
    print("parity vectors:", len(cases), "people,", people[0].x.shape)


if __name__ == "__main__":
    main()
