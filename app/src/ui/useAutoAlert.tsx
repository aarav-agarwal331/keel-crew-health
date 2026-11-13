import { useEffect, useRef, useState } from 'react'
import { alertFields, alertState } from '../core/alerts'
import { useApp } from '../state'

/** One alert service for every place a reading can be entered (Check-in, the thermometer box on Today).
 *  When `trigger` is true and something is "act now", the medical officer and commander are alerted after
 *  ten seconds unless the crew member cancels; leaving the screen sends it at once.  With emergency sharing
 *  off the alert still goes, but says only that the crew member needs help.  If the medical officer has not
 *  acknowledged five minutes later, the alert is sent again (while this screen is open; a flight version would escalate from the receiving tablets). */
export function useAutoAlert(trigger: boolean) {
  const { today, me, day, actions, logAction, mission } = useApp()
  const [autoAlert, setAutoAlert] = useState<{ key: string; ts: number } | null>(null)
  const [, setTick] = useState(0)
  const cancelRef = useRef<() => void>(() => {})
  const flushRef = useRef<() => void>(() => {})
  const urgent = (today(me, day)?.findings ?? []).filter((f) => f.status === 'urgent' && !f.crewWide)
  const akey = `alert|${urgent.map((x) => x.key).sort().join('+')}`
  // the latest action log, read when the timer fires: another screen may have sent this alert meanwhile
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  // the urgent items as they are when the alert goes: a reading withdrawn during the countdown is left out
  const urgentRef = useRef(urgent)
  urgentRef.current = urgent
  const counting = useRef(false)
  const alreadySent = (_k: string) => !!alertState(actionsRef.current, me, urgentRef.current.map((x) => x.key)).sent
  useEffect(() => {
    if (!trigger || !urgent.length || counting.current) return
    if (autoAlert?.key === akey || actions.some((x) => x.crew === me && x.alertKey === akey && /Alert cancelled/.test(x.did)) || alertState(actionsRef.current, me, urgent.map((x) => x.key)).sent) return
    setAutoAlert({ key: akey, ts: Date.now() })
    counting.current = true
    const send = () => {
      counting.current = false
      const u = urgentRef.current
      if (!u.length || alreadySent('')) return
      void logAction({ crew: me, alertKey: `alert|${u.map((x) => x.key).sort().join('+')}`, day, did: 'Alerted the crew', feel: null, ...alertFields(u, ' (sent automatically)') })
    }
    const t = window.setTimeout(() => { flushRef.current = () => {}; send() }, 10_000)
    const iv = window.setInterval(() => setTick((n) => n + 1), 1000)
    cancelRef.current = () => { counting.current = false; window.clearTimeout(t); window.clearInterval(iv); flushRef.current = () => {} }
    flushRef.current = () => { window.clearTimeout(t); window.clearInterval(iv); send() }
    window.setTimeout(() => window.clearInterval(iv), 11_000)
  })
  useEffect(() => () => flushRef.current(), [])
  // escalation: no acknowledgement from the medical officer (or, when the patient is the medical officer, the commander)
  const patientIsCmo = mission.crew.find((c) => c.id === me)?.role === 'cmo'
  const st = alertState(actions, me, urgent.map((x) => x.key))
  const sent = st.sent ? [st.sent] : []
  const acked = st.acks.some((x) => /medical officer/.test(x.note) || (patientIsCmo && /commander/.test(x.note)))
  const escalated = st.covering.some((x) => /sent again/.test(x.note))
  useEffect(() => {
    if (!sent.length || acked || escalated || !urgent.length) return
    const due = sent[0].ts + 5 * 60e3 - Date.now()
    const t = window.setTimeout(() => void logAction({ crew: me, alertKey: akey, day, did: 'Alerted the crew', feel: null, ...alertFields(urgent, ' (no answer after 5 minutes: sent again)') }), Math.max(0, due))
    return () => window.clearTimeout(t)
  })
  const autoLeft = autoAlert ? Math.max(0, 10 - Math.floor((Date.now() - autoAlert.ts) / 1000)) : 0
  const autoCancelled = autoAlert ? actions.some((x) => x.alertKey === autoAlert.key && x.did === 'Alert cancelled') : false
  const cancel = () => { if (!autoAlert) return; cancelRef.current(); void logAction({ crew: me, alertKey: autoAlert.key, day, did: 'Alert cancelled', feel: null, note: 'cancelled by the crew member' }) }
  return { counting: !!autoAlert && !autoCancelled && autoLeft > 0 && !alreadySent(autoAlert.key) && urgent.length > 0, autoLeft, cancel, escalated }
}
