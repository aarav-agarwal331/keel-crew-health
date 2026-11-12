import { inverseTransform, personalBaseline, type Params } from '../core/detect'
import { IND, rawSeries } from '../core/mission'
import type { CrewAnalysis, Entry, Mission } from '../core/types'
import type { ModelJson } from '../core/detect'

export interface Band { values: number[]; expected: number[]; lo: number[]; hi: number[]; hasBand: boolean }

/** A person's readings for one indicator with their own usual range (expected ± 2 robust SD). */
export function bandFor(m: Mission, model: ModelJson, an: CrewAnalysis | undefined, crewId: string, ind: string, entries: Entry[]): Band {
  const values = rawSeries(m, crewId, ind, entries)
  const j = model.indicators.indexOf(ind)
  if (an && j >= 0) {
    const tr = model.transform[j]
    const expected = an.scored.m.map((r) => inverseTransform(r[j], tr))
    const lo = an.scored.m.map((r, t) => inverseTransform(r[j] - 2 * an.scored.s[t][j], tr))
    const hi = an.scored.m.map((r, t) => inverseTransform(r[j] + 2 * an.scored.s[t][j], tr))
    return { values, expected, lo, hi, hasBand: true }
  }
  if (ind === 'co2' || ind === 'rad') return { values, expected: [], lo: [], hi: [], hasBand: false }
  // spot measurements (weekly): a longer window, fewer points needed
  const p: Params = { ...model.params, window: 120, gap: 1, min_n: 4 }
  const { m: mm, s } = personalBaseline(values, IND[ind]?.floor ?? 1, p)
  return { values, expected: mm, lo: mm.map((v, t) => v - 2 * s[t]), hi: mm.map((v, t) => v + 2 * s[t]), hasBand: true }
}
