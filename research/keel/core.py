"""Keel detection core (Python reference implementation).

The same maths is implemented in TypeScript in app/src/core/detect.ts and the two are held
together by a parity test (research/scripts/make_parity.py -> shared/parity.json ->
app/src/core/detect.parity.test.ts).  Equations are documented in docs/METHOD.md.

Everything here works on daily features.  x has shape (T, d): T days, d indicators, NaN = missing.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import math
import numpy as np

MAD_K = 1.4826  # makes the MAD a consistent estimator of the SD under normality


@dataclass
class Params:
    """Tunable constants.  Defaults are the values used everywhere unless a script says otherwise."""

    window: int = 28        # W: trailing baseline window, days
    gap: int = 3            # g: most recent days excluded from the baseline window
    min_n: int = 7          # minimum valid days before a baseline exists
    n_full: int = 14        # post-phase-change days needed before the prior is fully forgotten
    z_clip: float = 4.0     # winsorise z so one sensor glitch cannot fire an alert alone
    kofn_k: int = 2         # persistence rule: k of the last n days
    kofn_n: int = 3
    cusum_k: float = 0.75   # CUSUM allowance (in robust SD units)
    cusum_reset_gap: int = 5  # consecutive missing days after which a CUSUM resets
    cusum_calm: int = 3     # consecutive in-control days (deviation below k) after which a CUSUM resets
    realert_days: int = 7   # an alert still open after this many days counts (and notifies) again
    ewma_lambda: float = 0.3  # MEWMA smoothing
    merge_gap: int = 3      # alert runs separated by fewer quiet days are one episode


@dataclass
class Phase:
    """A mission phase change (for example launch into microgravity) starting on day `start`."""

    start: int
    shift: np.ndarray            # (d,) expected step change in transformed units
    tau: np.ndarray              # (d,) adaptation time constant, days
    kappa: float = 2.0           # scale inflation right after the change


@dataclass
class Model:
    """Everything fitted on training people only."""

    indicators: list[str]
    transform: list[str]                 # 'none' | 'log'
    concern: np.ndarray                  # (d,) +1 high is bad, -1 low is bad, 0 both
    floor: np.ndarray                    # (d,) minimum robust scale, transformed units
    pop_mean: np.ndarray = field(default_factory=lambda: np.zeros(0))   # for the fixed-threshold baseline
    pop_sd: np.ndarray = field(default_factory=lambda: np.zeros(0))
    corr: np.ndarray = field(default_factory=lambda: np.zeros((0, 0)))  # shrunk correlation of z
    h_cusum: float = 4.0                 # reference thresholds used inside the fusion score
    h_mewma: float = 12.0
    # covariate adjustment: (target index, covariate index, lag days, beta in transformed units per covariate unit)
    adjust: list[tuple[int, int, int, float]] = field(default_factory=list)


def transform(x: np.ndarray, kinds: list[str]) -> np.ndarray:
    out = np.array(x, dtype=float, copy=True)
    for j, k in enumerate(kinds):
        if k == "log":
            col = out[:, j]
            with np.errstate(invalid="ignore", divide="ignore"):
                out[:, j] = np.where(col > 0, np.log(col), np.nan)
    return out


def _med_scale(v: np.ndarray, floor: float) -> tuple[float, float]:
    med = float(np.median(v))
    mad = float(np.median(np.abs(v - med)))
    return med, max(floor, MAD_K * mad)


def personal_baseline(
    x: np.ndarray, floor: float, p: Params, phase_starts: list[int] | None = None,
    shift: list[float] | None = None, tau: list[float] | None = None, kappa: list[float] | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Rolling robust baseline for one indicator of one person.

    Returns (m, s): the expected value and robust scale for each day, built only from days
    strictly before t - gap.  NaN where no baseline exists yet.

    With phase changes, the window never reaches back across the change.  Until enough
    post-change days exist, the estimate is a blend of (a) the pre-change baseline moved along
    the published adaptation curve and (b) the person's own post-change data.
    """
    T = len(x)
    m = np.full(T, np.nan)
    s = np.full(T, np.nan)
    starts = [0] + list(phase_starts or [])
    snap: list[tuple[float, float] | None] = [None]
    for k in range(1, len(starts)):
        t0 = starts[k]
        lo = max(starts[k - 1], t0 - p.window)
        v = x[lo:t0]
        v = v[~np.isnan(v)]
        snap.append(_med_scale(v, floor) if len(v) >= p.min_n else None)
    k = 0
    for t in range(T):
        while k + 1 < len(starts) and t >= starts[k + 1]:
            k += 1
        t0 = starts[k]
        lo = max(t0, t - p.gap - p.window)
        hi = max(lo, t - p.gap)
        v = x[lo:hi]
        v = v[~np.isnan(v)]
        n = len(v)
        prior = snap[k]
        if prior is not None:
            dt = t - t0
            decay = math.exp(-dt / tau[k - 1])
            pm = prior[0] + shift[k - 1] * (1.0 - decay)
            ps = prior[1] * (1.0 + (kappa[k - 1] - 1.0) * decay)
            if n >= 3:
                w = min(1.0, n / p.n_full)
                mm, ss = _med_scale(v, floor)
                m[t] = (1 - w) * pm + w * mm
                s[t] = max(floor, (1 - w) * ps + w * ss)
            else:
                m[t], s[t] = pm, max(floor, ps)
        elif n >= p.min_n:
            m[t], s[t] = _med_scale(v, floor)
    return m, s


def zscores(
    x: np.ndarray, model: Model, p: Params, phases: list[Phase] | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Robust personal z for every day and indicator.  x is raw (T, d).  Returns (z, m, s)."""
    xt = adjusted(x, model, p)
    T, d = xt.shape
    z = np.full((T, d), np.nan)
    m = np.full((T, d), np.nan)
    s = np.full((T, d), np.nan)
    ph = phases or []
    for j in range(d):
        mj, sj = personal_baseline(
            xt[:, j], float(model.floor[j]), p,
            [q.start for q in ph], [float(q.shift[j]) for q in ph],
            [float(q.tau[j]) for q in ph], [q.kappa for q in ph],
        )
        m[:, j], s[:, j] = mj, sj
        z[:, j] = (xt[:, j] - mj) / sj
    return np.clip(z, -p.z_clip, p.z_clip), m, s


def adjusted(x: np.ndarray, model: Model, p: Params) -> np.ndarray:
    """Transform, then remove the part of each target explained by a lagged covariate:
    x_adj[t] = x[t] - beta * (c[t-lag] - trailing median of c).  If the covariate is missing the
    value is left unadjusted."""
    xt = transform(x, model.transform)
    if not model.adjust:
        return xt
    out = xt.copy()
    T = xt.shape[0]
    for tj, cj, lag, beta in model.adjust:
        c = xt[:, cj]
        for t in range(T):
            if t - lag < 0 or np.isnan(c[t - lag]) or np.isnan(xt[t, tj]):
                continue
            w = c[max(0, t - lag - p.window):t - lag]
            w = w[~np.isnan(w)]
            if len(w) < p.min_n:
                continue
            out[t, tj] = xt[t, tj] - beta * (c[t - lag] - float(np.median(w)))
    return out


def concern_dev(z: np.ndarray, concern: np.ndarray) -> np.ndarray:
    """u: deviation in the direction that matters (|z| when both directions matter)."""
    return np.where(concern == 0, np.abs(z), z * np.where(concern == 0, 1, concern))


def _kofn(u: np.ndarray, k: int, n: int) -> np.ndarray:
    """Score for 'k of the last n days above threshold': the k-th largest of the last n values,
    maximised over indicators.  NaN days count as not exceeding."""
    T, d = u.shape
    out = np.full(T, np.nan)
    filled = np.where(np.isnan(u), -np.inf, u)
    for t in range(T):
        lo = max(0, t - n + 1)
        w = filled[lo:t + 1]
        if w.shape[0] < k:
            continue
        kth = np.sort(w, axis=0)[-k]
        best = np.max(kth)
        if np.isfinite(best):
            out[t] = best
    return out


def score_fixed(x: np.ndarray, model: Model, p: Params) -> np.ndarray:
    """Simple baseline: the same population threshold for everyone, with the same persistence
    rule as the personal detector so the only difference is whose baseline is used."""
    xt = transform(x, model.transform)
    v = (xt - model.pop_mean) / model.pop_sd
    return _kofn(concern_dev(v, model.concern), p.kofn_k, p.kofn_n)


def score_z(z: np.ndarray, model: Model, p: Params) -> np.ndarray:
    return _kofn(concern_dev(z, model.concern), p.kofn_k, p.kofn_n)


def cusum_paths(z: np.ndarray, model: Model, p: Params) -> np.ndarray:
    """One-sided CUSUM per indicator (two one-sided sums when both directions matter; the
    larger is returned).  Missing days hold the sum; a long gap resets it; so do cusum_calm
    consecutive in-control days, so an alert closes soon after the readings return to normal."""
    T, d = z.shape
    S = np.zeros((T, d))
    up = np.zeros(d)
    dn = np.zeros(d)
    miss = np.zeros(d, dtype=int)
    calm = np.zeros(d, dtype=int)
    for t in range(T):
        for j in range(d):
            v = z[t, j]
            if np.isnan(v):
                miss[j] += 1
                if miss[j] >= p.cusum_reset_gap:
                    up[j] = dn[j] = 0.0
            else:
                miss[j] = 0
                c = model.concern[j]
                u = abs(v) if c == 0 else v * c
                calm[j] = calm[j] + 1 if u < p.cusum_k else 0
                if c >= 0:
                    up[j] = max(0.0, up[j] + v - p.cusum_k)
                if c <= 0:
                    dn[j] = max(0.0, dn[j] - v - p.cusum_k)
                if calm[j] >= p.cusum_calm:
                    up[j] = dn[j] = 0.0
            S[t, j] = max(up[j], dn[j])
    return S


def score_cusum(z: np.ndarray, model: Model, p: Params) -> np.ndarray:
    S = cusum_paths(z, model, p)
    return _mask_unobserved(S.max(axis=1), z)


def _mask_unobserved(score: np.ndarray, z: np.ndarray) -> np.ndarray:
    """A day with no usable indicator has no score (it is not an observed quiet day)."""
    out = score.copy()
    out[np.all(np.isnan(z), axis=1)] = np.nan
    return out


def score_mewma(z: np.ndarray, model: Model, p: Params) -> np.ndarray:
    """One-sided multivariate EWMA.  y_t = lam*z_t + (1-lam)*y_{t-1} (missing z counts as 0);
    y is clipped to the direction of concern; T2 = y' Sigma^-1 y with Sigma = lam/(2-lam) * R,
    using only indicators this person has ever reported."""
    T, d = z.shape
    lam = p.ewma_lambda
    y = np.zeros(d)
    out = np.full(T, np.nan)
    have = np.zeros(d, dtype=bool)
    inv_cache: dict[bytes, np.ndarray] = {}
    scale = lam / (2.0 - lam)
    for t in range(T):
        zt = z[t]
        ok = ~np.isnan(zt)
        have |= ok
        y = (1 - lam) * y + lam * np.where(ok, zt, 0.0)
        if not have.any():
            continue
        yc = np.where(model.concern == 0, y, np.maximum(y * np.where(model.concern == 0, 1, model.concern), 0.0))
        key = have.tobytes()
        if key not in inv_cache:
            idx = np.where(have)[0]
            inv_cache[key] = np.linalg.inv(model.corr[np.ix_(idx, idx)] * scale)
        idx = np.where(have)[0]
        v = yc[idx]
        out[t] = float(v @ inv_cache[key] @ v)
    return _mask_unobserved(out, z)


def score_fusion(c: np.ndarray, m: np.ndarray, model: Model) -> np.ndarray:
    """Keel's deployed score: whichever of CUSUM or MEWMA is closer to its own reference
    threshold.  1.0 means 'one of them is at its threshold'."""
    a = c / model.h_cusum
    b = m / model.h_mewma
    return np.where(np.isnan(a), b, np.where(np.isnan(b), a, np.maximum(a, b)))


def all_scores(x: np.ndarray, model: Model, p: Params, phases: list[Phase] | None = None) -> dict[str, np.ndarray]:
    z, m, s = zscores(x, model, p, phases)
    c = score_cusum(z, model, p)
    mw = score_mewma(z, model, p)
    return {
        "fixed": score_fixed(x, model, p),
        "zscore": score_z(z, model, p),
        "cusum": c,
        "mewma": mw,
        "fusion": score_fusion(c, mw, model),
        "_z": z, "_m": m, "_s": s,
    }


def episodes(score: np.ndarray, thr: float, merge_gap: int) -> list[tuple[int, int]]:
    """Alert episodes: maximal runs with score >= thr, merging runs separated by fewer than
    merge_gap quiet days.  Returns [(start, end_inclusive)]."""
    above = np.where(np.nan_to_num(score, nan=-np.inf) >= thr)[0]
    runs: list[tuple[int, int]] = []
    for t in above:
        t = int(t)
        if runs and t - runs[-1][1] <= merge_gap:
            runs[-1] = (runs[-1][0], t)
        else:
            runs.append((t, t))
    return runs
