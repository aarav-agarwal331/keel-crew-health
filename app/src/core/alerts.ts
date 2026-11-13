/** What an alert carries.  Items marked "medical officer only" never reach the commander: not their title,
 *  and when every item is such an item, not the alert at all. */
export function alertFields(urgent: { title: string; cmoOnly?: boolean; patientIsCmo?: boolean }[], suffix = '') {
  const priv = (x: (typeof urgent)[number]) => !!x.cmoOnly && !x.patientIsCmo
  return {
    note: urgent.map((x) => x.title).join('; ') + suffix,
    cmoOnly: urgent.length > 0 && urgent.every(priv),
    cmdNote: urgent.filter((x) => !priv(x)).map((x) => x.title).join('; ') + suffix,
  }
}

/** Alerts are keyed by the urgent items they were about.  An item counts as alerted (and acknowledged)
 *  if any alert covered it, so a later change in the set of urgent items does not undo either. */
export const covers = (alertKey: string, findingKey: string) => alertKey.startsWith('alert|') && alertKey.slice(6).split('+').includes(findingKey)
export function alertState<T extends { crew: string; did: string; alertKey: string; ts: number; note: string }>(actions: T[], me: string, keys: string[]) {
  const covering = actions.filter((a) => a.crew === me && a.did === 'Alerted the crew' && keys.some((k) => covers(a.alertKey, k)))
  const allCovered = keys.length > 0 && keys.every((k) => covering.some((a) => covers(a.alertKey, k)))
  const sent = allCovered ? [...covering].sort((x, y) => x.ts - y.ts)[0] : undefined
  const ackKeys = new Set(covering.map((a) => a.alertKey))
  const acks = actions.filter((a) => a.crew === me && a.did === 'Acknowledged the alert' && ackKeys.has(a.alertKey))
  return { sent, acks, covering }
}

/** An open infection-like notice beside an urgent reading changes what the medical officer should think of first:
 *  the alert says so. */
export function contextNote(findings: { ruleId: string; title: string; days: number; status: string }[]): string {
  const inf = findings.find((f) => (f.ruleId === 'R-ILL' || f.ruleId === 'R-SYM-ILL') && f.status !== 'urgent')
  return inf ? ` (also open: "${inf.title}", ${inf.days} day${inf.days === 1 ? '' : 's'})` : ''
}
