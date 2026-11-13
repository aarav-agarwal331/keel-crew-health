import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeDay } from './analysis'
import { scorePerson, type ModelJson } from './detect'
import { features } from './mission'
import { defaultSharing, SHARE_CATEGORIES, type SharingSettings } from './sharing'
import type { Mission } from './types'
import { groundSummary, viewFor, visibleExtras, visibleOpenItems } from './visibility'

const m = JSON.parse(fs.readFileSync('public/data/missions/mars_transit.json', 'utf8')) as Mission
const model = JSON.parse(fs.readFileSync('public/data/model_mission.json', 'utf8')) as ModelJson
const illness = m.truth.find((e) => e.type === 'illness')!
const crew = m.crew[illness.crew].id
const x = features(m, crew, model.indicators, [])
const an = { crewId: crew, x, scored: scorePerson(x, model, m.phases) }
// a day on which the illness guidance is open, so there is a heart-and-circulation finding to protect
const day = [...Array(10).keys()].map((k) => illness.onset + k).find((d) => analyzeDay(m, crew, an, model, d, []).findings.some((f) => f.changes.some((c) => c.ind === 'rhr' || c.ind === 'hrv'))) ?? illness.onset + 3
const a = analyzeDay(m, crew, an, model, day, [])
const none = (): SharingSettings => {
  const s = defaultSharing()
  s.emergency = false
  for (const r of ['cmo', 'commander', 'ground'] as const) for (const c of SHARE_CATEGORIES) s[r][c] = 'none'
  return s
}

describe('privacy gate', () => {
  it('under emergency consent a same-day fixed-rule item reaches the medical officer with its title, even in an unshared area', () => {
    const e = (d: number) => ({ key: `k${d}`, mission: m.id, crew, day: d, values: {}, symptoms: ['headache'], ts: d })
    const b = analyzeDay(m, crew, an, model, 100, [e(98), e(99), e(100)])
    const f = b.findings.find((x) => x.ruleId === 'R-SYM-PERSIST')
    expect(f).toBeDefined()
    const sh = none(); sh.emergency = true
    expect(viewFor('cmo', b, sh).findings.some((x) => x.key === f!.key && x.title === f!.title)).toBe(true)
    expect(viewFor('commander', b, sh).findings.some((x) => x.key === f!.key)).toBe(false)
  })
  it('there is something private to protect in this fixture', () => {
    expect(a.findings.some((f) => !f.crewWide)).toBe(true)
  })
  it('with nothing shared, a role sees no personal status, finding, title or number', () => {
    for (const role of ['cmo', 'commander', 'ground'] as const) {
      const v = viewFor(role, a, none())
      expect(v.overall).toBe('private')
      expect(v.findings).toHaveLength(0)
      expect(Object.values(v.categories).every((c) => c.status === undefined && c.indicators === undefined)).toBe(true)
    }
    const payload = groundSummary(m.id, crew, 1, a, none())
    expect(payload).not.toMatch(/strain|symptom|rhr|hrv|temp|R-ILL|R-SYM/)
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
    expect(v.categories.cardio.indicators!.some((i) => i.value !== undefined || i.inRange)).toBe(true)
    for (const f of v.findings) {
      expect((f.changes ?? []).every((c) => ['rhr', 'hrv', 'spo2', 'temp', 'sbp', 'temp_oral'].includes(c.ind))).toBe(true)
      expect((f.factors ?? []).every((q) => !['sleep', 'mood', 'symptoms', 'fluid'].includes(q.id))).toBe(true)
    }
    // areas not shared stay closed even though cardio is fully open
    expect(v.categories.sleep.status).toBeUndefined()
    expect(v.categories.symptoms.status).toBeUndefined()
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

describe('emergency consent', () => {
  const e = { key: 'k', mission: m.id, crew, day, values: {}, symptoms: ['chest_pain'], ts: 0 }
  const urgent = analyzeDay(m, crew, an, model, day, [e])
  it('with consent, a red-flag symptom reaches the medical officer and the commander, never the ground', () => {
    const s = none()
    s.emergency = true
    expect(viewFor('cmo', urgent, s).findings.some((f) => f.emergency && f.status === 'urgent' && !!f.action)).toBe(true)
    expect(viewFor('commander', urgent, s).findings.some((f) => f.emergency)).toBe(true)
    expect(viewFor('ground', urgent, s).findings).toHaveLength(0)
  })
  it('without consent, nobody sees it', () => {
    for (const role of ['cmo', 'commander', 'ground'] as const) expect(viewFor(role, urgent, none()).findings).toHaveLength(0)
  })
  it('symptoms marked for the medical officer only are not shown to the commander, unless the patient is the medical officer', () => {
    const share = defaultSharing()
    for (const c of SHARE_CATEGORIES) { share.commander[c] = 'none'; share.cmo[c] = 'none' }
    const run = (crewId: string, symptoms: string[]) => {
      const xx = features(m, crewId, model.indicators, [])
      return analyzeDay(m, crewId, { crewId, x: xx, scored: scorePerson(xx, model, m.phases) }, model, 100, [{ key: 'k', mission: m.id, crew: crewId, day: 100, values: {}, symptoms, ts: 0 }])
    }
    const patient = m.crew.find((c) => c.role !== 'cmo' && c.role !== 'commander')!.id
    const priv = run(patient, ['self_harm'])
    expect(viewFor('cmo', priv, share).findings.some((f) => f.emergency)).toBe(true)
    expect(viewFor('commander', priv, share).findings.length).toBe(0)
    expect(viewFor('ground', priv, share).findings.length).toBe(0)
    // chest pain is shown to both
    expect(viewFor('commander', run(patient, ['chest_pain']), share).findings.some((f) => f.emergency)).toBe(true)
    // a private item together with a non-private one is shown (the commander needs the non-private one)
    expect(viewFor('commander', run(patient, ['self_harm', 'chest_pain']), share).findings.some((f) => f.emergency)).toBe(true)
    // the medical officer as patient: the commander is the backup and sees it
    const cmo = m.crew.find((c) => c.role === 'cmo')!.id
    expect(viewFor('commander', run(cmo, ['self_harm']), share).findings.some((f) => f.emergency)).toBe(true)
    // open items follow the same gate, and the ground never sees them
    expect(visibleOpenItems('cmo', priv.openItems, share, false).length).toBeGreaterThan(0)
    expect(visibleOpenItems('commander', priv.openItems, share, false).length).toBe(0)
    expect(visibleOpenItems('ground', priv.openItems, { ...share, ground: { ...share.ground, symptoms: 'detail' } }, false).length).toBe(0)
    // with emergency sharing off the medical officer sees only that an item is open (so it can be closed), and the commander nothing
    const off = visibleOpenItems('cmo', priv.openItems, { ...share, emergency: false }, false)
    expect(off.length).toBeGreaterThan(0)
    expect(off.every((x) => x.redacted && x.title === 'An item, details private' && !x.readings && !x.symptoms)).toBe(true)
    expect(visibleOpenItems('commander', priv.openItems, { ...share, emergency: false }, false).length).toBe(0)
    // a "today" item in a private area still reaches the medical officer under emergency sharing, without its title
    const fever = run(patient, [])
    const xx = features(m, patient, model.indicators, [])
    const fe = analyzeDay(m, patient, { crewId: patient, x: xx, scored: scorePerson(xx, model, m.phases) }, model, 100, [{ key: 'k', mission: m.id, crew: patient, day: 100, values: { temp_oral: 38.5 }, symptoms: [], ts: 0, readings: [{ ind: 'temp_oral', v: 38.5, ts: 1 }] }])
    const vi = visibleOpenItems('cmo', fe.openItems, share, false)
    expect(vi.some((x) => x.ruleId === 'R-V-TEMP' && !x.redacted)).toBe(true)
    expect(fever.openItems.length).toBe(0)
  })
  it('medication classes and photos are shown only when Symptoms is shared in detail', () => {
    const share = defaultSharing()
    share.cmo.symptoms = 'trend'
    expect(visibleExtras('cmo', share, ['Sleep aid'], [{ ts: 1, label: 'Skin', data: 'x' }])).toEqual({ meds: [], photos: [] })
    share.cmo.symptoms = 'detail'
    expect(visibleExtras('cmo', share, ['Sleep aid'], []).meds).toEqual(['Sleep aid'])
    share.ground.symptoms = 'detail'
    expect(visibleExtras('ground', share, ['Sleep aid'], []).meds).toEqual([])
  })
})
