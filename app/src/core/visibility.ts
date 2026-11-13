/**
 * What another role is allowed to see about a crew member.  This is the single gate between a
 * person's analysis and anyone else's screen (and the summary queued for the ground), so the
 * privacy rules live here and are unit-tested in visibility.test.ts.
 *
 *  - Cabin-level environment findings are not personal data and are visible to everyone.
 *  - A personal finding is visible only if its primary category is shared with that role.
 *  - 'status' reveals a three-level status; 'trend' adds in/out of range per indicator and the
 *    finding title; 'detail' adds numbers, contributing factors and the recommended action.
 *  - Nothing is shared automatically, including escalations: Keel recommends, the person decides.
 */
import type { DayAnalysis } from './analysis'
import { IND } from './mission'
import { allows, SHARE_CATEGORIES, type Level, type Role, type SharingSettings } from './sharing'
import type { Finding, OpenItem, Photo, Reading, Status } from './types'

export interface VisibleIndicator { ind: string; inRange: boolean; value?: number; expected?: number }
export interface VisibleFinding { symptoms?: string[]; readings?: Reading[]; emergency?: boolean; steps?: string[]; countermeasures?: string[]; urgency?: string; key: string; category: string; status: Status; days: number; title?: string; tier?: string; action?: string; summary?: string; changes?: Finding['changes']; factors?: Finding['factors']   /** from a fixed safety rule (a reading or a reported symptom), not from the readings detector */
  fixed?: boolean
}
export interface RoleView {
  overall: Status | 'private'
  categories: Record<string, { level: Level; status?: Status; indicators?: VisibleIndicator[] }>
  findings: VisibleFinding[]
  environment: Finding[]
}

const rank: Record<string, number> = { urgent: 4, act: 3, watch: 2, steady: 1, learning: 0 }

export function categoryStatus(a: DayAnalysis, cat: string): Status {
  return a.categories[cat] ?? 'learning'
}

export function viewFor(role: Role, a: DayAnalysis, share: SharingSettings, values: Record<string, number> = {}): RoleView {
  const s = share[role]
  const categories: RoleView['categories'] = {}
  let overall: Status | 'private' = 'private'
  // while something urgent is open under emergency sharing, the medical officer who is called to the patient
  // also sees heart, oxygen and temperature and symptoms at trend level (every look is in the access log)
  const emergencyOpen = role === 'cmo' && share.emergency !== false && a.findings.some((f) => f.status === 'urgent' && !f.crewWide)
  for (const cat of SHARE_CATEGORIES) {
    const level: Level = emergencyOpen && (cat === 'cardio' || cat === 'symptoms') && !allows(s[cat], 'trend') ? 'trend' : s[cat]
    categories[cat] = { level }
    if (!allows(level, 'status')) continue
    const st = categoryStatus(a, cat)
    categories[cat].status = st
    if (overall === 'private' || rank[st] > rank[overall]) overall = st
    if (allows(level, 'trend')) {
      categories[cat].indicators = Object.keys(a.u3).filter((i) => IND[i]?.category === cat && !Number.isNaN(a.u3[i])).map((i) => {
        const ch = a.changes.find((c) => c.ind === i)
        // the same test Today uses: outside the usual band on the latest reading(s), not the 3-day average
        const v: VisibleIndicator = { ind: i, inRange: !(ch && ch.daysOut > 0) }
        if (allows(level, 'detail')) {
          v.value = ch?.value ?? values[i]
          v.expected = ch?.expected
        }
        return v
      })
    }
  }
  const findings: VisibleFinding[] = []
  for (const f of a.findings) {
    if (f.kind === 'environment') continue
    const cat = f.categories[0]
    // emergency consent: urgent findings go to the medical officer and the commander (the backup) with their title and action
    // Symptoms marked "medical officer only" in shared/indicators.json are held back from the
    // commander unless the patient is the medical officer, whose backup the commander is.
    if (f.status === 'urgent' && share.emergency !== false && role !== 'ground' && !(role === 'commander' && f.cmoOnly && !f.patientIsCmo)) {
      // the medical officer is told what was reported or measured, with times; the commander only that it happened
      findings.push({ key: f.key, category: cat, status: f.status, days: f.days, title: f.title, tier: f.tier, action: f.action, emergency: true,
        ...(role === 'cmo' || f.patientIsCmo ? { readings: f.readings, symptoms: f.symptoms } : {}) })
      if (overall === 'private' || rank[f.status] > rank[overall]) overall = f.status
      continue
    }
    // the emergency context covers whether readings are in range, not what a notice says
    const level = (s as Record<string, Level>)[cat] ?? 'none'
    // a fixed safety rule that needs attention today (a reading or a reported symptom) reaches the medical officer
    // with its title under emergency consent, whatever the area's level, as the Sharing screen promises
    const fixedToday = role === 'cmo' && share.emergency !== false && (f.kind !== 'personal' || !!f.carriesFixed) && f.urgency === 'today' && f.status === 'act'
    if (!allows(level, 'status') && !fixedToday) continue
    const v: VisibleFinding = { key: f.key, category: cat, status: f.status, days: f.days, ...(f.kind !== 'personal' ? { fixed: true } : {}) }
    if (allows(level, 'trend') || fixedToday) { v.title = f.title; v.tier = f.tier }
    if (allows(level, 'detail')) {
      v.action = f.action
      v.summary = f.summary
      v.steps = f.steps
      v.countermeasures = f.countermeasures
      v.urgency = f.urgency
      v.readings = f.readings
      // only the changes and factors that belong to categories shared in full
      v.changes = f.changes.filter((c) => allows((s as Record<string, Level>)[IND[c.ind]?.category] ?? 'none', 'detail'))
      v.factors = f.factors.filter((x) => allows((s as Record<string, Level>)[FACTOR_CATEGORY[x.id]] ?? 'none', 'detail') || FACTOR_CATEGORY[x.id] === 'environment')
    }
    findings.push(v)
  }
  return { overall, categories, findings, environment: a.findings.filter((f) => f.kind === 'environment') }
}

/** Open items (unclosed 'now' and 'today' findings from the crew member's own entries) another role may see.
 *  Under emergency sharing the medical officer is told of every one; its title is shown for 'now' items and
 *  where its area is shared at 'trend' or more, otherwise only its area ("details not shared").  The commander
 *  sees them only when the patient is the medical officer.  With emergency sharing off, only shared areas
 *  show.  The ground never sees them. */
export function visibleOpenItems(role: Role, items: OpenItem[], share: SharingSettings, patientIsCmo: boolean): (OpenItem & { redacted?: boolean })[] {
  if (role === 'ground') return []
  const out: (OpenItem & { redacted?: boolean })[] = []
  for (const it of items) {
    const shared = allows((share[role] as Record<string, Level>)[it.category] ?? 'none', 'trend')
    const consent = share.emergency !== false && (role === 'cmo' || patientIsCmo)
    if (shared || (consent && it.urgency === 'now')) out.push(it)
    // under emergency consent the medical officer sees what the item is and its readings: they may be asked to clear it
    else if (consent) out.push(role === 'cmo' ? it : { ...it, redacted: true, readings: undefined, symptoms: undefined })
    // without emergency consent the medical officer still sees that an item is open, with nothing about it, so it can be closed
    else if (role === 'cmo' || patientIsCmo) out.push({ ...it, title: 'An item, details private', redacted: true, readings: undefined, symptoms: undefined })
  }
  return out
}

/** Medication classes and photos are part of Symptoms, and are shown only when that area is shared in detail. */
export function visibleExtras(role: Role, share: SharingSettings, meds: string[] | undefined, photos: Photo[] | undefined, emergencyOpen = false): { meds: string[]; photos: Photo[] } {
  const ok = role !== 'ground' && allows((share[role] as Record<string, Level>).symptoms ?? 'none', 'detail')
  // during an emergency the medical officer sees today's medication classes (they explain a fast pulse or confusion)
  const medsOk = ok || (role === 'cmo' && emergencyOpen && share.emergency !== false)
  return { meds: medsOk ? meds ?? [] : [], photos: ok ? photos ?? [] : [] }
}

const FACTOR_CATEGORY: Record<string, string> = {
  meds: 'symptoms', sleep: 'sleep', timing: 'sleep', fluid: 'nutrition', food: 'nutrition', exercise: 'exercise', load: 'exercise', mood: 'cognition',
  symptoms: 'symptoms', co2: 'environment', phase: 'environment',
}

/** Compact store-and-forward summary for the ground: exactly what viewFor('ground') allows. */
export function groundSummary(missionId: string, crew: string, flightDay: number, a: DayAnalysis, share: SharingSettings): string {
  const v = viewFor('ground', a, share)
  const cats: Record<string, unknown> = {}
  for (const [c, x] of Object.entries(v.categories)) {
    if (x.status === undefined) continue
    cats[c] = x.indicators
      ? { s: x.status, i: x.indicators.map((i) => (i.value !== undefined && !Number.isNaN(i.value) ? [i.ind, i.inRange ? 1 : 0, Number(i.value.toFixed(IND[i.ind]?.decimals ?? 1))] : [i.ind, i.inRange ? 1 : 0])) }
      : { s: x.status }
  }
  return JSON.stringify({
    v: 1, m: missionId, fd: flightDay, c: crew, st: v.overall, cats,
    f: v.findings.map((f) => ({ c: f.category, s: f.status, n: f.days, ...(f.title ? { t: f.title, tier: f.tier } : {}) })),
    env: v.environment.map((f) => ({ r: f.ruleId, n: f.days })),
    // under emergency sharing: how many urgent items are open, nothing else (no names, areas or values)
    ...(share.emergency !== false ? { urg: a.openItems.filter((x) => x.urgency === 'now').length } : {}),
  })
}
