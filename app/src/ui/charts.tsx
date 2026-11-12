/**
 * Charts are drawn here as inline SVG from data, so they work offline and share one visual
 * system: recessive grid, 2px lines, a neutral band for "your usual range", out-of-range points
 * marked by shape as well as colour, a hover/touch readout on every chart, and a table view.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(Math.max(60, el.clientWidth || 320))
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((e) => setW(Math.max(60, e[0].contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const ok = (v: number | undefined): v is number => v !== undefined && !Number.isNaN(v) && Number.isFinite(v)

function niceTicks(lo: number, hi: number, n = 3): number[] {
  const span = hi - lo || 1
  const raw = span / n
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)))
  return out
}

function linePath(pts: ([number, number] | null)[]): string {
  let d = ''
  let pen = false
  for (const p of pts) {
    if (!p) { pen = false; continue }
    d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`
    pen = true
  }
  return d
}

export interface Marker { day: number; label: string; kind: 'alert' | 'phase' | 'truth' | 'log' }

export interface TrendProps {
  values: number[]
  expected?: number[]
  lo?: number[]
  hi?: number[]
  from: number
  to: number
  labelFor: (day: number) => string
  unit: string
  decimals: number
  markers?: Marker[]
  refLines?: { y: number; label: string }[]
  height?: number
  /** which side of the band is a concern: 1 high, -1 low, 0 both */
  concern?: number
  compact?: boolean
  ariaLabel: string
}

export function TrendChart(p: TrendProps) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = p.height ?? (p.compact ? 56 : 190)
  const padL = p.compact ? 2 : 40
  const padR = p.compact ? 2 : 12
  const padT = p.compact ? 4 : 12
  const padB = p.compact ? 4 : 24
  const from = Math.max(0, p.from)
  const days = useMemo(() => Array.from({ length: Math.max(1, p.to - from + 1) }, (_, i) => from + i), [from, p.to])
  const { y0, y1 } = useMemo(() => {
    const vals: number[] = []
    for (const t of days) {
      for (const a of [p.values[t], p.lo?.[t], p.hi?.[t]]) if (ok(a)) vals.push(a)
    }
    for (const r of p.refLines ?? []) vals.push(r.y)
    if (!vals.length) return { y0: 0, y1: 1 }
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    const pad = (hi - lo || Math.abs(hi) * 0.1 || 1) * 0.12
    lo -= pad
    hi += pad
    return { y0: lo, y1: hi }
  }, [days, p.values, p.lo, p.hi, p.refLines])
  const x = (t: number) => padL + ((t - from) / Math.max(1, p.to - from)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB)
  const isOut = (t: number) => {
    const v = p.values[t]
    if (!ok(v)) return false
    const c = p.concern ?? 0
    if (c >= 0 && ok(p.hi?.[t]) && v > p.hi![t]) return true
    if (c <= 0 && ok(p.lo?.[t]) && v < p.lo![t]) return true
    return false
  }
  // band polygons (split where the baseline is missing)
  const bands: string[] = []
  let seg: number[] = []
  const flush = () => {
    if (seg.length > 1) bands.push(seg.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(p.hi![t]).toFixed(1)}`).join('') + seg.slice().reverse().map((t) => `L${x(t).toFixed(1)} ${y(p.lo![t]).toFixed(1)}`).join('') + 'Z')
    seg = []
  }
  if (p.lo && p.hi) {
    for (const t of days) { if (ok(p.lo[t]) && ok(p.hi[t])) seg.push(t); else flush() }
    flush()
  }
  const showDots = days.length <= 70 && !p.compact
  const ticksY = p.compact ? [] : niceTicks(y0, y1, 3)
  const nX = Math.max(2, Math.min(6, Math.floor((W - padL - padR) / 90)))
  const ticksX = p.compact ? [] : Array.from({ length: nX + 1 }, (_, i) => Math.round(from + (i / nX) * (p.to - from)))
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const fx = (e.clientX - r.left - padL) / Math.max(1, r.width - padL - padR)
    setHover(Math.max(from, Math.min(p.to, Math.round(from + fx * (p.to - from)))))
  }
  const hv = hover !== null ? p.values[hover] : NaN
  return (
    <div className="chart" ref={ref}>
      <svg height={H} role="img" aria-label={p.ariaLabel} onPointerMove={p.compact ? undefined : onMove} onPointerDown={p.compact ? undefined : onMove} onPointerLeave={() => setHover(null)}>
        {ticksY.map((v) => <g key={v}><line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--grid)" /><text className="axis" x={padL - 6} y={y(v) + 4} textAnchor="end">{Number(v.toFixed(2))}</text></g>)}
        {bands.map((d, i) => <path key={i} d={d} fill="var(--band)" />)}
        {p.expected && !p.compact && <path d={linePath(days.map((t) => (ok(p.expected![t]) ? [x(t), y(p.expected![t])] : null)))} fill="none" stroke="var(--text-3)" strokeWidth="1" strokeDasharray="4 4" />}
        {(p.refLines ?? []).map((r, i) => <g key={r.label}><line x1={padL} x2={W - padR} y1={y(r.y)} y2={y(r.y)} stroke="var(--text-2)" strokeDasharray="2 4" />{!p.compact && <text className="axis halo" x={padL + 4} y={y(r.y) + (i % 2 ? 13 : -5)} textAnchor="start">{r.label}</text>}</g>)}
        {(p.markers ?? []).filter((m) => m.day >= from && m.day <= p.to).map((m, i) => (
          <g key={i}>
            <line x1={x(m.day)} x2={x(m.day)} y1={padT} y2={H - padB} stroke={m.kind === 'alert' ? 'var(--serious)' : m.kind === 'truth' ? 'var(--text)' : 'var(--text-3)'} strokeWidth={m.kind === 'alert' ? 2 : 1.5} strokeDasharray={m.kind === 'phase' ? '6 4' : m.kind === 'truth' ? '2 3' : undefined} />
            {!p.compact && <text className="axis halo" x={x(m.day) > W - padR - 90 ? x(m.day) - 5 : x(m.day) + 5} textAnchor={x(m.day) > W - padR - 90 ? 'end' : 'start'} y={padT + 10 + (i % 3) * 14}>{m.label}</text>}
          </g>
        ))}
        <path d={linePath(days.map((t) => (ok(p.values[t]) ? [x(t), y(p.values[t])] : null)))} fill="none" stroke="var(--series)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {days.map((t) => {
          if (!ok(p.values[t])) return null
          const out = isOut(t)
          if (out) return <rect key={t} x={x(t) - 4.5} y={y(p.values[t]) - 4.5} width="9" height="9" transform={`rotate(45 ${x(t)} ${y(p.values[t])})`} fill="var(--serious)" stroke="var(--surface)" strokeWidth="1.5" />
          return showDots ? <circle key={t} cx={x(t)} cy={y(p.values[t])} r="2.6" fill="var(--series)" /> : null
        })}
        {ticksX.map((t, i) => <text key={i} className="axis" x={x(t)} y={H - 6} textAnchor={i === 0 ? 'start' : i === ticksX.length - 1 ? 'end' : 'middle'}>{p.labelFor(t)}</text>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--text-2)" strokeWidth="1" />}
        {hover !== null && ok(hv) && <circle cx={x(hover)} cy={y(hv)} r="5" fill="var(--series)" stroke="var(--surface)" strokeWidth="2" />}
      </svg>
      {hover !== null && (
        <div className="tip num" style={{ left: Math.max(70, Math.min(W - 70, x(hover))), top: 0 }}>
          <strong>{p.labelFor(hover)}</strong> · {ok(hv) ? `${hv.toFixed(p.decimals)} ${p.unit}` : 'not measured'}
          {ok(p.lo?.[hover]) && ok(p.hi?.[hover]) && <> · usual {p.lo![hover].toFixed(p.decimals)}–{p.hi![hover].toFixed(p.decimals)}</>}
        </div>
      )}
    </div>
  )
}

export function TrendLegend({ band = true }: { band?: boolean }) {
  return (
    <div className="legend" aria-hidden="true">
      <span><i />Your readings</span>
      {band && <span><i className="band" />Your usual range</span>}
      {band && <span><i className="out" />Outside your range</span>}
    </div>
  )
}

// ---- generic charts for the Validation screen -------------------------------------------
const SERIES = ['var(--series)', 'var(--series-2)', 'var(--series-3)', 'var(--text-2)']

export interface BarRow { label: string; value: number; lo?: number; hi?: number; note?: string; highlight?: boolean }

export function BarCI({ rows, max, unit, decimals = 0, ariaLabel, pct }: { rows: BarRow[]; max?: number; unit?: string; decimals?: number; ariaLabel: string; pct?: boolean }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const labelW = Math.min(300, Math.max(130, W * 0.46))
  const rowH = 34
  const padR = 64
  const mx = max ?? Math.max(...rows.map((r) => Math.max(r.value || 0, r.hi ?? 0))) * 1.08
  const x = (v: number) => labelW + (Math.max(0, v) / (mx || 1)) * (W - labelW - padR)
  const f = (v: number) => (Number.isNaN(v) ? '–' : pct ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(decimals)}${unit ? ' ' + unit : ''}`)
  return (
    <div className="chart" ref={ref}>
      <svg height={rows.length * rowH + 8} role="img" aria-label={ariaLabel}>
        {rows.map((r, i) => {
          const yy = i * rowH + 6
          return (
            <g key={r.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x="0" y={yy - 4} width={W} height={rowH} fill="transparent" />
              <text x={labelW - 8} y={yy + 15} textAnchor="end" fontSize="12.5" fill="var(--text)" fontWeight={r.highlight ? 700 : 400}>{r.label.length > labelW / 6.1 ? r.label.slice(0, Math.floor(labelW / 6.1) - 1) + '…' : r.label}</text>
              {!Number.isNaN(r.value) && <path d={`M${labelW} ${yy} H${x(r.value) - 4} a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 H${labelW} Z`} fill={r.highlight ? 'var(--series)' : 'var(--text-3)'} opacity={r.highlight ? 1 : 0.75} />}
              {ok(r.lo) && ok(r.hi) && <g stroke="var(--text)" strokeWidth="1.6"><line x1={x(r.lo)} x2={x(r.hi)} y1={yy + 10} y2={yy + 10} /><line x1={x(r.lo)} x2={x(r.lo)} y1={yy + 5} y2={yy + 15} /><line x1={x(r.hi)} x2={x(r.hi)} y1={yy + 5} y2={yy + 15} /></g>}
              <text x={Math.min(W - 2, x(Math.max(r.value || 0, r.hi ?? 0)) + 8)} y={yy + 15} fontSize="12.5" fill="var(--text)" className="num">{f(r.value)}</text>
            </g>
          )
        })}
      </svg>
      {hover !== null && <div className="tip num" style={{ left: W / 2, top: hover * rowH + 30 }}>{rows[hover].label}: <strong>{f(rows[hover].value)}</strong>{ok(rows[hover].lo) && ok(rows[hover].hi) ? ` (95% interval ${f(rows[hover].lo!)} to ${f(rows[hover].hi!)})` : ''}{rows[hover].note ? ` · ${rows[hover].note}` : ''}</div>}
    </div>
  )
}

export interface XYSeries { label: string; x: number[]; y: number[]; lo?: number[]; hi?: number[]; dashed?: boolean }

export function XYChart({ series, xLabel, yLabel, ariaLabel, yPct, xDecimals = 1, yDecimals = 2, height = 220, yMin, yMax, vline, step }: {
  series: XYSeries[]; xLabel: string; yLabel: string; ariaLabel: string; yPct?: boolean; xDecimals?: number; yDecimals?: number; height?: number; yMin?: number; yMax?: number; vline?: { x: number; label: string }; step?: boolean
}) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ s: number; i: number } | null>(null)
  const padL = 46, padR = 14, padT = 26, padB = 38
  const xs = series.flatMap((s) => s.x).filter(ok)
  const ys = series.flatMap((s) => [...s.y, ...(s.lo ?? []), ...(s.hi ?? [])]).filter(ok)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = yMin ?? Math.min(...ys), y1 = yMax ?? Math.max(...ys) * 1.05
  const X = (v: number) => padL + ((v - x0) / (x1 - x0 || 1)) * (W - padL - padR)
  const Y = (v: number) => padT + (1 - (v - y0) / (y1 - y0 || 1)) * (height - padT - padB)
  const fy = (v: number) => (yPct ? `${(v * 100).toFixed(0)}%` : v.toFixed(yDecimals))
  const path = (s: XYSeries) => {
    const pts = s.x.map((xv, i) => (ok(xv) && ok(s.y[i]) ? [X(xv), Y(s.y[i])] as [number, number] : null))
    if (!step) return linePath(pts)
    let d = ''
    let prev: [number, number] | null = null
    for (const q of pts) {
      if (!q) { prev = null; continue }
      d += prev ? `H${q[0].toFixed(1)}V${q[1].toFixed(1)}` : `M${q[0].toFixed(1)} ${q[1].toFixed(1)}`
      prev = q
    }
    return d
  }
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const px = e.clientX - r.left, py = e.clientY - r.top
    let best: { s: number; i: number } | null = null
    let bd = Infinity
    series.forEach((s, si) => s.x.forEach((xv, i) => {
      if (!ok(xv) || !ok(s.y[i])) return
      const d = Math.hypot(X(xv) - px, Y(s.y[i]) - py)
      if (d < bd) { bd = d; best = { s: si, i } }
    }))
    setHover(best)
  }
  return (
    <div className="col" style={{ gap: 6 }}>
      {series.length > 1 && <div className="legend">{series.map((s, i) => <span key={s.label}><i style={{ background: SERIES[i % 4] }} />{s.label}</span>)}</div>}
      <div className="chart" ref={ref}>
        <svg height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {niceTicks(y0, y1, 4).map((v) => <g key={v}><line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--grid)" /><text className="axis" x={padL - 6} y={Y(v) + 4} textAnchor="end">{fy(v)}</text></g>)}
          {niceTicks(x0, x1, Math.max(3, Math.floor(W / 70))).map((v) => <text key={v} className="axis" x={X(v)} y={height - padB + 16} textAnchor="middle">{Number(v.toFixed(xDecimals))}</text>)}
          <text className="axis" x={(padL + W - padR) / 2} y={height - 4} textAnchor="middle">{xLabel}</text>
          <text className="axis" x={4} y={11} textAnchor="start">{yLabel}</text>
          {vline && <g><line x1={X(vline.x)} x2={X(vline.x)} y1={padT} y2={height - padB} stroke="var(--text-3)" strokeDasharray="5 4" /><text className="axis" x={X(vline.x) + 4} y={padT + 10}>{vline.label}</text></g>}
          {series.map((s, si) => s.lo && s.hi ? <path key={'b' + si} d={s.x.map((xv, i) => `${i ? 'L' : 'M'}${X(xv).toFixed(1)} ${Y(s.hi![i]).toFixed(1)}`).join('') + s.x.slice().reverse().map((xv, k) => `L${X(xv).toFixed(1)} ${Y(s.lo![s.x.length - 1 - k]).toFixed(1)}`).join('') + 'Z'} fill={SERIES[si % 4]} opacity="0.14" /> : null)}
          {series.map((s, si) => <path key={si} d={path(s)} fill="none" stroke={SERIES[si % 4]} strokeWidth="2" strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinejoin="round" />)}
          {!step && series.map((s, si) => s.x.length <= 12 ? s.x.map((xv, i) => ok(s.y[i]) ? <circle key={`${si}-${i}`} cx={X(xv)} cy={Y(s.y[i])} r="4" fill={SERIES[si % 4]} stroke="var(--surface)" strokeWidth="2" /> : null) : null)}
          {hover && <circle cx={X(series[hover.s].x[hover.i])} cy={Y(series[hover.s].y[hover.i])} r="6" fill="none" stroke="var(--text)" strokeWidth="2" />}
        </svg>
        {hover && <div className="tip num" style={{ left: Math.max(90, Math.min(W - 90, X(series[hover.s].x[hover.i]))), top: Math.max(0, Y(series[hover.s].y[hover.i]) - 40) }}>{series[hover.s].label}: <strong>{fy(series[hover.s].y[hover.i])}</strong> at {series[hover.s].x[hover.i].toFixed(xDecimals)}</div>}
      </div>
    </div>
  )
}

const REPO = (import.meta.env.VITE_REPO_URL as string | undefined) ?? ''

export function Figure({ title, children, caption, method, script, table }: { title: string; children: ReactNode; caption?: ReactNode; method?: string; script?: string; table?: ReactNode }) {
  return (
    <figure className="fig card">
      <h3>{title}</h3>
      {children}
      <figcaption>
        {caption}
        <span className="row wrap" style={{ marginTop: 6, gap: 14 }}>
          {method && <a href={`#/method/${method}`}>How this was measured</a>}
          {script && <span className="tiny">Made by {REPO ? <a href={`${REPO}/blob/main/${script}`} target="_blank" rel="noreferrer"><code>{script}</code></a> : <code>{script}</code>}</span>}
        </span>
      </figcaption>
      {table && <details><summary>Show the numbers as a table</summary><div className="tablewrap">{table}</div></details>}
    </figure>
  )
}
