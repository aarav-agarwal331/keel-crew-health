/**
 * Crew readiness for a demanding task tomorrow (for example a spacewalk).
 * Rule-based heuristic, not a validated fitness-for-duty test and not a medical clearance.
 * It can never be better than what the crew member's own screens show: anything urgent, or any item that
 * involves the medical officer, means "talk to the medical officer first"; a self-managed "act today" item or
 * an area at "worth a look" means "worth a look".
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

/** Whether the commander is told, without content, that an item has waited more than a day for the medical
 *  officer.  Not while an urgent item is open (the commander is already sent to them), and never for the
 *  medical officer's own items (the commander sees those as their backup). */
export function overdueForCommander(a: DayAnalysis, day: number, patientIsCmo: boolean): boolean {
  if (patientIsCmo || a.findings.some((f) => f.status === 'urgent' && !f.crewWide)) return false
  return (a.openItems ?? []).some((x) => !x.settled && x.urgency === 'today' && day - x.day >= 1)
    || a.findings.some((f) => !f.crewWide && f.kind === 'personal' && f.status === 'act' && f.tier !== 'self' && f.days > 1)
}

export function readiness(a: DayAnalysis): Readiness {
  const reasons: Readiness['reasons'] = []
  // the medical officer's "not cleared" and any open safety item outrank everything, including missing data
  const restrictedHold = !!a.restricted
  const openNow = (a.openItems ?? []).some((x) => !x.settled)
  if (a.learning || a.staleDays >= 2) {
    if (restrictedHold || openNow) return { tier: 'hold', reasons: [{ category: 'private', text: restrictedHold ? 'Not yet cleared by the medical officer' : 'A safety item is still open with the medical officer' }] }
    return { tier: 'unknown', reasons: [] }
  }
  let tier: ReadyTier = 'go'
  const bump = (t: ReadyTier) => {
    if (t === 'hold' || (t === 'caution' && tier === 'go')) tier = t
  }
  if (restrictedHold) { tier = 'hold'; reasons.push({ category: 'private', text: 'Not yet cleared by the medical officer' }) }
  // an act-now item, even one withdrawn as a typing mistake, holds until the medical officer closes it
  if ((a.openItems ?? []).some((x) => x.urgency === 'now' && !x.settled)) { bump('hold'); reasons.push({ category: 'private', text: 'An urgent item is still open with the medical officer' }) }
  for (const f of a.findings) {
    // a serious symptom (shown to the medical officer only) still puts the tier on hold (nobody goes on a spacewalk with it),
    // but its reason is filed under a private label so the commander never sees what it is
    if (f.cmoOnly && !f.patientIsCmo) { bump('hold'); reasons.push({ category: 'private', text: 'A private matter for the medical officer' }); continue }
    if (f.crewWide) continue
    // a self-managed item (a late night, a missed session) is worth a look, not a reason to stop someone working
    // three short nights before a demanding task is a conversation, whoever manages it
    if (f.status === 'urgent' || (f.tier !== 'self' && f.status === 'act') || f.ruleId === 'R-V-SLEEP') bump('hold')
    else bump('caution')
    reasons.push({ category: f.categories[0] ?? 'symptoms', text: f.title })
  }
  for (const [cat, st] of Object.entries(a.categories)) {
    if (cat === 'environment') continue
    if (st === 'urgent') bump('hold')
    else if (st === 'act') bump('caution')
    else if (st === 'watch') { bump('caution'); if (!reasons.some((r) => r.category === cat)) reasons.push({ category: cat, text: cat === 'symptoms' ? 'Symptoms reported on more than one day' : 'A reading outside the usual range' }) }
  }
  // nausea or vomiting before suited work, and clearly slowed reactions, always need a conversation
  if ((a.features.sym.nausea ?? 0) > 0 || (a.features.sym.vomiting ?? 0) > 0) { bump('hold'); reasons.push({ category: 'symptoms', text: 'Nausea or vomiting reported' }) }
  if (a.u3.pvt_rt >= 2.5) { bump('hold'); reasons.push({ category: 'cognition', text: 'Reaction time well outside normal' }) }
  return { tier, reasons }
}
