/**
 * Crew readiness for a demanding task tomorrow (for example a spacewalk).
 * Rule-based heuristic, not a validated fitness-for-duty test and not a medical clearance.
 * It can never be better than what the crew member's own screens show: any area at "act"
 * means "talk to the medical officer first", any area at "worth a look" means "minor flags".
 * The tier is always visible to the commander; the reasons only where the crew member shares them.
 */
import type { DayAnalysis } from './analysis'

export type ReadyTier = 'go' | 'caution' | 'hold' | 'unknown'

export interface Readiness {
  tier: ReadyTier
  /** areas that drove the tier (private unless shared) */
  reasons: { category: string; text: string }[]
}

export const READY_LABEL: Record<ReadyTier, string> = {
  go: 'Steady',
  caution: 'Worth a look',
  hold: 'Talk to the medical officer first',
  unknown: 'Not enough recent data',
}

export function readiness(a: DayAnalysis): Readiness {
  if (a.learning || a.staleDays >= 2) return { tier: 'unknown', reasons: [] }
  const reasons: Readiness['reasons'] = []
  let tier: ReadyTier = 'go'
  const bump = (t: ReadyTier) => {
    if (t === 'hold' || (t === 'caution' && tier === 'go')) tier = t
  }
  for (const f of a.findings) {
    // a symptom marked "medical officer only" must not be readable from the commander's tier
    if (f.cmoOnly && !f.patientIsCmo) continue
    if (f.crewWide) continue
    if (f.status === 'urgent' || f.status === 'act' || f.tier !== 'self') bump('hold')
    else bump('caution')
    reasons.push({ category: f.categories[0] ?? 'symptoms', text: f.title })
  }
  for (const [cat, st] of Object.entries(a.categories)) {
    if (cat === 'environment') continue
    if (st === 'act' || st === 'urgent') bump('hold')
    else if (st === 'watch') { bump('caution'); if (!reasons.some((r) => r.category === cat)) reasons.push({ category: cat, text: cat === 'symptoms' ? 'Symptoms reported on more than one day' : 'A reading outside the usual range' }) }
  }
  // nausea or vomiting before suited work, and clearly slowed reactions, always need a conversation
  if ((a.features.sym.nausea ?? 0) > 0 || (a.features.sym.vomiting ?? 0) > 0) { bump('hold'); reasons.push({ category: 'symptoms', text: 'Nausea or vomiting reported' }) }
  if (a.u3.pvt_rt >= 2.5) { bump('hold'); reasons.push({ category: 'cognition', text: 'Reaction time well outside normal' }) }
  return { tier, reasons }
}
