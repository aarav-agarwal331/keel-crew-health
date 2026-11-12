import { describe, expect, it } from 'vitest'
import parity from '../../../shared/parity.json'
import { scorePerson, type ModelJson, type PhaseJson } from './detect'

const nan = (m: (number | null)[][]) => m.map((r) => r.map((v) => (v === null ? NaN : v)))
const close = (a: number, b: number | null, tol = 1e-6) => (b === null ? Number.isNaN(a) : Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)))

describe('TypeScript detector reproduces the Python reference', () => {
  const model = parity.model as unknown as ModelJson
  parity.cases.forEach((c, ci) => {
    const out = scorePerson(nan(c.x as (number | null)[][]), model, c.phases as PhaseJson[])
    it(`person ${ci}: baseline, scale and z match`, () => {
      let bad = 0
      for (let t = 0; t < c.z.length; t++)
        for (let j = 0; j < c.z[t].length; j++) {
          if (!close(out.z[t][j], c.z[t][j] as number | null)) bad++
          if (!close(out.m[t][j], c.m[t][j] as number | null)) bad++
          if (!close(out.s[t][j], c.s[t][j] as number | null)) bad++
        }
      expect(bad).toBe(0)
    })
    for (const k of ['fixed', 'zscore', 'cusum', 'mewma', 'fusion'] as const) {
      it(`person ${ci}: ${k} score matches`, () => {
        const ref = c.scores[k] as (number | null)[]
        const bad = ref.filter((v, t) => !close(out.scores[k][t], v)).length
        expect(bad).toBe(0)
      })
    }
  })
})
