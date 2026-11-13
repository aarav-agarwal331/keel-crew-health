/**
 * Import adapters: generic CSV, Fitbit (Google Takeout JSON), Apple Health (export.xml).
 * Everything is parsed in the browser; no file leaves the device.
 * All adapters produce the same shape: one row per calendar day with Keel indicator ids.
 */
import type { Mission } from './types'

export interface DayRow { date: string; values: Record<string, number> }
export interface ImportResult { rows: DayRow[]; format: string; notes: string[] }

const ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'datetime', 'calendar_date', 'dateofsleep', 'summary_date'],
  rhr: ['rhr', 'resting_hr', 'restinghr', 'resting_heart_rate', 'restingheartrate', 'resting heart rate', 'hr_lowest', 'lowest_heart_rate'],
  hrv: ['hrv', 'rmssd', 'hrv_rmssd', 'average_hrv', 'hrv (ms)', 'heart_rate_variability'],
  spo2: ['spo2', 'blood_oxygen', 'oxygen_saturation', 'spo2_average', 'avg_spo2'],
  temp: ['temp', 'temperature', 'body_temperature', 'skin_temp', 'temperature_c'],
  sleep_h: ['sleep_h', 'sleep_hours', 'sleep', 'total_sleep_hours', 'hours_asleep'],
  sleep_min: ['minutesasleep', 'minutes_asleep', 'sleep_minutes', 'total_sleep_minutes'],
  sleep_sec: ['total_sleep_duration', 'sleep_seconds'],
  ex_min: ['ex_min', 'exercise_min', 'exercise_minutes', 'active_minutes', 'very_active_minutes', 'activity_minutes'],
  pvt_rt: ['pvt_rt', 'reaction_ms', 'reaction_time'],
  mood: ['mood'],
  fluid: ['fluid', 'fluid_l', 'water_l', 'water'],
  energy: ['energy', 'food_pct'],
  mass: ['mass', 'weight', 'weight_kg', 'body_mass'],
  sbp: ['sbp', 'systolic', 'bp_systolic'],
  dbp: ['dbp', 'diastolic', 'bp_diastolic'],
  glucose: ['glucose', 'blood_sugar', 'glucose_mgdl'],
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (ch === sep && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const isoDay = (s: string): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s)
  if (us) return `${us[3].length === 2 ? '20' + us[3] : us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export function parseCsv(text: string): ImportResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim().length)
  if (lines.length < 2) throw new Error('The file has no data rows.')
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : lines[0].includes('\t') && !lines[0].includes(',') ? '\t' : ','
  const head = splitCsvLine(lines[0], sep).map((h) => h.toLowerCase().replace(/^"|"$/g, ''))
  const col: Record<string, number> = {}
  for (const [key, names] of Object.entries(ALIASES)) {
    const i = head.findIndex((h) => names.includes(h))
    if (i >= 0) col[key] = i
  }
  if (col.date === undefined) throw new Error('No date column found. Name it "date".')
  const mapped = Object.keys(col).filter((k) => k !== 'date')
  if (!mapped.length) throw new Error('No known indicator columns found. See the sample file for column names.')
  const byDay = new Map<string, Record<string, number[]>>()
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, sep)
    const day = isoDay(cells[col.date] ?? '')
    if (!day) continue
    const rec = byDay.get(day) ?? {}
    for (const k of mapped) {
      const v = Number((cells[col[k]] ?? '').replace(',', '.'))
      if (cells[col[k]] === '' || Number.isNaN(v)) continue
      const id = k === 'sleep_min' || k === 'sleep_sec' ? 'sleep_h' : k
      const val = k === 'sleep_min' ? v / 60 : k === 'sleep_sec' ? v / 3600 : v
      ;(rec[id] ??= []).push(val)
    }
    byDay.set(day, rec)
  }
  const notes = [`Columns used: ${mapped.join(', ')}`]
  return { rows: glucoseUnits(collapse(byDay), notes), format: 'CSV', notes }
}

// spot readings that a fixed safety rule looks at: never average them, keep the most worrying one of the day
const EXTREME: Record<string, (v: number[]) => number> = {
  glucose: (v) => (Math.min(...v) < 70 ? Math.min(...v) : Math.max(...v)),
  sbp: (v) => (Math.min(...v) < 90 ? Math.min(...v) : Math.max(...v)),
  dbp: (v) => Math.max(...v),
  spo2: (v) => Math.min(...v),
}
function collapse(byDay: Map<string, Record<string, number[]>>, sum: string[] = []): DayRow[] {
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, rec]) => ({
    date,
    values: Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, sum.includes(k) ? v.reduce((a, b) => a + b, 0) : EXTREME[k] ? EXTREME[k](v) : v.reduce((a, b) => a + b, 0) / v.length])),
  }))
}

/** A CSV gives no unit for blood sugar.  If most values are under 35 the file is in mmol/L: convert it. */
function glucoseUnits(rows: DayRow[], notes: string[]): DayRow[] {
  const g = rows.map((r) => r.values.glucose).filter((v) => v !== undefined && !Number.isNaN(v))
  if (!g.length) return rows
  const low = g.filter((v) => v < 35).length / g.length
  if (low > 0.5) {
    notes.push('Blood sugar values look like mmol/L (most are under 35), so they were converted to mg/dL (x 18).')
    return rows.map((r) => (r.values.glucose === undefined ? r : { ...r, values: { ...r.values, glucose: r.values.glucose * 18.016 } }))
  }
  if (low > 0) notes.push(`${g.filter((v) => v < 35).length} blood sugar value(s) under 35 mg/dL were left out: check the unit in the file.`)
  return rows.map((r) => (r.values.glucose !== undefined && r.values.glucose < 35 ? { ...r, values: Object.fromEntries(Object.entries(r.values).filter(([k]) => k !== 'glucose')) } : r))
}

/** Fitbit / Google Takeout: resting_heart_rate-*.json and sleep-*.json (arrays of records). */
export function parseFitbitJson(text: string): ImportResult {
  const data = JSON.parse(text) as unknown
  if (!Array.isArray(data)) throw new Error('Expected a Fitbit JSON array.')
  const byDay = new Map<string, Record<string, number[]>>()
  const push = (day: string | null, k: string, v: number) => {
    if (!day || Number.isNaN(v) || v === 0) return
    const rec = byDay.get(day) ?? {}
    ;(rec[k] ??= []).push(v)
    byDay.set(day, rec)
  }
  let kind = ''
  for (const r of data as Record<string, unknown>[]) {
    if (r.dateOfSleep !== undefined) {
      kind = 'sleep'
      push(isoDay(String(r.dateOfSleep)), 'sleep_h', Number(r.minutesAsleep) / 60)
    } else if (r.dateTime !== undefined && typeof r.value === 'object' && r.value !== null) {
      const v = r.value as Record<string, unknown>
      if (v.value !== undefined) { kind = 'resting heart rate'; push(isoDay(String(r.dateTime)), 'rhr', Number(v.value)) }
      if (v.rmssd !== undefined) { kind = 'heart rate variability'; push(isoDay(String(r.dateTime)), 'hrv', Number(v.rmssd)) }
    }
  }
  if (!byDay.size) throw new Error('No resting heart rate, HRV or sleep records found in this Fitbit file.')
  return { rows: collapse(byDay, ['sleep_h']), format: `Fitbit export (${kind})`, notes: [] }
}

const AH: Record<string, { id: string; scale?: number; sum?: boolean }> = {
  HKQuantityTypeIdentifierRestingHeartRate: { id: 'rhr' },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { id: 'hrv' },
  HKQuantityTypeIdentifierOxygenSaturation: { id: 'spo2', scale: 100 },
  HKQuantityTypeIdentifierBodyTemperature: { id: 'temp' },
  HKQuantityTypeIdentifierBodyMass: { id: 'mass' },
  HKQuantityTypeIdentifierBloodPressureSystolic: { id: 'sbp' },
  HKQuantityTypeIdentifierBloodGlucose: { id: 'glucose' },
  HKQuantityTypeIdentifierAppleExerciseTime: { id: 'ex_min', sum: true },
}

/** Apple Health export.xml, read with a streaming regular expression (the file can be large). */
export function parseAppleHealth(text: string): ImportResult {
  const byDay = new Map<string, Record<string, number[]>>()
  const re = /<Record\b([^>]*)>/g
  const attr = (s: string, k: string) => new RegExp(`\\b${k}="([^"]*)"`).exec(s)?.[1]
  let m: RegExpExecArray | null
  let n = 0
  while ((m = re.exec(text))) {
    const a = m[1]
    const type = attr(a, 'type') ?? ''
    const start = attr(a, 'startDate') ?? ''
    const end = attr(a, 'endDate') ?? ''
    if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
      const val = attr(a, 'value') ?? ''
      if (!/Asleep/.test(val)) continue
      const h = (new Date(end.replace(' ', 'T').replace(' ', '')).getTime() - new Date(start.replace(' ', 'T').replace(' ', '')).getTime()) / 3.6e6
      const day = isoDay(end)
      if (!day || !(h > 0) || h > 16) continue
      const rec = byDay.get(day) ?? {}
      ;(rec.sleep_h ??= []).push(h)
      byDay.set(day, rec)
      n++
      continue
    }
    const map = AH[type]
    if (!map) continue
    let v = Number(attr(a, 'value'))
    if (Number.isNaN(v)) continue
    if (map.scale && v <= 1) v *= map.scale
    if (map.id === 'glucose' && (attr(a, 'unit') ?? '').startsWith('mmol')) v *= 18.016
    if (map.id === 'mass' && attr(a, 'unit') === 'lb') v *= 0.45359237
    if (map.id === 'temp' && attr(a, 'unit') === 'degF') v = (v - 32) / 1.8
    const day = isoDay(start)
    if (!day) continue
    const rec = byDay.get(day) ?? {}
    ;(rec[map.id] ??= []).push(v)
    byDay.set(day, rec)
    n++
  }
  if (!n) throw new Error('No supported records found in this Apple Health export.')
  return { rows: collapse(byDay, ['sleep_h', 'ex_min']), format: 'Apple Health export', notes: ['Apple reports heart rate variability as SDNN, not RMSSD. Keel compares it only with your own history, so the difference in definition does not matter for the baseline.'] }
}

export function parseAny(name: string, text: string): ImportResult {
  const lower = name.toLowerCase()
  if (lower.endsWith('.xml') || text.trimStart().startsWith('<?xml') || text.includes('<HealthData')) return parseAppleHealth(text)
  if (lower.endsWith('.json') || text.trimStart().startsWith('[')) return parseFitbitJson(text)
  return parseCsv(text)
}

/** Turn imported day rows into a one-person data set the rest of Keel can analyse. */
export function toMission(res: ImportResult, title: string, merge?: Mission): Mission {
  if (!res.rows.length) throw new Error('No usable days found.')
  const t0 = new Date(res.rows[0].date + 'T00:00:00Z').getTime()
  const idx = (d: string) => Math.round((new Date(d + 'T00:00:00Z').getTime() - t0) / 864e5)
  const days = idx(res.rows[res.rows.length - 1].date) + 1
  if (days > 3660) throw new Error('The file spans more than ten years; trim it first.')
  const series: Record<string, (number | null)[]> = merge?.series.you ?? {}
  for (const r of res.rows) {
    for (const [k, v] of Object.entries(r.values)) {
      if (!series[k] || series[k].length < days) series[k] = [...(series[k] ?? []), ...new Array(days - (series[k]?.length ?? 0)).fill(null)]
      series[k][idx(r.date)] = Number(v.toFixed(3))
    }
  }
  return {
    id: 'personal', title, simulated: false, kind: 'personal', days, pre_days: 0, flight_days: days, landing_day: null,
    crew: [{ id: 'you', name: 'You', role: 'crew', role_label: 'Imported data' }], phases: [], series: { you: series }, symptoms: { you: {} },
    env: { co2: new Array(days).fill(null), rad: new Array(days).fill(null) }, truth: [], environment: 'Earth',
    blurb: `${days} days from ${res.rows[0].date}, imported from ${res.format}. Stored only on this device.`, link: { profile: 'none' },
    default_day: days - 1, default_crew: 'you', day_label: 'Day', source: { name: res.format, citation: 'Your own file', license: 'Yours', url: '' },
  }
}
