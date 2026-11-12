/**
 * Crew readiness for a demanding task tomorrow (for example a spacewalk).
 * Rule-based heuristic, not a validated fitness-for-duty test (see the Limitations page).
 * The tier is always visible to the commander; the reasons are only as detailed as the crew
 * member's sharing settings allow.
 */
import type { DayAnalysis } from './analysis'

export type ReadyTier = 'go' | 'caution' | 'hold' | 'unknown'

export interface Readiness {
  tier: ReadyTier
  /** categories that drove the tier (private unless shared) */
  reasons: { category: string; text: string }[]
}

export const READY_LABEL: Record<ReadyTier, string> = {
  go: 'Ready',
  caution: 'Ready with caution',
  hold: 'Talk to the medical officer first',
  unknown: 'Not enough data',
}

export function readiness(a: DayAnalysis): Readiness {
  if (a.learning) return { tier: 'unknown', reasons: [] }
  const reasons: Readiness['reasons'] = []
  let tier: ReadyTier = 'go'
  const bump = (t: ReadyTier) => {
    if (t === 'hold' || (t === 'caution' && tier === 'go')) tier = t
  }
  for (const f of a.findings) {
    if (f.kind === 'environment') continue
    if (f.status === 'urgent' || f.tier !== 'self') {
      bump('hold')
      reasons.push({ category: f.categories[0] ?? 'symptoms', text: f.title })
    } else if (f.status === 'act' || f.status === 'watch') {
      bump('caution')
      reasons.push({ category: f.categories[0] ?? 'cardio', text: f.title })
    }
  }
  if (a.u3.pvt_rt >= 2.5) { bump('hold'); reasons.push({ category: 'cognition', text: 'Reaction time well outside normal' }) }
  else if (a.u3.pvt_rt >= 1.5) { bump('caution'); reasons.push({ category: 'cognition', text: 'Reaction time slower than normal' }) }
  if (a.u3.sleep_h >= 2) { bump('caution'); reasons.push({ category: 'sleep', text: 'Short sleep over the last three nights' }) }
  return { tier, reasons }
}
