import indicatorsJson from '../../../shared/indicators.json'
import type { Entry, IndicatorDef, Mission } from './types'

export const INDICATORS = indicatorsJson.indicators as unknown as IndicatorDef[]
export const IND: Record<string, IndicatorDef> = Object.fromEntries(INDICATORS.map((i) => [i.id, i]))
export const CATEGORIES = indicatorsJson.categories as { id: string; label: string }[]
export const SYMPTOMS = indicatorsJson.symptoms as { id: string; label: string; red_flag?: boolean }[]
export const SYM: Record<string, { id: string; label: string; red_flag?: boolean }> = Object.fromEntries(SYMPTOMS.map((s) => [s.id, s]))

const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v)

/** Raw series for one indicator with the crew member's own entries laid over the mission data. */
export function rawSeries(m: Mission, crewId: string, ind: string, entries: Entry[]): number[] {
  if (ind === 'co2' || ind === 'rad') return m.env[ind].map(num)
  if (ind === 'ex7') return rollingMean(rawSeries(m, crewId, 'ex_min', entries), 7, 4)
  const base = (m.series[crewId]?.[ind] ?? new Array(m.days).fill(null)).map(num)
  for (const e of entries) if (e.crew === crewId && e.mission === m.id && ind in e.values && e.day < base.length) base[e.day] = e.values[ind]
  return base
}

export function rollingMean(v: number[], n: number, minValid: number): number[] {
  return v.map((_, t) => {
    const w = v.slice(Math.max(0, t - n + 1), t + 1).filter((a) => !Number.isNaN(a))
    return w.length >= minValid ? w.reduce((a, b) => a + b, 0) / w.length : NaN
  })
}

/** Detection features [day][indicator] in the model's indicator order. */
export function features(m: Mission, crewId: string, ids: string[], entries: Entry[]): number[][] {
  const cols = ids.map((id) => rawSeries(m, crewId, id, entries))
  return Array.from({ length: m.days }, (_, t) => cols.map((c) => c[t]))
}

/** Symptoms reported on a day: mission data plus the crew member's own check-ins. */
export function symptomsOn(m: Mission, crewId: string, day: number, entries: Entry[]): string[] {
  const own = entries.find((e) => e.crew === crewId && e.mission === m.id && e.day === day)
  if (own) return own.symptoms
  const s = m.symptoms[crewId] ?? {}
  return Object.keys(s).filter((k) => s[k].includes(day))
}

export function dayLabel(m: Mission, day: number): string {
  if (m.day_label) return `${m.day_label} ${day + 1}`
  const fd = day - m.pre_days
  return fd < 0 ? `Launch minus ${-fd}` : `Flight day ${fd + 1}`
}

export function shortDay(m: Mission, day: number): string {
  if (m.day_label) return `${day + 1}`
  const fd = day - m.pre_days
  return fd < 0 ? `${-fd} d to launch` : `Day ${fd + 1}`
}

export function phaseAt(m: Mission, day: number): { name: string; since: number } {
  let name = m.kind === 'simulated' || m.simulated ? 'Pre-flight baseline' : 'Baseline'
  let since = day
  for (const p of m.phases) if (day >= p.start) { name = p.name; since = day - p.start }
  return { name, since }
}

export function fmt(ind: string, v: number): string {
  if (Number.isNaN(v)) return '–'
  const d = IND[ind]?.decimals ?? 1
  return v.toFixed(d)
}
