import type { PhaseJson, Scored } from './detect'

export interface CrewMember {
  id: string
  name: string
  role: 'commander' | 'cmo' | 'crew'
  role_label: string
}

export interface TruthEvent {
  type: string
  crew: number
  onset: number
  magnitude: number
  label: string
  detail?: string
}

export interface Mission {
  id: string
  title: string
  simulated: boolean
  /** 'simulated' | 'real' | 'personal' */
  kind?: string
  days: number
  pre_days: number
  flight_days: number
  landing_day: number | null
  crew: CrewMember[]
  phases: PhaseJson[]
  series: Record<string, Record<string, (number | null)[]>>
  symptoms: Record<string, Record<string, number[]>>
  env: { co2: (number | null)[]; rad: (number | null)[] }
  truth: TruthEvent[]
  environment: string
  blurb: string
  link: { profile: string }
  default_day?: number
  default_crew?: string
  /** real-data missions: where the data came from */
  source?: { name: string; citation: string; license: string; url: string }
  /** label for day 0 offset, e.g. real datasets count days from first recording */
  day_label?: string
}

export interface IndicatorDef {
  id: string
  label: string
  short: string
  unit: string
  category: string
  system: string
  transform: string
  concern: number
  floor: number
  decimals: number
  range: [number, number]
  /** hard limits for typed entries (outside = a typing slip); between range and limits the value is accepted after a confirmation */
  limits?: [number, number]
  source: string
  detect: boolean
  plain: string
  how: string
  why: string
}

export interface Entry {
  key: string // mission|crew|day
  mission: string
  crew: string
  day: number
  values: Record<string, number>
  symptoms: string[]
  note?: string
  ts: number
  /** every spot reading entered that day, in order, never overwritten (values holds the latest of each) */
  readings?: Reading[]
  /** medication classes the crew member logged that day (free of doses: for the medical officer's context) */
  meds?: string[]
  /** photos taken for the medical officer (downscaled, stored on this device only) */
  photos?: Photo[]
}

export interface Photo { ts: number; label: string; data: string }

export interface Reading { ind: string; v: number; ts: number }

/** A 'now' or 'today' finding raised from the crew member's own entry; stays listed until the medical officer closes it. */
export interface OpenItem { key: string; ruleId: string; title: string; day: number; urgency: Urgency; category: string }

export interface ActionLog {
  id?: number
  mission: string
  crew: string
  alertKey: string
  day: number
  did: string
  feel: number | null
  note: string
  ts: number
}

export type Tier = 'self' | 'cmo' | 'ground'
export type Urgency = 'now' | 'today' | 'routine'
export type Status = 'learning' | 'steady' | 'watch' | 'act' | 'urgent'

export interface CrewAnalysis {
  crewId: string
  /** raw detection features [day][indicator] in model order */
  x: number[][]
  scored: Scored
}

export interface Change {
  ind: string
  /** today's value in display units, NaN if not measured today */
  value: number
  /** personal baseline (display units) */
  expected: number
  lo: number
  hi: number
  /** mean concern-direction deviation over the last three measured days */
  u3: number
  z: number
  direction: 'higher' | 'lower'
  /** share of this person's last 60 scored days that were less unusual than today */
  percentile: number
  daysOut: number
  /** history used for the comparison: measured days, and how many of them were less unusual */
  nHist?: number
  nLess?: number
  uToday?: number
  /** clearly outside the usual range (smaller drifts are kept only as supporting evidence for a rule) */
  notable?: boolean
}

export interface Factor {
  id: string
  text: string
  evidence: string
}

export interface Finding {
  key: string
  kind: 'personal' | 'environment' | 'symptom' | 'adaptation' | 'vital'
  crewWide: boolean
  status: Status
  start: number
  days: number
  ruleId: string
  title: string
  summary: string
  changes: Change[]
  factors: Factor[]
  action: string
  steps: string[]
  tier: Tier
  tierReason: string
  /** how soon: now, today, or at the next routine opportunity */
  urgency: Urgency
  countermeasures: string[]
  score?: number
  threshold?: number
  detectorTier?: 'notice' | 'alert'
  /** first day of the pattern now showing (the alert itself may have opened earlier for another reason) */
  patternStart?: number
  firstNotice?: { day: number; title: string }
  /** other pattern rules that also hold right now */
  also?: { title: string; action: string }[]
  categories: string[]
  /** the entered readings this fixed rule is looking at (every one from the most recent day with a reading) */
  readings?: Reading[]
  /** red-flag symptoms that go to the medical officer only (the commander is told only when the patient is the medical officer) */
  cmoOnly?: boolean
  /** the patient is the crew medical officer, so the commander is the backup */
  patientIsCmo?: boolean
  /** who leads, when it is not the tier's default (cabin issues) */
  who?: string
}
