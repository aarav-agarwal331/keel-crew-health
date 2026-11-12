"""Evaluation utilities shared by the real-data and simulated-mission experiments.

Protocol (docs/METHOD.md section 6):
  * people are split into folds; everything fitted (population statistics, correlation matrix,
    covariate slopes, alert thresholds) uses training people only;
  * thresholds are set so training people's quiet periods produce at most B false alerts per
    person-month (the false-alarm budget);
  * held-out people are scored with those thresholds; intervals are bootstrap over people.
"""
from __future__ import annotations

import os
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field, replace

import numpy as np

from .core import (Model, Params, Phase, all_scores, concern_dev, episodes, transform, zscores,
                   score_cusum, score_mewma)

DAYS_PER_MONTH = 30.44
METHODS = ["fixed", "zscore", "cusum", "mewma", "fusion"]
METHOD_LABELS = {
    "fixed": "Fixed threshold (same for everyone)",
    "zscore": "Personal baseline z-score",
    "cusum": "Personal baseline + CUSUM",
    "mewma": "Personal baseline + multivariate EWMA",
    "fusion": "Keel (CUSUM + multivariate, fused)",
}


@dataclass
class Person:
    pid: str
    x: np.ndarray                         # (T, d) raw daily features
    onsets: list[int] = field(default_factory=list)   # event onset day indices
    phases: list[Phase] | None = None
    meta: dict = field(default_factory=dict)
    events_meta: list[dict] = field(default_factory=list)


@dataclass
class Windows:
    det_pre: int = 10     # an alert starting up to this many days before onset counts as detection
    det_post: int = 4     # ... or up to this many days after
    excl_pre: int = 21    # days around an event that are neither quiet nor counted as false alarms
    excl_post: int = 28


def quiet_mask(T: int, onsets: list[int], w: Windows) -> np.ndarray:
    q = np.ones(T, dtype=bool)
    for o in onsets:
        q[max(0, o - w.excl_pre):min(T, o + w.excl_post + 1)] = False
    return q


REALERT = 7   # an alert still open after a week counts as another alert (Params.realert_days)


def person_outcome(score: np.ndarray, thr: float, onsets: list[int], w: Windows, merge_gap: int) -> dict:
    T = len(score)
    q = quiet_mask(T, onsets, w)
    eps = episodes(score, thr, merge_gap)
    starts = [a for a, _ in eps]
    # false alerts: every alert that starts on a quiet day, plus one more for each further week
    # it stays open on quiet days (so one very long alert cannot hide inside the budget)
    fa = 0
    alert_days = 0
    for a, b in eps:
        qd = int(np.sum(q[a:b + 1]))
        alert_days += qd
        if q[a]:
            fa += max(1, -(-qd // REALERT))
        elif qd > REALERT:
            fa += (qd - 1) // REALERT
    leads: list[float | None] = []
    for o in onsets:
        hit = [a for a in starts if o - w.det_pre <= a <= o + w.det_post]
        leads.append(float(o - min(hit)) if hit else None)
    # an event is scorable only if there was a score on at least one day in its detection window
    scor = [bool(np.any(~np.isnan(score[max(0, o - w.det_pre):min(T, o + w.det_post + 1)]))) for o in onsets]
    return {"fa": fa, "quiet_days": int(np.sum(q & ~np.isnan(score))), "leads": leads, "scorable": scor,
            "alert_days": alert_days}


def fa_rate(scores: list[np.ndarray], onsets: list[list[int]], thr: float, w: Windows, merge_gap: int) -> float:
    fa = days = 0
    for s, o in zip(scores, onsets):
        r = person_outcome(s, thr, o, w, merge_gap)
        fa += r["fa"]
        days += r["quiet_days"]
    return fa / max(1e-9, days / DAYS_PER_MONTH)


def calibrate(scores: list[np.ndarray], onsets: list[list[int]], budget: float, w: Windows, merge_gap: int,
              n_grid: int = 300) -> float:
    """Smallest threshold whose false-alert rate on these people's quiet days is within budget."""
    pool = np.concatenate([s[quiet_mask(len(s), o, w) & ~np.isnan(s)] for s, o in zip(scores, onsets)])
    if len(pool) == 0:
        return float("inf")
    grid = np.unique(np.quantile(pool, np.linspace(0.5, 1.0, n_grid)))
    best = float(grid[-1]) * 1.0001 + 1e-9
    for thr in grid[::-1]:
        if fa_rate(scores, onsets, float(thr), w, merge_gap) <= budget:
            best = float(thr)
        else:
            break
    return best


def fit_model(train: list[Person], spec: dict, p: Params, w: Windows, shrink: float = 0.2,
              adjust_spec: list[tuple[str, str, int]] | None = None) -> Model:
    """Fit everything that is learned from data, on training people only."""
    ids = spec["indicators"]
    d = len(ids)
    model = Model(indicators=ids, transform=spec["transform"], concern=np.array(spec["concern"], float),
                  floor=np.array(spec["floor"], float))
    # population statistics for the fixed-threshold comparator (quiet days only)
    xs = [transform(q.x, model.transform)[quiet_mask(len(q.x), q.onsets, w)] for q in train]
    allx = np.concatenate(xs)
    model.pop_mean = np.nanmean(allx, axis=0)
    model.pop_sd = np.maximum(np.nanstd(allx, axis=0), 1e-6)
    # covariate slopes: pooled within-person regression of the baseline residual on the lagged covariate
    if adjust_spec:
        model.adjust = []
        base = _pmap(_z_one, [(q.x, q.phases, model, p) for q in train])
        for tname, cname, lag in adjust_spec:
            tj, cj = ids.index(tname), ids.index(cname)
            num = den = 0.0
            for q, (z, m, s) in zip(train, base):
                xt = transform(q.x, model.transform)
                qm = quiet_mask(len(q.x), q.onsets, w)
                resid = xt[:, tj] - m[:, tj]
                c = xt[:, cj]
                cl = np.concatenate([np.full(lag, np.nan), c[:-lag]]) if lag else c
                ok = qm & ~np.isnan(resid) & ~np.isnan(cl)
                if ok.sum() < 20:
                    continue
                cc = cl[ok] - np.median(cl[ok])
                rr = np.clip(resid[ok], -4 * s[ok, tj], 4 * s[ok, tj])
                num += float(cc @ rr)
                den += float(cc @ cc)
            model.adjust.append((tj, cj, lag, num / den if den > 0 else 0.0))
    # correlation of personal z on quiet days, shrunk towards the identity
    zall = [r[0] for r in _pmap(_z_one, [(q.x, q.phases, model, p) for q in train])]
    Z = np.concatenate([z[quiet_mask(len(q.x), q.onsets, w)] for z, q in zip(zall, train)])
    R = np.eye(d)
    for a in range(d):
        for b in range(a + 1, d):
            ok = ~np.isnan(Z[:, a]) & ~np.isnan(Z[:, b])
            if ok.sum() > 30:
                r = float(np.corrcoef(Z[ok, a], Z[ok, b])[0, 1])
                R[a, b] = R[b, a] = 0.0 if np.isnan(r) else r
    model.corr = (1 - shrink) * R + shrink * np.eye(d)
    # reference thresholds for the fusion score: each component alone at 1 false alert / person-month
    on = [q.onsets for q in train]
    cs = [score_cusum(z, model, p) for z in zall]
    ms = [score_mewma(z, model, p) for z in zall]
    model.h_cusum = calibrate(cs, on, 1.0, w, p.merge_gap)
    model.h_mewma = calibrate(ms, on, 1.0, w, p.merge_gap)
    return model


def _score_one(args):
    x, phases, model, p = args
    return all_scores(x, model, p, phases)


def _z_one(args):
    x, phases, model, p = args
    return zscores(x, model, p, phases)


_POOL: ProcessPoolExecutor | None = None


def _pmap(fn, items: list):
    """Map over people in worker processes (KEEL_WORKERS=1 turns this off).  Results are
    identical to the serial path; only the wall-clock time changes."""
    global _POOL
    n = int(os.environ.get("KEEL_WORKERS", max(1, (os.cpu_count() or 2) - 1)))
    if n <= 1 or len(items) < 24:
        return [fn(a) for a in items]
    if _POOL is None:
        _POOL = ProcessPoolExecutor(max_workers=n)
    return list(_POOL.map(fn, items, chunksize=max(1, len(items) // (n * 4))))


def score_people(people: list[Person], model: Model, p: Params) -> list[dict[str, np.ndarray]]:
    return _pmap(_score_one, [(q.x, q.phases, model, p) for q in people])


def folds(n: int, k: int, seed: int) -> list[np.ndarray]:
    rng = np.random.default_rng(seed)
    idx = rng.permutation(n)
    return [np.sort(idx[i::k]) for i in range(k)]


def cv_run(people: list[Person], spec: dict, p: Params, w: Windows, budgets: list[float], k: int = 5,
           seed: int = 0, methods: list[str] | None = None, adjust_spec=None, strat: list[int] | None = None) -> dict:
    """K-fold over people.  Returns out[method][budget] = list of per-person outcome dicts
    (each person appears exactly once, scored by a model that never saw them)."""
    methods = methods or METHODS
    n = len(people)
    if strat is not None:  # keep people with events spread evenly over folds
        rng = np.random.default_rng(seed)
        fl: list[list[int]] = [[] for _ in range(k)]
        for g in sorted(set(strat)):
            ids = [i for i in range(n) if strat[i] == g]
            rng.shuffle(ids)
            off = int(rng.integers(0, k))
            for j, i in enumerate(ids):
                fl[(j + off) % k].append(i)
        fl_arr = [np.array(sorted(f)) for f in fl]
    else:
        fl_arr = folds(n, k, seed)
    out = {m: {b: [None] * n for b in budgets} for m in methods}
    thr_log = {m: {b: [] for b in budgets} for m in methods}
    scores: dict[str, list] = {m: [None] * n for m in methods}
    thr_person: dict[str, dict[float, list]] = {m: {b: [None] * n for b in budgets} for m in methods}
    models = []
    for f in fl_arr:
        test = set(int(i) for i in f)
        train = [people[i] for i in range(n) if i not in test]
        model = fit_model(train, spec, p, w, adjust_spec=adjust_spec)
        models.append(model)
        tr_scores = score_people(train, model, p)
        te_list = sorted(test)
        te_scores = dict(zip(te_list, score_people([people[i] for i in te_list], model, p)))
        tr_on = [q.onsets for q in train]
        for m in methods:
            for b in budgets:
                thr = calibrate([s[m] for s in tr_scores], tr_on, b, w, p.merge_gap)
                thr_log[m][b].append(thr)
                for i in test:
                    r = person_outcome(te_scores[i][m], thr, people[i].onsets, w, p.merge_gap)
                    r["pid"] = people[i].pid
                    out[m][b][i] = r
                    scores[m][i] = te_scores[i][m]
                    thr_person[m][b][i] = thr
    return {"outcomes": out, "thresholds": thr_log, "models": models, "folds": [f.tolist() for f in fl_arr],
            "scores": scores, "thr_person": thr_person}


def chance_rows(people: list[Person], scores: list[np.ndarray], thrs: list[float], w: Windows, merge_gap: int,
                per_person: int = 5, seed: int = 0) -> list[dict]:
    """How often would an alert fall inside a detection window by luck?  Place pseudo-events on
    random quiet days (whole window inside quiet, scored time) and score them exactly like
    real events.  Returns one row per person in the same shape as person_outcome."""
    rng = np.random.default_rng(seed)
    rows = []
    for q, s, thr in zip(people, scores, thrs):
        T = len(s)
        quiet = quiet_mask(T, q.onsets, w) & ~np.isnan(s)
        ok = [t for t in range(w.det_pre, T - w.det_post) if quiet[t - w.det_pre:t + w.det_post + 1].all()]
        if not ok:
            continue
        picks = rng.choice(ok, size=min(per_person, len(ok)), replace=False)
        starts = [a for a, _ in episodes(s, thr, merge_gap)]
        leads = []
        for o in picks:
            hit = [a for a in starts if o - w.det_pre <= a <= o + w.det_post]
            leads.append(float(o - min(hit)) if hit else None)
        rows.append({"fa": 0, "quiet_days": 0, "leads": leads, "scorable": [True] * len(leads), "alert_days": 0, "pid": q.pid})
    return rows


def aggregate(rows: list[dict]) -> dict:
    ev = [(l, s) for r in rows for l, s in zip(r["leads"], r["scorable"]) if s]
    n_ev = len(ev)
    det = [l for l, _ in ev if l is not None]
    fa = sum(r["fa"] for r in rows)
    months = sum(r["quiet_days"] for r in rows) / DAYS_PER_MONTH
    return {
        "n_people": len(rows), "n_events": n_ev, "n_detected": len(det),
        "detection_rate": len(det) / n_ev if n_ev else float("nan"),
        "early_rate": sum(1 for l in det if l >= 1) / n_ev if n_ev else float("nan"),
        "by_onset_rate": sum(1 for l in det if l >= 0) / n_ev if n_ev else float("nan"),
        "median_lead": float(np.median(det)) if det else float("nan"),
        "false_alerts": fa, "quiet_person_months": months,
        "fa_per_person_month": fa / months if months > 0 else float("nan"),
        "quiet_days_in_alert_frac": sum(r.get("alert_days", 0) for r in rows) / max(1, sum(r["quiet_days"] for r in rows)),
    }


def bootstrap(rows: list[dict], n_boot: int = 2000, seed: int = 0) -> dict:
    """Cluster bootstrap over people: 95% percentile intervals for the headline metrics."""
    rng = np.random.default_rng(seed)
    n = len(rows)
    keys = ["detection_rate", "early_rate", "by_onset_rate", "median_lead", "fa_per_person_month"]
    acc = {k: [] for k in keys}
    for _ in range(n_boot):
        a = aggregate([rows[i] for i in rng.integers(0, n, n)])
        for k in keys:
            acc[k].append(a[k])
    point = aggregate(rows)
    for k in keys:
        v = np.array(acc[k], float)
        v = v[~np.isnan(v)]
        point[k + "_ci"] = [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))] if len(v) else [float("nan")] * 2
    return point


def paired_diff(rows_a: list[dict], rows_b: list[dict], n_boot: int = 2000, seed: int = 0) -> dict:
    """Bootstrap interval for (A - B) in detection rate and false alerts per person-month,
    resampling the same people for both methods."""
    rng = np.random.default_rng(seed)
    n = len(rows_a)
    dd, df = [], []
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        a = aggregate([rows_a[i] for i in idx])
        b = aggregate([rows_b[i] for i in idx])
        dd.append(a["detection_rate"] - b["detection_rate"])
        df.append(a["fa_per_person_month"] - b["fa_per_person_month"])
    dd, df = np.array(dd), np.array(df)
    dd, df = dd[~np.isnan(dd)], df[~np.isnan(df)]
    return {"detection_rate_diff": float(np.mean(dd)), "detection_rate_diff_ci": [float(np.percentile(dd, 2.5)), float(np.percentile(dd, 97.5))],
            "fa_diff": float(np.mean(df)), "fa_diff_ci": [float(np.percentile(df, 2.5)), float(np.percentile(df, 97.5))]}
