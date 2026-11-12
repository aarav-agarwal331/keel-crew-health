"""Unit tests for baselines and detectors (docs/METHOD.md sections 4-5)."""
import numpy as np
import pytest

from keel.core import (Model, Params, Phase, all_scores, cusum_paths, episodes, personal_baseline, score_mewma, zscores)


def model(d=2, concern=(1, -1)):
    return Model(indicators=[f"i{k}" for k in range(d)], transform=["none"] * d, concern=np.array(concern, float),
                 floor=np.full(d, 0.5), pop_mean=np.zeros(d), pop_sd=np.ones(d), corr=np.eye(d), h_cusum=5.0, h_mewma=20.0)


def test_baseline_is_strictly_causal():
    """Changing today's or any future value must not change today's baseline."""
    rng = np.random.default_rng(0)
    x = rng.normal(60, 2, 120)
    p = Params()
    m1, s1 = personal_baseline(x, 0.5, p)
    y = x.copy()
    y[80:] += 50
    m2, s2 = personal_baseline(y, 0.5, p)
    # the window ends gap days before t, so days up to 80 + gap are untouched
    assert np.allclose(m1[:80 + p.gap + 1], m2[:80 + p.gap + 1], equal_nan=True)
    assert np.allclose(s1[:80 + p.gap + 1], s2[:80 + p.gap + 1], equal_nan=True)


def test_baseline_needs_minimum_history_and_handles_missing():
    p = Params()
    x = np.full(60, np.nan)
    x[::2] = 50.0
    m, s = personal_baseline(x, 1.0, p)
    assert np.isnan(m[: p.gap + p.min_n]).all()
    assert m[59] == 50.0 and s[59] == 1.0  # MAD of a constant is 0, so the floor applies


def test_baseline_robust_to_outliers():
    rng = np.random.default_rng(1)
    x = rng.normal(60, 2, 60)
    x[[40, 45, 50]] = 200  # sensor glitches
    m, s = personal_baseline(x, 0.5, Params())
    assert abs(m[59] - 60) < 1.5 and s[59] < 4


def test_phase_prior_absorbs_expected_shift():
    """A step change at a phase boundary that matches the expected shift should not look unusual;
    the same step without phase information should."""
    rng = np.random.default_rng(2)
    x = np.concatenate([rng.normal(7.0, 0.3, 40), rng.normal(6.1, 0.3, 40)])[:, None]
    mdl = Model(indicators=["sleep"], transform=["none"], concern=np.array([-1.0]), floor=np.array([0.2]),
                pop_mean=np.zeros(1), pop_sd=np.ones(1), corr=np.eye(1))
    p = Params()
    z_naive, _, _ = zscores(x, mdl, p)
    z_aware, _, _ = zscores(x, mdl, p, [Phase(40, np.array([-0.9]), np.array([1.0]), 2.5)])
    assert np.nanmean(z_naive[42:50, 0]) < -2.0
    assert abs(np.nanmean(z_aware[42:50, 0])) < 1.0


def test_cusum_accumulates_then_resets_after_calm_days():
    p = Params()
    z = np.zeros((30, 1))
    z[5:12, 0] = 2.0
    S = cusum_paths(z, model(1, (1,)), p)[:, 0]
    assert S[11] == pytest.approx(7 * (2.0 - p.cusum_k))
    assert S[11 + p.cusum_calm] == 0.0  # three in-control days clear it


def test_cusum_direction_of_concern():
    z = np.zeros((20, 2))
    z[5:15, 0] = -3.0   # indicator 0: only high is a concern -> ignored
    z[5:15, 1] = -3.0   # indicator 1: low is a concern -> accumulates
    S = cusum_paths(z, model(), Params())
    assert S[:, 0].max() == 0.0 and S[14, 1] > 10


def test_mewma_combines_weak_signals():
    """Two indicators each moving 1.5 SD score higher together than either alone."""
    p = Params()
    mdl = model()
    a = np.zeros((40, 2)); a[20:, 0] = 1.5
    b = np.zeros((40, 2)); b[20:, 0] = 1.5; b[20:, 1] = -1.5
    assert score_mewma(b, mdl, p)[39] > 1.8 * score_mewma(a, mdl, p)[39]


def test_single_glitch_cannot_fire_persistence_rule():
    rng = np.random.default_rng(3)
    x = rng.normal(60, 2, (80, 2))
    x[70, 0] = 140
    sc = all_scores(x, model(), Params())
    assert sc["zscore"][70] < 3.0          # one day is not two of three
    assert abs(sc["_z"][70, 0]) <= Params().z_clip


def test_episodes_merge_and_gap():
    s = np.array([0, 3, 3, 0, 0, 3, 0, 0, 0, 0, 3, np.nan, 3], float)
    assert episodes(s, 2.0, 3) == [(1, 5), (10, 12)]


def test_scores_nan_when_nothing_observed():
    x = np.full((40, 2), np.nan)
    sc = all_scores(x, model(), Params())
    for k in ["fixed", "zscore", "cusum", "mewma", "fusion"]:
        assert np.isnan(sc[k]).all()
