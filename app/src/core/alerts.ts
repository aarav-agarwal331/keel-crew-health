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
