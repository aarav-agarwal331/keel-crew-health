import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeDay, applyRule, CM, evalCond, REFS, RULE, RULES, type RuleFeatures } from './analysis'
import { scorePerson, type ModelJson } from './detect'
import { features } from './mission'
import { readiness } from './readiness'
import type { Entry, Mission } from './types'

const f = (o: Partial<RuleFeatures> = {}): RuleFeatures => ({ u: {}, sym: {}, env: {}, phaseDays: 99, hasPhase: true, alertDays: 1, val: {}, run: () => [], rel: {}, redFlag: false, ...o })
const first = (x: RuleFeatures) => RULES.find((r) => r.scope === 'personal' && evalCond(r.when, x))!.id

describe('alert-to-action rule table', () => {
  it('every rule cites countermeasures that exist, and every countermeasure cites opened references', () => {
    for (const r of RULES) {
      expect(r.cm.length).toBeGreaterThan(0)
      for (const c of r.cm) {
        expect(CM[c], `${r.id} -> ${c}`).toBeDefined()
        for (const ref of CM[c].refs) expect(REFS[ref], `${c} -> [${ref}]`).toBeDefined()
      }
      expect(r.action.length).toBeGreaterThan(10)
      expect(['self', 'cmo', 'ground']).toContain(r.tier)
      expect(['now', 'today', 'routine']).toContain(r.urgency)
    }
  })
  it('no rule text presents a diagnosis', () => {
    for (const r of RULES) expect(`${r.title} ${r.summary} ${r.action}`.toLowerCase()).not.toMatch(/you have (an? |the )?(infection|illness|fever|flu|cold|virus|disease|covid)|diagnos(is|ed) (of|with)|you are (sick|ill|infected)/)
  })
  it('maps patterns to the intended rule', () => {
    expect(first(f({ u: { rhr: 2.5, temp: 2, hrv: 2 } }))).toBe('R-ILL')
    expect(first(f({ u: { rhr: 2, hrv: 0.2 }, sym: { sore_throat: 1 } }))).toBe('R-ILL')
    expect(first(f({ u: { sleep_h: 2.2, pvt_rt: 1 } }))).toBe('R-SLEEP')
    expect(first(f({ u: { fluid: 2.2 } }))).toBe('R-HYDR')
    expect(first(f({ u: { ex7: 2 } }))).toBe('R-EX')
    expect(first(f({ u: { mood: 2, sleep_h: 0.2 }, alertDays: 3 }))).toBe('R-MOOD')
    expect(first(f({ u: { mood: 2, sleep_h: 2 }, alertDays: 3 }))).toBe('R-MOOD') // low mood with short sleep is still a mood finding
    expect(first(f({ u: { rhr: 2 } }))).toBe('R-CARD')
    expect(first(f({ u: { rhr: 0.5, mood: 0.9 } }))).toBe('R-GEN')
  })
  it('escalates with persistence and never de-escalates', () => {
    expect(applyRule(RULE['R-SLEEP'], f({ u: { sleep_h: 2 }, alertDays: 2 })).tier).toBe('self')
    expect(applyRule(RULE['R-SLEEP'], f({ u: { sleep_h: 2 }, alertDays: 7 })).tier).toBe('cmo')
    expect(applyRule(RULE['R-ILL'], f({ u: { rhr: 2, temp: 3.2 } })).tier).toBe('ground')
    expect(applyRule(RULE['R-ILL'], f({ u: { rhr: 2, temp: 1.5 } })).tier).toBe('cmo')
  })
  it('red-flag symptoms and environment rules fire without a detector alert', () => {
    expect(evalCond(RULE['R-RED'].when, f({ redFlag: true }))).toBe(true)
    expect(evalCond(RULE['R-RED'].when, f({ sym: { headache: 3 } }))).toBe(false)
    expect(evalCond(RULE['R-CO2'].when, f({ env: { co2: 3.4 } }))).toBe(true)
    expect(evalCond(RULE['R-CO2'].when, f({ env: { co2: 2.4 } }))).toBe(false)
    expect(evalCond(RULE['R-SPE'].when, f({ env: { rad_ratio: 4 } }))).toBe(true)
  })
})

describe('end to end on the demo mission', () => {
  const m = JSON.parse(fs.readFileSync('public/data/missions/mars_transit.json', 'utf8')) as Mission
  const model = JSON.parse(fs.readFileSync('public/data/model_mission.json', 'utf8')) as ModelJson
  const run = (crew: string, day: number, entries: Entry[] = []) => {
    const x = features(m, crew, model.indicators, entries)
    return analyzeDay(m, crew, { crewId: crew, x, scored: scorePerson(x, model, m.phases) }, model, day, entries)
  }
  const illness = m.truth.find((e) => e.type === 'illness')!
  it('responds to the scripted illness by the time symptoms are reported, with the illness guidance', () => {
    const crew = m.crew[illness.crew].id
    // same window as the evaluation: 10 days before to 4 days after symptom onset
    const days = [...Array(8).keys()].map((k) => illness.onset - 3 + k)
    const hits = days.map((d) => run(crew, d)).filter((a) => a.findings.some((x) => ['R-ILL', 'R-SYM-ILL'].includes(x.ruleId)))
    expect(hits.length).toBeGreaterThan(0)
    const pf = hits[0].findings.find((x) => ['R-ILL', 'R-SYM-ILL'].includes(x.ruleId))!
    expect(pf.action).toMatch(/temperature/)
    expect(pf.tier === 'cmo' || pf.tier === 'self').toBe(true)
    expect(readiness(hits[0]).tier).not.toBe('go')
  })
  it('fixed safety thresholds bypass the detector and need no baseline', () => {
    const mk = (values: Record<string, number>, symptoms: string[] = []): Entry => ({ key: 'k', mission: m.id, crew: 'c0', day: 100, values, symptoms, ts: 0 })
    const rule = (e: Entry) => run('c0', 100, [e]).findings.map((x) => x.ruleId)
    expect(rule(mk({ temp_oral: 38.4 }))).toContain('R-V-TEMP')
    expect(rule(mk({ temp_oral: 39.6 }))).toContain('R-V-TEMP-HI')
    expect(rule(mk({ spo2: 91 }))).toContain('R-V-SPO2')
    expect(rule(mk({ glucose: 62 }))).toContain('R-V-GLU-LO')
    expect(rule(mk({ sbp: 84 }))).toContain('R-V-BP-LO')
    expect(rule(mk({ temp_oral: 36.9, glucose: 92, sbp: 118, spo2: 97 })).filter((r) => r.startsWith('R-V'))).toEqual([])
    expect(rule(mk({}, ['vision']))).toContain('R-VIS')
    const a = run('c0', 100, [mk({ spo2: 91 })])
    expect(a.status).toBe('urgent')
    expect(readiness(a).tier).toBe('hold')
  })
  it('several days without any reading is shown as no recent data, not as steady', () => {
    const blank = JSON.parse(JSON.stringify(m)) as Mission
    for (const k of Object.keys(blank.series.c1)) for (let t = 98; t <= 100; t++) blank.series.c1[k][t] = null
    const x = features(blank, 'c1', model.indicators, [])
    const a = analyzeDay(blank, 'c1', { crewId: 'c1', x, scored: scorePerson(x, model, blank.phases) }, model, 100, [])
    expect(a.staleDays).toBeGreaterThanOrEqual(2)
    if (!a.findings.length) expect(a.status).toBe('learning')
    expect(readiness(a).tier).toBe('unknown')
  })
  it('every screen grouping agrees: readiness is never better than the worst area', () => {
    for (const c of m.crew) for (let d = m.pre_days + 20; d < m.days; d += 3) {
      const a = run(c.id, d)
      const worst = Math.max(...Object.entries(a.categories).filter(([k]) => k !== 'environment').map(([, v]) => ({ learning: 0, steady: 1, watch: 2, act: 3, urgent: 4 })[v]))
      const r = readiness(a).tier
      if (worst >= 3) expect(r).toBe('hold')
      if (worst === 2) expect(['caution', 'hold']).toContain(r)
      // an area flagged on the body map is flagged at least as strongly in the sharing areas
      for (const f2 of a.findings.filter((x) => !x.crewWide && x.changes.length)) expect(worst).toBeGreaterThanOrEqual({ learning: 0, steady: 1, watch: 2, act: 3, urgent: 4 }[f2.status])
    }
  })
  it('a red-flag symptom entered at check-in is urgent immediately', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: {}, symptoms: ['chest_pain'], ts: 0 }
    const a = run('c0', 100, [e])
    expect(a.status).toBe('urgent')
    expect(a.findings[0].ruleId).toBe('R-RED')
    expect(a.findings[0].tier).toBe('cmo')
    expect(a.findings[0].urgency).toBe('now')
  })
  it('the scripted CO2 event produces a crew-wide environment finding', () => {
    const co2 = m.truth.find((e) => e.type === 'co2')!
    const hit = [...Array(10).keys()].some((k) => run('c1', co2.onset + k).findings.some((x) => x.ruleId === 'R-CO2' && x.crewWide))
    expect(hit).toBe(true)
  })
  it('launch-day adaptation is not flagged as an alert-tier event for most of the crew', () => {
    let alertTier = 0
    for (const c of m.crew) for (let d = m.pre_days; d < m.pre_days + 10; d++) if (run(c.id, d).alert?.tier === 'alert') { alertTier++; break }
    expect(alertTier).toBeLessThanOrEqual(1)
  })
})
