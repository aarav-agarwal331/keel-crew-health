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
import type { Finding, Status } from './types'

export interface VisibleIndicator { ind: string; inRange: boolean; value?: number; expected?: number }
export interface VisibleFinding { key: string; category: string; status: Status; days: number; title?: string; tier?: string; action?: string; summary?: string; changes?: Finding['changes']; factors?: Finding['factors'] }
export interface RoleView {
  overall: Status | 'private'
  categories: Record<string, { level: Level; status?: Status; indicators?: VisibleIndicator[] }>
  findings: VisibleFinding[]
  environment: Finding[]
}

const rank: Record<string, number> = { urgent: 4, act: 3, watch: 2, steady: 1, learning: 0 }

export function categoryStatus(a: DayAnalysis, cat: string): Status {
  let best: Status = 'steady'
  let any = false
  for (const [ind, u] of Object.entries(a.u3)) {
    if (IND[ind]?.category !== cat || Number.isNaN(u)) continue
    any = true
    const st: Status = u >= 2.5 ? 'act' : u >= 1.5 ? 'watch' : 'steady'
    if (rank[st] > rank[best]) best = st
  }
  for (const f of a.findings) if (f.kind !== 'environment' && f.categories[0] === cat && rank[f.status] > rank[best]) best = f.status
  return any || best !== 'steady' ? best : 'learning'
}

export function viewFor(role: Role, a: DayAnalysis, share: SharingSettings, values: Record<string, number> = {}): RoleView {
  const s = share[role]
  const categories: RoleView['categories'] = {}
  let overall: Status | 'private' = 'private'
  for (const cat of SHARE_CATEGORIES) {
    const level = s[cat]
    categories[cat] = { level }
    if (!allows(level, 'status')) continue
    const st = categoryStatus(a, cat)
    categories[cat].status = st
    if (overall === 'private' || rank[st] > rank[overall]) overall = st
    if (allows(level, 'trend')) {
      categories[cat].indicators = Object.keys(a.u3).filter((i) => IND[i]?.category === cat && !Number.isNaN(a.u3[i])).map((i) => {
        const ch = a.changes.find((c) => c.ind === i)
        const v: VisibleIndicator = { ind: i, inRange: !(a.u3[i] >= 1.5) }
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
    const level = (s as Record<string, Level>)[cat] ?? 'none'
    if (!allows(level, 'status')) continue
    const v: VisibleFinding = { key: f.key, category: cat, status: f.status, days: f.days }
    if (allows(level, 'trend')) { v.title = f.title; v.tier = f.tier }
    if (allows(level, 'detail')) {
      v.action = f.action
      v.summary = f.summary
      // only the changes and factors that belong to categories shared in full
      v.changes = f.changes.filter((c) => allows((s as Record<string, Level>)[IND[c.ind]?.category] ?? 'none', 'detail'))
      v.factors = f.factors.filter((x) => allows((s as Record<string, Level>)[FACTOR_CATEGORY[x.id]] ?? 'none', 'detail') || FACTOR_CATEGORY[x.id] === 'environment')
    }
    findings.push(v)
  }
  return { overall, categories, findings, environment: a.findings.filter((f) => f.kind === 'environment') }
}

const FACTOR_CATEGORY: Record<string, string> = {
  sleep: 'sleep', timing: 'sleep', fluid: 'nutrition', food: 'nutrition', exercise: 'exercise', load: 'exercise', mood: 'cognition',
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
  })
}
