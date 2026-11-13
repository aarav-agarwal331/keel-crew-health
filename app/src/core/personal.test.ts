import fs from 'node:fs'
import { expect, it } from 'vitest'
import { analyzeDay } from './analysis'
import { scorePerson, type ModelJson } from './detect'
import { parseCsv, toMission } from './importers'
import { features } from './mission'
import type { Entry } from './types'

it('imported personal data sends urgent readings to real care, never to a crew', () => {
  const rows = Array.from({ length: 40 }, (_, i) => `2026-01-${String(1 + (i % 28)).padStart(2, '0')},${60 + (i % 3)}`)
  const m = toMission(parseCsv('date,rhr\n' + [...new Set(rows)].join('\n') + '\n'), 'mine')
  const model = JSON.parse(fs.readFileSync('public/data/model_import.json', 'utf8')) as ModelJson
  const day = m.days - 1
  const e: Entry = { key: 'k', mission: m.id, crew: 'you', day, values: { glucose: 45 }, symptoms: [], ts: 1, readings: [{ ind: 'glucose', v: 45, ts: 1 }] }
  const x = features(m, 'you', model.indicators, [e])
  const a = analyzeDay(m, 'you', { crewId: 'you', x, scored: scorePerson(x, model, m.phases) }, model, day, [e])
  const f = a.findings.find((q) => q.ruleId === 'R-V-GLU-LO2')!
  expect(f).toBeDefined()
  expect(f.action).toMatch(/local emergency number/)
  expect(f.action).not.toMatch(/crewmate|medical officer/)
})
