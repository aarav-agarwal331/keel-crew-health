/**
 * Keel detection core (on-device implementation).
 *
 * Mirrors research/keel/core.py line for line; the two are held together by the parity test in
 * detect.parity.test.ts, which replays Python-generated vectors.  Equations: docs/METHOD.md.
 * Arrays are day-indexed; NaN means "not measured".
 */

export const MAD_K = 1.4826

export interface Params {
  window: number
  gap: number
  min_n: number
  n_full: number
  z_clip: number
  kofn_k: number
  kofn_n: number
  cusum_k: number
  cusum_reset_gap: number
  cusum_calm: number
  realert_days: number
  ewma_lambda: number
  merge_gap: number
}

export interface ModelJson {
  id: string
  indicators: string[]
  transform: string[]
  concern: number[]
  floor: number[]
  pop_mean: number[]
  pop_sd: number[]
  corr: number[][]
  h_cusum: number
  h_mewma: number
  adjust: { target: string; cov: string; lag: number; beta: number }[]
  params: Params
  thresholds: { notice: number; alert: number }
  budgets?: { notice: number; alert: number }
  calibrated_on?: string
  /** which score drives alerts; chosen on training missions by fit_mission_model.py */
  deployed?: 'zscore' | 'cusum' | 'mewma' | 'fusion'
  simulated_calibration?: boolean
}

export interface PhaseJson {
  start: number
  name: string
  label: string
  indicators: string[]
  shift: number[]
  tau: number[]
  kappa: number
}

export type Matrix = number[][] // [day][indicator]

const isNum = (v: number) => !Number.isNaN(v)

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

function medScale(v: number[], floor: number): [number, number] {
  const med = median(v)
  const mad = median(v.map((a) => Math.abs(a - med)))
  return [med, Math.max(floor, MAD_K * mad)]
}

export function transformCol(x: number[], kind: string): number[] {
  if (kind !== 'log') return x.slice()
  return x.map((v) => (v > 0 ? Math.log(v) : NaN))
}

export function inverseTransform(v: number, kind: string): number {
  return kind === 'log' ? Math.exp(v) : v
}

/** Rolling robust baseline for one indicator of one person.  See personal_baseline() in core.py. */
export function personalBaseline(
  x: number[], floor: number, p: Params,
  phaseStarts: number[] = [], shift: number[] = [], tau: number[] = [], kappa: number[] = [],
): { m: number[]; s: number[] } {
  const T = x.length
  const m = new Array<number>(T).fill(NaN)
  const s = new Array<number>(T).fill(NaN)
  const starts = [0, ...phaseStarts]
  const snap: ([number, number] | null)[] = [null]
  for (let k = 1; k < starts.length; k++) {
    const t0 = starts[k]
    const lo = Math.max(starts[k - 1], t0 - p.window)
    const v = x.slice(lo, t0).filter(isNum)
    snap.push(v.length >= p.min_n ? medScale(v, floor) : null)
  }
  let k = 0
  for (let t = 0; t < T; t++) {
    while (k + 1 < starts.length && t >= starts[k + 1]) k++
    const t0 = starts[k]
    const lo = Math.max(t0, t - p.gap - p.window)
    const hi = Math.max(lo, t - p.gap)
    const v = x.slice(lo, hi).filter(isNum)
    const n = v.length
    const prior = snap[k]
    if (prior) {
      const dt = t - t0
      const decay = Math.exp(-dt / tau[k - 1])
      const pm = prior[0] + shift[k - 1] * (1 - decay)
      const ps = prior[1] * (1 + (kappa[k - 1] - 1) * decay)
      if (n >= 3) {
        const w = Math.min(1, n / p.n_full)
        const [mm, ss] = medScale(v, floor)
        m[t] = (1 - w) * pm + w * mm
        s[t] = Math.max(floor, (1 - w) * ps + w * ss)
      } else {
        m[t] = pm
        s[t] = Math.max(floor, ps)
      }
    } else if (n >= p.min_n) {
      const [mm, ss] = medScale(v, floor)
      m[t] = mm
      s[t] = ss
    }
  }
  return { m, s }
}

export interface Scored {
  /** transformed, covariate-adjusted values [day][ind] */
  xt: Matrix
  z: Matrix
  m: Matrix
  s: Matrix
  cusum: Matrix
  scores: { fixed: number[]; zscore: number[]; cusum: number[]; mewma: number[]; fusion: number[] }
}

function columns(x: Matrix, d: number): number[][] {
  const cols: number[][] = Array.from({ length: d }, () => new Array<number>(x.length))
  for (let t = 0; t < x.length; t++) for (let j = 0; j < d; j++) cols[j][t] = x[t][j]
  return cols
}

function rows(cols: number[][], T: number): Matrix {
  return Array.from({ length: T }, (_, t) => cols.map((c) => c[t]))
}

function adjustedCols(x: Matrix, model: ModelJson, p: Params): number[][] {
  const d = model.indicators.length
  const raw = columns(x, d).map((c, j) => transformCol(c, model.transform[j]))
  if (!model.adjust?.length) return raw
  const out = raw.map((c) => c.slice())
  const T = x.length
  for (const a of model.adjust) {
    const tj = model.indicators.indexOf(a.target)
    const cj = model.indicators.indexOf(a.cov)
    if (tj < 0 || cj < 0) continue
    const c = raw[cj]
    for (let t = 0; t < T; t++) {
      if (t - a.lag < 0 || Number.isNaN(c[t - a.lag]) || Number.isNaN(raw[tj][t])) continue
      const w = c.slice(Math.max(0, t - a.lag - p.window), t - a.lag).filter(isNum)
      if (w.length < p.min_n) continue
      out[tj][t] = raw[tj][t] - a.beta * (c[t - a.lag] - median(w))
    }
  }
  return out
}

const clip = (v: number, lo: number, hi: number) => (Number.isNaN(v) ? NaN : Math.min(hi, Math.max(lo, v)))

/** deviation in the direction that matters */
export function concernDev(z: number, concern: number): number {
  return concern === 0 ? Math.abs(z) : z * concern
}

function kofn(u: Matrix, k: number, n: number): number[] {
  const T = u.length
  const d = T ? u[0].length : 0
  const out = new Array<number>(T).fill(NaN)
  for (let t = 0; t < T; t++) {
    const lo = Math.max(0, t - n + 1)
    if (t - lo + 1 < k) continue
    let best = -Infinity
    for (let j = 0; j < d; j++) {
      const w: number[] = []
      for (let q = lo; q <= t; q++) w.push(Number.isNaN(u[q][j]) ? -Infinity : u[q][j])
      w.sort((a, b) => a - b)
      best = Math.max(best, w[w.length - k])
    }
    if (Number.isFinite(best)) out[t] = best
  }
  return out
}

export function invert(a: number[][]): number[][] {
  const n = a.length
  const m = a.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r
    ;[m[c], m[piv]] = [m[piv], m[c]]
    const dv = m[c][c]
    for (let j = 0; j < 2 * n; j++) m[c][j] /= dv
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = m[r][c]
      if (f === 0) continue
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[c][j]
    }
  }
  return m.map((r) => r.slice(n))
}

/** Score one person.  x is raw [day][indicator] in model.indicators order. */
export function scorePerson(x: Matrix, model: ModelJson, phases: PhaseJson[] = []): Scored {
  const p = model.params
  const T = x.length
  const d = model.indicators.length
  const cols = adjustedCols(x, model, p)
  const mC: number[][] = []
  const sC: number[][] = []
  const zC: number[][] = []
  for (let j = 0; j < d; j++) {
    const id = model.indicators[j]
    const ph = phases.map((q) => {
      const k = q.indicators.indexOf(id)
      return { start: q.start, shift: k >= 0 ? q.shift[k] : 0, tau: k >= 0 ? q.tau[k] : 6, kappa: q.kappa }
    })
    const { m, s } = personalBaseline(cols[j], model.floor[j], p, ph.map((q) => q.start), ph.map((q) => q.shift), ph.map((q) => q.tau), ph.map((q) => q.kappa))
    mC.push(m)
    sC.push(s)
    zC.push(cols[j].map((v, t) => clip((v - m[t]) / s[t], -p.z_clip, p.z_clip)))
  }
  const z = rows(zC, T)
  const observed = z.map((r) => r.some(isNum))

  // fixed-threshold comparator
  const rawT = columns(x, d).map((c, j) => transformCol(c, model.transform[j]))
  const uFixed: Matrix = Array.from({ length: T }, (_, t) => rawT.map((c, j) => concernDev((c[t] - model.pop_mean[j]) / model.pop_sd[j], model.concern[j])))
  const fixed = kofn(uFixed, p.kofn_k, p.kofn_n)

  const u: Matrix = z.map((r) => r.map((v, j) => concernDev(v, model.concern[j])))
  const zscore = kofn(u, p.kofn_k, p.kofn_n)

  // CUSUM
  const up = new Array<number>(d).fill(0)
  const dn = new Array<number>(d).fill(0)
  const miss = new Array<number>(d).fill(0)
  const calm = new Array<number>(d).fill(0)
  const cusumPaths: Matrix = []
  const cusum = new Array<number>(T).fill(NaN)
  for (let t = 0; t < T; t++) {
    const row = new Array<number>(d)
    for (let j = 0; j < d; j++) {
      const v = z[t][j]
      if (Number.isNaN(v)) {
        miss[j]++
        if (miss[j] >= p.cusum_reset_gap) up[j] = dn[j] = 0
      } else {
        miss[j] = 0
        const c = model.concern[j]
        calm[j] = concernDev(v, c) < p.cusum_k ? calm[j] + 1 : 0
        if (c >= 0) up[j] = Math.max(0, up[j] + v - p.cusum_k)
        if (c <= 0) dn[j] = Math.max(0, dn[j] - v - p.cusum_k)
        if (calm[j] >= p.cusum_calm) up[j] = dn[j] = 0
      }
      row[j] = Math.max(up[j], dn[j])
    }
    cusumPaths.push(row)
    if (observed[t]) cusum[t] = Math.max(...row)
  }

  // one-sided multivariate EWMA
  const lam = p.ewma_lambda
  const scale = lam / (2 - lam)
  const y = new Array<number>(d).fill(0)
  const have = new Array<boolean>(d).fill(false)
  const cache = new Map<string, number[][]>()
  const mewma = new Array<number>(T).fill(NaN)
  for (let t = 0; t < T; t++) {
    for (let j = 0; j < d; j++) {
      const ok = !Number.isNaN(z[t][j])
      if (ok) have[j] = true
      y[j] = (1 - lam) * y[j] + lam * (ok ? z[t][j] : 0)
    }
    const idx = have.map((h, j) => (h ? j : -1)).filter((j) => j >= 0)
    if (!idx.length) continue
    const key = idx.join(',')
    if (!cache.has(key)) cache.set(key, invert(idx.map((a) => idx.map((b) => model.corr[a][b] * scale))))
    const inv = cache.get(key)!
    const v = idx.map((j) => (model.concern[j] === 0 ? y[j] : Math.max(y[j] * model.concern[j], 0)))
    let q = 0
    for (let a = 0; a < v.length; a++) for (let b = 0; b < v.length; b++) q += v[a] * inv[a][b] * v[b]
    if (observed[t]) mewma[t] = q
  }

  const fusion = cusum.map((c, t) => {
    const a = c / model.h_cusum
    const b = mewma[t] / model.h_mewma
    return Number.isNaN(a) ? b : Number.isNaN(b) ? a : Math.max(a, b)
  })

  return { xt: rows(cols, T), z, m: rows(mC, T), s: rows(sC, T), cusum: cusumPaths, scores: { fixed, zscore, cusum, mewma, fusion } }
}

/** Alert episodes: maximal runs with score >= thr, merging runs separated by <= mergeGap days. */
export function episodes(score: number[], thr: number, mergeGap: number, upTo = score.length - 1): [number, number][] {
  const runs: [number, number][] = []
  for (let t = 0; t <= upTo && t < score.length; t++) {
    if (!(score[t] >= thr)) continue
    const last = runs[runs.length - 1]
    if (last && t - last[1] <= mergeGap) last[1] = t
    else runs.push([t, t])
  }
  return runs
}

/** The score that drives alerts in the app (model.deployed, default fusion). */
export function deployedScore(scored: Scored, model: ModelJson): number[] {
  return scored.scores[model.deployed ?? 'fusion']
}
