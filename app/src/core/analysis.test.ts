import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { alertFields, alertState } from './alerts'
import { analyzeDay, applyRule, closuresFrom, CM, evalCond, REFS, RULE, RULES, type RuleFeatures } from './analysis'
import { scorePerson, type ModelJson } from './detect'
import { features } from './mission'
import { readiness } from './readiness'
import type { Entry, Mission } from './types'

const f = (o: Partial<RuleFeatures> = {}): RuleFeatures => ({ u: {}, sym: {}, env: {}, phaseDays: 99, hasPhase: true, alertDays: 1, patternDays: 1, val: {}, run: () => [], rel: {}, redFlag: false, ...o })
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
    expect(applyRule(RULE['R-SLEEP'], f({ u: { sleep_h: 2 }, patternDays: 2 })).tier).toBe('self')
    expect(applyRule(RULE['R-SLEEP'], f({ u: { sleep_h: 2 }, patternDays: 7 })).tier).toBe('cmo')
    // an alert that has been open for a week for another reason does not escalate a pattern that started today
    expect(applyRule(RULE['R-ILL'], f({ u: { rhr: 2, temp: 1.5 }, alertDays: 7, patternDays: 1 })).tier).toBe('cmo')
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
    // 1.0 degree above the person's own earlier thermometer readings also counts
    const earlier = [70, 76, 82, 88].map((dd) => ({ ...mk({ temp_oral: 36.4 }), key: `k${dd}`, day: dd }))
    expect(run('c0', 100, [...earlier, mk({ temp_oral: 37.5 })]).findings.map((x) => x.ruleId)).toContain('R-V-TEMP')
    expect(run('c0', 100, [...earlier, mk({ temp_oral: 37.0 })]).findings.map((x) => x.ruleId)).not.toContain('R-V-TEMP')
    expect(rule(mk({ temp_oral: 39.6 }))).toContain('R-V-TEMP-HI')
    expect(rule(mk({ spo2_spot: 91 }))).toContain('R-V-SPO2')
    expect(rule(mk({ glucose: 62 }))).toContain('R-V-GLU-LO')
    expect(rule(mk({ glucose: 48 }))).toContain('R-V-GLU-LO2')
    expect(rule(mk({ glucose: 450 }))).toContain('R-V-GLU-HI2')
    expect(rule(mk({ sbp: 84 }))).toContain('R-V-BP-LO')
    expect(rule(mk({ sbp: 72 }))).toContain('R-V-BP-LO2')
    expect(rule(mk({ sbp: 86 }, ['dizziness']))).toContain('R-V-BP-LO2')
    expect(rule(mk({ sbp: 220 }))).toContain('R-V-BP-HI2')
    // severity follows the value: a very high or very low reading is never just "worth a look"
    expect(run('c0', 100, [mk({ sbp: 220 })]).status).not.toBe('watch')
    expect(run('c0', 100, [mk({ glucose: 48 })]).status).toBe('urgent')
    expect(run('c0', 100, [mk({ glucose: 66 })]).status).toBe('act')
    expect(rule(mk({ temp_oral: 36.9, glucose: 92, sbp: 118, spo2_spot: 97 })).filter((r) => r.startsWith('R-V'))).toEqual([])
    expect(rule(mk({}, ['vision']))).toContain('R-VIS')
    const a = run('c0', 100, [mk({ spo2_spot: 91 })])
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
      // urgent, or anything that involves the medical officer, holds; a self-managed "act today" is at least "worth a look"
      if (worst >= 4 || a.findings.some((f) => !f.crewWide && f.tier !== 'self' && ['act', 'urgent'].includes(f.status))) expect(r).toBe('hold')
      if (worst >= 2) expect(['caution', 'hold']).toContain(r)
      // an area flagged on the body map is flagged at least as strongly in the sharing areas
      for (const f2 of a.findings.filter((x) => !x.crewWide && x.changes.length)) expect(worst).toBeGreaterThanOrEqual({ learning: 0, steady: 1, watch: 2, act: 3, urgent: 4 }[f2.status])
    }
  })
  it('a repeat reading never erases an abnormal one: the worst reading of the day counts, and both are kept', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: { glucose: 85 }, symptoms: [], ts: 2, readings: [{ ind: 'glucose', v: 50, ts: 1 }, { ind: 'glucose', v: 85, ts: 1 + 16 * 60 * 1000 }] }
    const a = run('c0', 100, [e])
    const f1 = a.findings.find((x) => x.ruleId === 'R-V-GLU-LO2')!
    expect(f1).toBeDefined()
    // the repeat is back on the safe side: no longer "eat something now", but still open for the medical officer
    expect(a.status).toBe('act')
    expect(f1.action).toMatch(/back on the safe side/)
    expect(a.openItems.some((x) => x.ruleId === 'R-V-GLU-LO2')).toBe(true)
    // a repeat that is still low (60), or a normal one taken too soon (2 minutes), is not "safe"
    const still: Entry = { ...e, readings: [{ ind: 'glucose', v: 50, ts: 1 }, { ind: 'glucose', v: 60, ts: 1 + 16 * 60 * 1000 }] }
    expect(run('c0', 100, [still]).findings.some((x) => /safe side/.test(x.action))).toBe(false)
    const soon: Entry = { ...e, readings: [{ ind: 'glucose', v: 50, ts: 1 }, { ind: 'glucose', v: 85, ts: 1 + 2 * 60 * 1000 }] }
    expect(run('c0', 100, [soon]).status).toBe('urgent')
    // a low that still counts (50, then 85 too soon) comes first, and the fast heart rate is still an act-now item beside it
    const both: Entry = { ...soon, values: { glucose: 85, rhr: 170 }, readings: [...soon.readings!, { ind: 'rhr', v: 170, ts: 3 }] }
    const urgentFirst = run('c0', 100, [both]).findings.filter((x) => x.status === 'urgent')
    expect(urgentFirst.length).toBeGreaterThanOrEqual(2)
    expect(urgentFirst[0].ruleId.startsWith('R-V-GLU-LO')).toBe(true)
    expect(urgentFirst.some((x) => x.ruleId.startsWith('R-V-HR'))).toBe(true)
    // a high repeat after a low is not "treat it as low", and a normal repeat after a high counts at once
    const lowHigh: Entry = { ...e, readings: [{ ind: 'glucose', v: 50, ts: 1 }, { ind: 'glucose', v: 320, ts: 1 + 2 * 60 * 1000 }] }
    const lh = run('c0', 100, [lowHigh]).findings
    expect(lh.find((x) => x.ruleId === 'R-V-GLU-LO2')!.action).toMatch(/take no more sugar/)
    expect(lh.find((x) => x.ruleId === 'R-V-GLU-HI2')!.action).toMatch(/fingertip/)
    const highNormal: Entry = { ...e, readings: [{ ind: 'glucose', v: 320, ts: 1 }, { ind: 'glucose', v: 95, ts: 1 + 60 * 1000 }] }
    const hn = run('c0', 100, [highNormal]).findings.find((x) => x.ruleId === 'R-V-GLU-HI2')!
    expect(hn.action).not.toMatch(/treat it as low/)
    expect(hn.status).toBe('act')
    // a value under 35 saved before the meter unit was known gets conditional advice, not "take sugar now"
    const unk: Entry = { ...e, readings: [{ ind: 'glucose', v: 5.5, ts: 1, unitUnknown: true }] }
    const uf = run('c0', 100, [unk]).findings.find((x) => x.ruleId === 'R-V-GLU-LO2')!
    expect(uf.action).toMatch(/Confirm which unit/)
    expect(uf.action).not.toMatch(/^Take sugar now/)
    // the title names the reading that crossed the line, not the later one
    expect(run('c0', 100, [soon]).findings.find((x) => x.ruleId === 'R-V-GLU-LO2')!.title).toMatch(/50, then 85; the 50 still counts/)
    expect(f1.readings!.map((r) => r.v)).toEqual([50, 85])
    // the next day, with no new reading, it is still open and dated from the reading
    const b = run('c0', 101, [e]).findings.find((x) => x.ruleId === 'R-V-GLU-LO2')!
    expect(b.start).toBe(100)
    expect(b.days).toBe(2)
    // a new day's normal reading replaces the readings in force, but the item stays on the medical officer's list
    const next: Entry = { key: 'k2', mission: m.id, crew: 'c0', day: 101, values: { glucose: 90 }, symptoms: [], ts: 3 }
    const c = run('c0', 101, [e, next])
    expect(c.findings.some((x) => x.ruleId === 'R-V-GLU-LO2')).toBe(false)
    expect(c.openItems.some((x) => x.ruleId === 'R-V-GLU-LO2' && x.day === 100)).toBe(true)
  })
  it('extreme readings and the added fixed rules fire', () => {
    const mk = (values: Record<string, number>, symptoms: string[] = []): Entry => ({ key: 'k', mission: m.id, crew: 'c0', day: 100, values, symptoms, ts: 0 })
    const rule = (e: Entry) => run('c0', 100, [e]).findings.map((x) => x.ruleId)
    expect(rule(mk({ rhr_spot: 170 }))).toContain('R-V-HR2')
    expect(run('c0', 100, [mk({ rhr_spot: 170 })]).status).toBe('urgent')
    expect(rule(mk({ rhr_spot: 128 }))).toContain('R-V-HR1')
    expect(rule(mk({ sbp: 150, dbp: 125 }))).toContain('R-V-BP-HI2')
    expect(rule(mk({ sbp: 128, dbp: 94 }))).toContain('R-V-BP-HI')
    expect(rule(mk({ sbp: 45 }))).toContain('R-V-BP-LO2')
    expect(rule(mk({ glucose: 20 }))).toContain('R-V-GLU-LO2')
    expect(rule(mk({ spo2_spot: 62 }))).toContain('R-V-SPO2')
  })
  it('the medical officer as patient is sent to the commander, never to themself', () => {
    const cmo = m.crew.find((c) => c.role === 'cmo')!
    const e: Entry = { key: 'k', mission: m.id, crew: cmo.id, day: 100, values: { temp_oral: 38.6 }, symptoms: [], ts: 0 }
    const f1 = run(cmo.id, 100, [e]).findings.find((x) => x.ruleId === 'R-V-TEMP')!
    expect(f1.action).toMatch(/commander/)
    expect(`${f1.action} ${f1.steps.join(' ')}`).not.toMatch(/[Tt]ell the medical officer|see the medical officer/)
  })
  it('exercise is never advised beside an open fever or illness finding', () => {
    for (const c of m.crew) for (let d = m.pre_days; d < m.days; d++) {
      const a = run(c.id, d, [{ key: 'k', mission: m.id, crew: c.id, day: d, values: { temp_oral: 38.5 }, symptoms: [], ts: 0 }])
      const texts = a.findings.flatMap((x) => [x.ruleId, ...(x.also ?? []).map((q) => q.title)])
      expect(texts.includes('R-EX') || texts.includes('Exercise has dropped below your plan')).toBe(false)
      if (d > m.pre_days + 40) break
    }
  })
  it('an urgent reading colours its body and sharing areas, holds exercise, and leaves Today once closed', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: { glucose: 50, rhr_spot: 170 }, symptoms: [], ts: 0 }
    const a = run('c0', 100, [e])
    expect(a.systems.gut).toBe('urgent')
    expect(a.categories.nutrition).toBe('urgent')
    expect(a.systems.heart).toBe('urgent')
    expect(a.exerciseHold).toBe(true)
    expect(a.findings.filter((x) => x.ruleId.startsWith('R-V-HR')).length).toBe(1)
    const x = features(m, 'c0', model.indicators, [e])
    const closed = new Map([[`open|${m.id}|c0|R-V-GLU-LO2|100`, 10]])
    const b = analyzeDay(m, 'c0', { crewId: 'c0', x, scored: scorePerson(x, model, m.phases) }, model, 100, [e], closed)
    expect(b.findings.some((q) => q.ruleId === 'R-V-GLU-LO2')).toBe(false)
    expect(b.findings.some((q) => q.ruleId === 'R-V-HR2')).toBe(true)
    // a new abnormal reading written after the closure note reopens it
    const e2: Entry = { ...e, readings: [{ ind: 'glucose', v: 50, ts: 5 }, { ind: 'glucose', v: 45, ts: 20 }] }
    const x2 = features(m, 'c0', model.indicators, [e2])
    const c2 = analyzeDay(m, 'c0', { crewId: 'c0', x: x2, scored: scorePerson(x2, model, m.phases) }, model, 100, [e2], closed)
    expect(c2.findings.some((q) => q.ruleId === 'R-V-GLU-LO2')).toBe(true)
    expect(c2.openItems.some((q) => q.ruleId === 'R-V-GLU-LO2')).toBe(true)
    // a reading withdrawn as a typing mistake is not used
    const w: Entry = { ...e, values: {}, readings: [{ ind: 'glucose', v: 50, ts: 1, void: true }] }
    expect(run('c0', 100, [w]).findings.some((q) => q.ruleId === 'R-V-GLU-LO2')).toBe(false)
    // an urgent reading from an earlier day waits for the medical officer: "act today", still listed for them
    const later = run('c0', 101, [e]).findings.find((q) => q.ruleId === 'R-V-GLU-LO2')!
    expect(later.status).toBe('act')
    expect(later.action).toMatch(/waits for the medical officer/)
    expect(run('c0', 101, [e]).openItems.some((q) => q.ruleId === 'R-V-GLU-LO2')).toBe(true)
  })
  it('a safe repeat of a non-sugar reading never talks about sugar, and needs its own waiting time', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: {}, symptoms: [], ts: 0, readings: [{ ind: 'temp_oral', v: 39.8, ts: 1 }, { ind: 'temp_oral', v: 36.9, ts: 1 + 40 * 60 * 1000 }] }
    const f1 = run('c0', 100, [e]).findings.find((x) => x.ruleId === 'R-V-TEMP-HI')!
    expect(f1.action).not.toMatch(/sugar/)
    expect(f1.action).toMatch(/back on the safe side of this line/)
    const hr: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: {}, symptoms: [], ts: 0, readings: [{ ind: 'rhr_spot', v: 170, ts: 1 }, { ind: 'rhr_spot', v: 72, ts: 1 + 20 * 1000 }] }
    expect(run('c0', 100, [hr]).status).toBe('urgent')
  })
  it('the repeat clock starts at the first abnormal reading, not an earlier normal one', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: {}, symptoms: [], ts: 0, readings: [{ ind: 'glucose', v: 92, ts: 1 }, { ind: 'glucose', v: 50, ts: 8 * 3600e3 }, { ind: 'glucose', v: 85, ts: 8 * 3600e3 + 60e3 }] }
    const a = run('c0', 100, [e])
    expect(a.status).toBe('urgent')
    expect(a.findings.find((x) => x.ruleId === 'R-V-GLU-LO2')!.action).not.toMatch(/safe side/)
    expect(a.openItems.find((x) => x.ruleId === 'R-V-GLU-LO2')!.settled).toBeFalsy()
  })
  it('every fixed "act now" rule holds exercise', () => {
    for (const vals of [{ sbp: 230 }, { glucose: 350 }, { rhr_spot: 170 }, { spo2_spot: 88 }]) {
      const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: vals, symptoms: [], ts: 0, readings: Object.entries(vals).flatMap(([k, v]) => [{ ind: k, v, ts: 1 }, { ind: k, v, ts: 2 }]) }
      expect(run('c0', 100, [e]).exerciseHold, JSON.stringify(vals)).toBe(true)
    }
  })
  it('every "act now" action starts by getting a crewmate', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: { glucose: 45 }, symptoms: [], ts: 0 }
    for (const f of run('c0', 100, [e]).findings.filter((x) => x.status === 'urgent' && !x.crewWide)) expect(f.action).toMatch(/crewmate to you/)
  })
  it('a red flag unticked later stays on the medical officer list', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: {}, symptoms: [], redFlags: ['chest_pain'], ts: 0 }
    expect(run('c0', 100, [e]).openItems.some((x) => x.ruleId === 'R-RED')).toBe(true)
  })
  it('a run of days that met a "today" rule stays on the medical officer list after the run ends', () => {
    const es: Entry[] = [1, 1, 1, 4, 4].map((v, i) => ({ key: `k${i}`, mission: m.id, crew: 'c0', day: 100 + i, values: { mood: v }, symptoms: [], ts: 0 }))
    // the rule first holds on the third low day
    expect(run('c0', 102, es.slice(0, 3)).openItems.some((x) => x.ruleId === 'R-V-MOOD' && x.day === 102)).toBe(true)
    expect(run('c0', 104, es).openItems.some((x) => x.ruleId === 'R-V-MOOD' && x.day === 102)).toBe(true)
    expect(run('c0', 104, es).findings.some((x) => x.ruleId === 'R-V-MOOD')).toBe(false)
  })
  it('"handled, not cleared" holds exercise and the commander\'s tier until the medical officer clears the person', () => {
    const x = features(m, 'c0', model.indicators, [])
    const an = (closed: Map<string, number>, d = 110) => analyzeDay(m, 'c0', { crewId: 'c0', x, scored: scorePerson(x, model, m.phases) }, model, d, [], closed)
    const notCleared = closuresFrom([{ did: 'Closed by the medical officer: handled, not cleared for exercise or duties', alertKey: `${m.id}|c0|P|90#act#90`, ts: 5, crew: 'c0', mission: m.id }])
    const a = an(notCleared)
    expect(a.restricted).toBe(true)
    expect(a.exerciseHold).toBe(true)
    expect(readiness(a).tier).toBe('hold')
    const cleared = closuresFrom([{ did: 'Closed by the medical officer: handled, not cleared for exercise or duties', alertKey: `${m.id}|c0|P|90#act#90`, ts: 5, crew: 'c0', mission: m.id },
      { did: 'Cleared for exercise and duties by the medical officer', alertKey: 'clear|c0', ts: 6, crew: 'c0', mission: m.id }])
    expect(an(cleared).restricted).toBe(false)
  })
  it('an item stays alerted and acknowledged when the set of urgent items changes', () => {
    const acts = [{ crew: 'c0', did: 'Alerted the crew', alertKey: 'alert|a|1+b|2', ts: 1, note: '' }, { crew: 'c0', did: 'Acknowledged the alert', alertKey: 'alert|a|1+b|2', ts: 2, note: 'by the medical officer' }]
    expect(alertState(acts, 'c0', ['b|2']).sent).toBeDefined()
    expect(alertState(acts, 'c0', ['b|2']).acks).toHaveLength(1)
    expect(alertState(acts, 'c0', ['b|2', 'c|3']).sent).toBeUndefined()
  })
  it('an alert about a "medical officer only" item carries nothing the commander may not see', () => {
    const f = alertFields([{ title: 'Serious symptom', cmoOnly: true }, { title: 'Heart rate 150 or more' }])
    expect(f.cmoOnly).toBe(false)
    expect(f.cmdNote).not.toContain('Serious symptom')
    expect(alertFields([{ title: 'Serious symptom', cmoOnly: true }]).cmoOnly).toBe(true)
    expect(alertFields([{ title: 'Serious symptom', cmoOnly: true, patientIsCmo: true }]).cmoOnly).toBe(false)
    // context about a non-urgent notice goes to the medical officer's copy only
    const ctx = alertFields([{ title: 'Heart rate 150 or more' }], ' (sent automatically)', ' (also open, shown to the medical officer only: "notice")')
    expect(ctx.note).toContain('also open')
    expect(ctx.cmdNote).not.toContain('also open')
  })
  it('"outside your usual range" uses the band the charts draw', () => {
    for (const c of m.crew) for (let d = m.pre_days + 20; d < m.days; d += 7) for (const ch of run(c.id, d).changes) {
      if (ch.daysOut > 0) expect(ch.latestInside).toBe(false)
      if (ch.daysOut > 0 && !Number.isNaN(ch.value)) {
        const j = model.indicators.indexOf(ch.ind)
        const inBand = ch.value >= Math.min(ch.lo, ch.hi) && ch.value <= Math.max(ch.lo, ch.hi)
        if (j >= 0 && model.concern[j] !== 0) expect(inBand).toBe(false)
      }
    }
  })
  it('a closed item stays closed after a later, unrelated save the same day', () => {
    const e: Entry = { key: 'k', mission: m.id, crew: 'c0', day: 100, values: { fluid: 2 }, symptoms: [], redFlags: ['chest_pain'], symTs: { chest_pain: 5 }, ts: 50 }
    const x = features(m, 'c0', model.indicators, [e])
    const closed = new Map([[`open|${m.id}|c0|R-RED|100`, 10]])
    const a = analyzeDay(m, 'c0', { crewId: 'c0', x, scored: scorePerson(x, model, m.phases) }, model, 100, [e], closed)
    expect(a.openItems.some((q) => q.ruleId === 'R-RED')).toBe(false)
    // a newly ticked red flag after the note reopens it
    const e2: Entry = { ...e, symTs: { chest_pain: 20 } }
    const b = analyzeDay(m, 'c0', { crewId: 'c0', x, scored: scorePerson(x, model, m.phases) }, model, 100, [e2], closed)
    expect(b.openItems.some((q) => q.ruleId === 'R-RED')).toBe(true)
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
