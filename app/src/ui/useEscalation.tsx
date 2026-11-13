import { useEffect, useRef, useState } from 'react'
import { alertFields, alertState } from '../core/alerts'
import { useApp } from '../state'

/** Repeat alerts, run by the app itself rather than by the patient's screen: while an urgent item has been
 *  alerted but the medical officer (or, when the patient is the medical officer, the commander) has not
 *  acknowledged it, the alert is sent again every five minutes, whichever screen is open.  The person who is
 *  unwell does not have to keep anything open.  In this demo every role shares one tablet; a flight version
 *  would run this on the receiving tablets as well. */
export function useEscalation() {
  const { mission, day, today, actions, logAction } = useApp()
  const [tick, setTick] = useState(0)
  const sentAt = useRef(new Map<string, number>())
  useEffect(() => {
    const iv = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(iv)
  }, [])
  useEffect(() => {
    if (!mission || mission.kind === 'personal') return
    const now = Date.now()
    for (const c of mission.crew) {
      const urgent = (today(c.id, day)?.findings ?? []).filter((f) => f.status === 'urgent' && !f.crewWide)
      if (!urgent.length) continue
      const st = alertState(actions, c.id, urgent.map((x) => x.key))
      if (!st.sent) continue
      const patientIsCmo = c.role === 'cmo'
      if (st.acks.some((x) => /medical officer/.test(x.note) || (patientIsCmo && /commander/.test(x.note)))) continue
      const last = Math.max(...st.covering.map((x) => x.ts), sentAt.current.get(c.id) ?? 0)
      if (now - last < 5 * 60e3) continue
      sentAt.current.set(c.id, now)
      void logAction({ crew: c.id, alertKey: `alert|${urgent.map((x) => x.key).sort().join('+')}`, day, did: 'Alerted the crew', feel: null, ...alertFields(urgent, ' (no answer after 5 minutes: sent again)') })
    }
  }, [tick, actions, mission, day, today, logAction])
}
