import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeDay } from './analysis'
import { scorePerson, type ModelJson } from './detect'
import { features } from './mission'
import { defaultSharing, SHARE_CATEGORIES, type SharingSettings } from './sharing'
import type { Mission } from './types'
import { groundSummary, viewFor } from './visibility'

const m = JSON.parse(fs.readFileSync('public/data/missions/mars_transit.json', 'utf8')) as Mission
const model = JSON.parse(fs.readFileSync('public/data/model_mission.json', 'utf8')) as ModelJson
const illness = m.truth.find((e) => e.type === 'illness')!
const crew = m.crew[illness.crew].id
const x = features(m, crew, model.indicators, [])
const a = analyzeDay(m, crew, { crewId: crew, x, scored: scorePerson(x, model, m.phases) }, model, illness.onset + 3, [])
const none = (): SharingSettings => {
  const s = defaultSharing()
  for (const r of ['cmo', 'commander', 'ground'] as const) for (const c of SHARE_CATEGORIES) s[r][c] = 'none'
  return s
}

describe('privacy gate', () => {
  it('there is something private to protect in this fixture', () => {
    expect(a.findings.some((f) => f.kind === 'personal')).toBe(true)
  })
  it('with nothing shared, a role sees no personal status, finding, title or number', () => {
    for (const role of ['cmo', 'commander', 'ground'] as const) {
      const v = viewFor(role, a, none())
      expect(v.overall).toBe('private')
      expect(v.findings).toHaveLength(0)
      expect(Object.values(v.categories).every((c) => c.status === undefined && c.indicators === undefined)).toBe(true)
    }
    const payload = groundSummary(m.id, crew, 1, a, none())
    expect(payload).not.toMatch(/strain|rhr|hrv|temp|R-ILL/)
  })
  it('status level reveals a status but no titles, indicators or numbers', () => {
    const s = none()
    s.cmo.cardio = 'status'
    const v = viewFor('cmo', a, s)
    expect(v.categories.cardio.status).toBeDefined()
    expect(v.categories.cardio.indicators).toBeUndefined()
    for (const f of v.findings) { expect(f.title).toBeUndefined(); expect(f.changes).toBeUndefined(); expect(f.action).toBeUndefined() }
    expect(v.categories.sleep.status).toBeUndefined()
  })
  it('trend level adds in/out of range and titles, still no numbers', () => {
    const s = none()
    s.cmo.cardio = 'trend'
    const v = viewFor('cmo', a, s)
    expect(v.categories.cardio.indicators!.length).toBeGreaterThan(0)
    expect(v.categories.cardio.indicators!.every((i) => i.value === undefined)).toBe(true)
    expect(v.findings.every((f) => f.changes === undefined)).toBe(true)
  })
  it('detail level reveals numbers only for categories shared in full', () => {
    const s = none()
    s.cmo.cardio = 'detail'
    const v = viewFor('cmo', a, s)
    const f = v.findings.find((q) => q.category === 'cardio')
    expect(f?.changes?.length).toBeGreaterThan(0)
    expect(f!.changes!.every((c) => ['rhr', 'hrv', 'spo2', 'temp', 'sbp'].includes(c.ind))).toBe(true)
    expect(f!.factors!.every((q) => !['sleep', 'mood', 'symptoms', 'fluid'].includes(q.id))).toBe(true)
  })
  it('sharing with one role never leaks to another', () => {
    const s = none()
    s.cmo.cardio = 'detail'
    expect(viewFor('commander', a, s).overall).toBe('private')
    expect(viewFor('ground', a, s).findings).toHaveLength(0)
  })
  it('cabin-level findings are visible to everyone and the ground summary stays small', () => {
    const co2 = m.truth.find((e) => e.type === 'co2')!
    const xa = features(m, 'c0', model.indicators, [])
    const b = analyzeDay(m, 'c0', { crewId: 'c0', x: xa, scored: scorePerson(xa, model, m.phases) }, model, co2.onset + 5, [])
    expect(viewFor('commander', b, none()).environment.length).toBeGreaterThan(0)
    const all = defaultSharing()
    for (const c of SHARE_CATEGORIES) all.ground[c] = 'detail'
    expect(new TextEncoder().encode(groundSummary(m.id, crew, 1, a, all)).length).toBeLessThan(1500)
  })
})
