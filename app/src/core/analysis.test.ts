import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeDay, applyRule, CM, evalCond, REFS, RULE, RULES, type RuleFeatures } from './analysis'
import { scorePerson, type ModelJson } from './detect'
import { features } from './mission'
import { readiness } from './readiness'
import type { Entry, Mission } from './types'

const f = (o: Partial<RuleFeatures> = {}): RuleFeatures => ({ u: {}, sym: {}, env: {}, phaseDays: 99, hasPhase: true, alertDays: 1, ...o })
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
    }
  })
  it('no rule text presents a diagnosis', () => {
    for (const r of RULES) expect(`${r.title} ${r.summary} ${r.action}`.toLowerCase()).not.toMatch(/you have|diagnos(is|ed) of|you are (sick|ill|infected)/)
  })
  it('maps patterns to the intended rule', () => {
    expect(first(f({ u: { rhr: 2.5, temp: 2, hrv: 2 } }))).toBe('R-ILL')
    expect(first(f({ u: { rhr: 2, hrv: 0.2 }, sym: { sore_throat: 1 } }))).toBe('R-ILL')
    expect(first(f({ u: { sleep_h: 2.2, pvt_rt: 1 } }))).toBe('R-SLEEP')
    expect(first(f({ u: { fluid: 2.2 } }))).toBe('R-HYDR')
    expect(first(f({ u: { ex7: 2 } }))).toBe('R-EX')
    expect(first(f({ u: { mood: 2, sleep_h: 0.2 }, alertDays: 3 }))).toBe('R-MOOD')
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
    expect(evalCond(RULE['R-RED'].when, f({ sym: { chest_pain: 1 } }))).toBe(true)
    expect(evalCond(RULE['R-CO2'].when, f({ env: { co2_3d: 3.4 } }))).toBe(true)
    expect(evalCond(RULE['R-CO2'].when, f({ env: { co2_3d: 2.4 } }))).toBe(false)
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
  it('flags the scripted illness inside the detection window and maps it to the illness-pattern rule', () => {
    const crew = m.crew[illness.crew].id
    // same window as the evaluation: 10 days before to 4 days after symptom onset
    const days = [...Array(15).keys()].map((k) => illness.onset - 10 + k)
    const hits = days.filter((d) => run(crew, d).findings.some((x) => x.kind === 'personal'))
    expect(hits.length).toBeGreaterThan(0)
    const a = run(crew, illness.onset + 3)
    const pf = a.findings.find((x) => x.kind === 'personal')!
    expect(pf.ruleId).toBe('R-ILL')
    expect(pf.changes.map((c) => c.ind)).toContain('rhr')
    expect(readiness(a).tier).not.toBe('go')
  })
  it('a red-flag symptom entered at check-in is urgent immediately', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: {}, symptoms: ['chest_pain'], ts: 0 }
    const a = run('c0', 100, [e])
    expect(a.status).toBe('urgent')
    expect(a.findings[0].ruleId).toBe('R-RED')
    expect(a.findings[0].tier).toBe('ground')
  })
  it('the scripted CO2 event produces a crew-wide environment finding', () => {
    const co2 = m.truth.find((e) => e.type === 'co2')!
    const a = run('c1', co2.onset + 5)
    expect(a.findings.some((x) => x.ruleId === 'R-CO2' && x.crewWide)).toBe(true)
  })
  it('launch-day adaptation is not flagged as an alert-tier event for most of the crew', () => {
    let alertTier = 0
    for (const c of m.crew) for (let d = m.pre_days; d < m.pre_days + 10; d++) if (run(c.id, d).alert?.tier === 'alert') { alertTier++; break }
    expect(alertTier).toBeLessThanOrEqual(1)
  })
})
