import { Component, useEffect, useState, type ReactNode } from 'react'
import type { Status } from '../core/types'

// ---- tiny hash router -------------------------------------------------------------------
export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'today').split('/').map(decodeURIComponent)
  const [r, setR] = useState(read)
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}
export const href = (...parts: string[]) => '#/' + parts.map(encodeURIComponent).join('/')
export const go = (...parts: string[]) => { location.hash = href(...parts) }

// ---- status: colour + shape + label, never colour alone ---------------------------------
export function Glyph({ status, size = 22 }: { status: Status | 'private' | 'unknown' | 'go' | 'caution' | 'hold'; size?: number }) {
  const s = size
  const p = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (status) {
    case 'steady': case 'go':
      return <svg {...p}><circle cx="12" cy="12" r="9.5" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>
    case 'watch': case 'caution':
      return <svg {...p}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r="0.6" fill="currentColor" /></svg>
    case 'act': case 'hold':
      return <svg {...p}><path d="M12 2.5l9.5 9.5-9.5 9.5-9.5-9.5z" /><path d="M12 7.5v6" /><circle cx="12" cy="16.6" r="0.6" fill="currentColor" /></svg>
    case 'urgent':
      return <svg {...p}><path d="M8 2.5h8l5.5 5.5v8L16 21.5H8L2.5 16V8z" /><path d="M12 7v6.5" /><circle cx="12" cy="16.8" r="0.6" fill="currentColor" /></svg>
    case 'private':
      return <svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 018 0v3" /></svg>
    default:
      return <svg {...p} strokeDasharray="3 3.4"><circle cx="12" cy="12" r="9.5" /></svg>
  }
}

const CLS: Record<string, string> = { go: 'steady', caution: 'watch', hold: 'act', unknown: 'learning' }
export function StatusTag({ status, label, size }: { status: Status | 'private' | 'unknown' | 'go' | 'caution' | 'hold'; label: string; size?: number }) {
  return <span className={`status st-${CLS[status] ?? status}`}><Glyph status={status} size={size} /><span className="lbl">{label}</span></span>
}

export function Card({ title, right, children, className = '', id }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || right) && <div className="card-h">{title ? <h2>{title}</h2> : <span />}{right}</div>}
      {children}
    </section>
  )
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  )
}

export const Chev = () => <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>

export function LinkRow({ to, title, sub, left }: { to: string; title: ReactNode; sub?: ReactNode; left?: ReactNode }) {
  return (
    <a className="linkrow" href={to}>
      <span className="row">{left}<span className="col" style={{ gap: 2 }}><strong>{title}</strong>{sub && <span className="small muted">{sub}</span>}</span></span>
      <Chev />
    </a>
  )
}

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'today': return <svg {...p}><path d="M3 12h4l2.5-6 4 12 2.5-6h5" /></svg>
    case 'trends': return <svg {...p}><path d="M4 19V5M4 19h16" /><path d="M7.5 15l3.5-4 3 2.5 4.5-6" /></svg>
    case 'checkin': return <svg {...p}><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V2.8h6V4M12 9.5v6M9 12.5h6" /></svg>
    case 'crew': return <svg {...p}><circle cx="8.5" cy="9" r="3" /><circle cx="16.5" cy="10" r="2.4" /><path d="M2.8 19c.6-3 2.8-4.6 5.7-4.6s5.1 1.6 5.7 4.6M15 14.6c2.8-.3 5 1 5.8 3.9" /></svg>
    case 'more': return <svg {...p}><circle cx="5.5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" /></svg>
    case 'link': return <svg {...p}><path d="M5 19l5.5-5.5" /><circle cx="13.5" cy="10.5" r="2" /><path d="M9.5 6.5a8 8 0 018 8M11 2.8A11.5 11.5 0 0121.2 13" /></svg>
    case 'play': return <svg {...p}><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg>
    case 'pause': return <svg {...p}><path d="M8 5v14M16 5v14" strokeWidth="3" /></svg>
    case 'lock': return <svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 018 0v3" /></svg>
    case 'info': return <svg {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6" /><circle cx="12" cy="7.6" r="0.7" fill="currentColor" /></svg>
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>
  }
}

export function KeelMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M6 13h20M7.5 13c1.2 5.5 4.3 8.5 8.5 8.5s7.3-3 8.500-8.500" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 21.500v5" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Simulated({ real, source }: { real?: boolean; source?: string }) {
  return real
    ? <span className="chip real" title={source}>Real data{source ? ` · ${source}` : ''}</span>
    : <span className="chip sim" title="These numbers come from Keel's physiological simulator, not from a person.">Simulated data</span>
}

export function Ring({ value, size = 68, label }: { value: number; size?: number; label: string }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <svg width={size} height={size} role="img" aria-label={label}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--series-3)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} />
      </g>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.22} fontWeight="700" fill="var(--text)">{Math.round(v * 100)}%</text>
    </svg>
  )
}

export function Sources({ ids, refs }: { ids: string[]; refs: Record<string, { text: string; url: string | null }> }) {
  return (
    <ul className="list small">
      {ids.filter((i) => refs[i]).map((i) => (
        <li key={i}><span className="muted">[{i}]</span> {refs[i].text} {refs[i].url && <a href={refs[i].url!} target="_blank" rel="noreferrer">Source</a>}</li>
      ))}
    </ul>
  )
}

/** A fault on one screen must never blank the whole app: show a plain message and a way back. */
export class ScreenBoundary extends Component<{ children: ReactNode; name: string }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  componentDidUpdate(prev: { name: string }) {
    if (prev.name !== this.props.name && this.state.error) this.setState({ error: null })
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="card" role="alert">
        <h2>This screen hit a problem</h2>
        <p className="muted">The rest of Keel is still working and your data is safe on this device.</p>
        <p className="small muted">{this.state.error}</p>
        <a className="btn" href="#/today">Back to Today</a>
      </section>
    )
  }
}
