import type { Finding } from '../core/types'
import { alertFields } from '../core/alerts'
import { useApp } from '../state'

/** One tap puts "please see me today" on the medical officer's Crew screen, until they acknowledge it. */
export function AskCmo({ f }: { f: Finding }) {
  const { actions, me, day, logAction } = useApp()
  if (f.status !== 'act' || f.tier === 'self' || f.patientIsCmo) return null
  const rkey = `ask|${f.key}`
  const asked = actions.find((x) => x.crew === me && x.alertKey === rkey && x.did === 'Asked to be seen today')
  const seen = actions.find((x) => x.crew === me && x.alertKey === rkey && x.did === 'Acknowledged the alert')
  const t = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return asked
    ? <p className="small"><strong>Asked the medical officer at {t(asked.ts)}.</strong> {seen ? `Acknowledged ${seen.note}.` : 'Not acknowledged yet.'}</p>
    : <div className="col" style={{ gap: 4 }}>
        <button className="btn primary block" onClick={() => void logAction({ crew: me, alertKey: rkey, day, did: 'Asked to be seen today', feel: null, ...alertFields([f]) })} data-testid="ask-cmo">Ask the medical officer to see me today</button>
        <p className="tiny muted">Until you ask, or tell them yourself, they have not been told.</p>
      </div>
}
