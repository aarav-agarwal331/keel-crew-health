"""Unit tests for the simulator."""
import numpy as np

from keel.simulator import IND, SYMPTOMS, Event, Scenario, apply_missing, load_params, simulate


def col(m, k):
    return m.x[:, :, IND.index(k)]


def test_deterministic_given_seed():
    a, b = simulate(Scenario(), 11), simulate(Scenario(), 11)
    assert np.array_equal(a.x, b.x, equal_nan=True) and np.array_equal(a.symptoms, b.symptoms)
    assert not np.array_equal(a.x, simulate(Scenario(), 12).x, equal_nan=True)


def test_plausible_ranges():
    m = simulate(Scenario(), 5)
    assert 25 < np.nanmin(col(m, "rhr")) and np.nanmax(col(m, "rhr")) < 125
    assert 85 <= np.nanmin(col(m, "spo2")) and np.nanmax(col(m, "spo2")) <= 100
    assert 2 <= np.nanmin(col(m, "sleep_h")) and np.nanmax(col(m, "sleep_h")) <= 11
    assert set(np.unique(col(m, "mood"))) <= {1.0, 2.0, 3.0, 4.0, 5.0}
    assert (m.env >= 0).all()


def test_flight_sleep_matches_published_mean():
    """In-flight sleep should sit near the published ISS mean of 6.09 h (Barger 2014)."""
    sl = np.concatenate([col(simulate(Scenario(), s), "sleep_h")[:, 60:].ravel() for s in range(20)])
    assert abs(np.nanmean(sl) - 6.09) < 0.25


def test_illness_raises_heart_rate_before_symptoms():
    P = load_params()
    sc = Scenario(events=[Event("illness", 1, 120, 1.0)])
    quiet = simulate(Scenario(), 21)
    ill = simulate(sc, 21)   # same seed: same noise, so the difference is the event itself
    d = col(ill, "rhr")[1] - col(quiet, "rhr")[1]
    assert abs(d[:110]).max() < 1e-9
    assert d[119] > 2.0                        # the day before symptom onset
    assert abs(d[120:125].max() - P["illness_rhr_peak"]) < 1.5


def test_co2_event_is_crew_wide_and_raises_headaches():
    sc = Scenario(events=[Event("co2", -1, 100, 1.5)])
    heads = np.zeros(2)
    for s in range(30):
        m = simulate(sc, 100 + s)
        h = m.symptoms[:, :, SYMPTOMS.index("headache")]
        heads += [h[:, 60:95].mean(), h[:, 104:112].mean()]
        assert m.env[104:110, 0].mean() > m.env[60:95, 0].mean() + 2.0
    assert heads[1] > 2 * heads[0]


def test_missingness_is_applied_in_blocks():
    m = simulate(Scenario(), 3)
    x = apply_missing(m, 1, p_wear=0.2, p_checkin=0.0, block_rate=0.0)
    r, h = x[:, :, IND.index("rhr")], x[:, :, IND.index("hrv")]
    assert np.array_equal(np.isnan(r), np.isnan(h))   # wearable channels drop together
    assert 0.1 < np.isnan(r).mean() < 0.3
    assert not np.isnan(x[:, :, IND.index("mood")]).any()
