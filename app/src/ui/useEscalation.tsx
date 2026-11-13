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
    const iv = window.setInterval(() => setTick((n) => n + 1), 10_000)
    return () => window.clearInterval(iv)
  }, [])
  useEffect(() => {
    if (!mission || mission.kind === 'personal') return
    const now = Date.now()
    for (const c of mission.crew) {
      const urgent = (today(c.id, day)?.findings ?? []).filter((f) => f.status === 'urgent' && !f.crewWide)
      if (!urgent.length) continue
      const st = alertState(actions, c.id, urgent.map((x) => x.key))
      // an urgent item that comes only from a sensor (no typed reading, no ticked symptom) has no check-in to
      // start the ten-second countdown, so it is sent here as soon as it appears
      const sensorOnly = urgent.filter((f) => f.kind === 'vital' && !(f.readings ?? []).length && !(f.symptoms ?? []).length)
      if (!st.sent && sensorOnly.length && !sentAt.current.has(c.id)) {
        sentAt.current.set(c.id, now)
        void logAction({ crew: c.id, alertKey: `alert|${urgent.map((x) => x.key).sort().join('+')}`, day, did: 'Alerted the crew', feel: null, ...alertFields(urgent, ' (sent automatically: from the overnight sensor)') })
        continue
      }
      // a typed reading saved somewhere without its own countdown (the thermometer on an alert, a chest strap):
      // sent once fifteen seconds have passed with no countdown running and no cancel, so no entry point is missed
      const akey = `alert|${urgent.map((x) => x.key).sort().join('+')}`
      const live = urgent.flatMap((f) => (f.readings ?? []).filter((q) => !q.void))
      const newest = live.length ? Math.max(...live.map((q) => q.ts)) : 0
      const countdown = actions.some((x) => x.crew === c.id && x.did === 'Alert pending' && Number(x.note) > now)
      const cancelled = actions.some((x) => x.crew === c.id && x.alertKey === akey && /Alert cancelled/.test(x.did))
      if (!st.sent && newest && now - newest > 15e3 && now - newest < 30 * 60e3 && !countdown && !cancelled && !sentAt.current.has(c.id)) {
        sentAt.current.set(c.id, now)
        void logAction({ crew: c.id, alertKey: akey, day, did: 'Alerted the crew', feel: null, ...alertFields(urgent, ' (sent automatically)') })
        continue
      }
      if (!st.sent) continue
      const patientIsCmo = c.role === 'cmo'
      if (st.acks.some((x) => /medical officer/.test(x.note) || (patientIsCmo && /commander/.test(x.note)))) continue
      const last = Math.max(...st.covering.map((x) => x.ts), sentAt.current.get(c.id) ?? 0)
      if (now - last < 5 * 60e3) continue
      sentAt.current.set(c.id, now)
      // after ten minutes without an answer it goes to the whole crew (in this demo, the same Crew screens)
      const first = Math.min(...st.covering.map((x) => x.ts))
      void logAction({ crew: c.id, alertKey: `alert|${urgent.map((x) => x.key).sort().join('+')}`, day, did: 'Alerted the crew', feel: null, ...alertFields(urgent, now - first >= 10 * 60e3 ? ' (no answer after 10 minutes: sent to the whole crew)' : ' (no answer after 5 minutes: sent again)') })
    }
  }, [tick, actions, mission, day, today, logAction])
}
