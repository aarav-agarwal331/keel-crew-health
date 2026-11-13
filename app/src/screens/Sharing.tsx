import { useState } from 'react'
import { STATUS_LABEL } from '../core/analysis'
import { CATEGORIES, IND, INDICATORS, shortDay, SYMPTOMS } from '../core/mission'
import { readiness, READY_LABEL } from '../core/readiness'
import { defaultSharing, LEVELS, ROLES, SHARE_CATEGORIES, type Level, type Role } from '../core/sharing'
import { viewFor } from '../core/visibility'
import { useApp } from '../state'
import { Card, Seg, StatusTag } from '../ui/kit'

const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id
// the body figure on Today is drawn by part of the body; sharing is by kind of reading. This names the link.
const ON_FIGURE: Record<string, string> = { cardio: 'Heart and circulation, Lungs and oxygen, Whole body', sleep: 'Brain, sleep and mood', cognition: 'Brain, sleep and mood', exercise: 'Muscle and bone', nutrition: 'Food and fluids', symptoms: 'wherever the symptom is' }

export function Sharing() {
  const { mission, me, sharing, setShare, setEmergency, access, today } = useApp()
  const [role, setRole] = useState<Role>('cmo')
  const s = sharing[me] ?? defaultSharing()
  const a = today()
  const crew = mission.crew.find((c) => c.id === me)!
  const log = access.filter((x) => x.mission === mission.id && x.crew === me).sort((x, y) => y.ts - x.ts).slice(0, 30)
  const v = a ? viewFor(role, a, s) : null
  const r = a ? readiness(a) : null
  return (
    <>
      <h1>Sharing and privacy</h1>
      <p className="muted">{crew.name}, your health data is yours. You decide below what each role can see. What is shown whatever you choose:</p>
      <table className="tbl small" data-testid="who-sees-table">
        <thead><tr><th>Who</th><th>Always</th><th>Your choice</th></tr></thead>
        <tbody>
          <tr><td>Medical officer</td><td>With emergency sharing on: every urgent or same-day safety item, with the value entered, and an alert for urgent ones; while an urgent item is open, also whether your heart, oxygen, temperature and symptom readings are inside your usual range (not what any notice says) and today's medication classes, so they can help. With it off: an alert that you need help, and "an item, details private".</td><td>Each area: nothing, status, trend or full detail</td></tr>
          <tr><td>Commander</td><td>Your readiness tier, without the reason. It is worked out from all your readings, including private ones and items marked "medical officer only", so ticking one of those changes it. With emergency sharing on: urgent items, the value entered and an alert, as backup; for an item marked "medical officer only", only that you need the medical officer urgently, never what it is. With it off: an alert that you need help.</td><td>Each area</td></tr>
          <tr><td>Crew</td><td>A count when three or more crew show a change in the same area</td><td>Nothing</td></tr>
          <tr><td>Ground</td><td>With emergency sharing on: a count of urgent items still open. With it off: nothing.</td><td>Each area, for the flight surgeon</td></tr>
          <tr><td>Everyone</td><td>Cabin air and radiation readings</td><td>Not personal</td></tr>
        </tbody>
      </table>
      <p className="small muted">How it travels: in this demo every role is on one tablet. In a flight version your data stays on your tablet, and only the views allowed here would go over the cabin network, to the medical officer's and commander's tablets; the daily ground summary goes out when a link exists.</p>
      <Card title="Always visible, whatever you choose below">
        <ul className="list small">
          <li><strong>To the medical officer: an overall status</strong> made only from the areas you share with them, and, under emergency sharing, every open "act now" or "act today" item from a safety rule, with what it is and the readings behind it, in any area. Notices from your readings follow the levels below.</li>
          <li><strong>To the commander: your readiness tier</strong> (steady / worth a look / talk to the medical officer first), without the reason, except emergencies (see below). A commander has to be able to plan a spacewalk safely. The tier is worked out from all your readings, including ones you keep private. An item marked "medical officer only" can make it "Talk to the medical officer first", but the commander is never shown why.</li>
          <li><strong>To the crew: counts.</strong> When three or more crew members show a change in the same area, the Crew screen shows the count, not the names. In a crew of four that is not fully anonymous.</li>
          <li><strong>To everyone: cabin readings</strong> (air, radiation). They are not personal.</li>
        </ul>
        <div className="row wrap">
          <span className="lab">Emergency sharing</span>
          <div className="seg" role="group" aria-label="Emergency sharing" data-testid="emergency-toggle">
            <button aria-pressed={s.emergency !== false} onClick={() => setEmergency(me, true)}>On</button>
            <button aria-pressed={s.emergency === false} onClick={() => setEmergency(me, false)}>Off</button>
          </div>
          <span className="small muted">When on, a symptom you mark as serious or an "act now" safety reading appears at once on the medical officer's and the commander's Crew screens (what it is, the value entered and the action; the commander never sees items marked "medical officer only" and never sees your reading log), an alert goes to both ten seconds after you save (at once if you leave Check-in) unless you withdraw a typing mistake, and it stays on the medical officer's list until they close it with a note.</span>
          <details className="small muted"><summary>More about emergency sharing</summary><p>The commander is shown it too, as backup, except the items marked "medical officer only" at check-in ({SYMPTOMS.filter((x) => (x as { commander?: boolean }).commander === false).map((x) => x.label.toLowerCase()).join('; ')}). Emergency sharing sends no details to the ground: the daily ground summary carries only what you set for the flight surgeon below, plus a count of urgent items still open, so the flight surgeon knows to call. Every fixed safety rule (a reading or a serious symptom) that needs attention now or today goes on the medical officer's list; notices from your readings follow the sharing levels below; under this consent they see what the item is and the readings behind it, even for an area you have not shared. With it off, nothing extra goes to anyone: urgent items reach the medical officer's list only as "an item, details private" (so they can close it once you have talked), and the alert (automatic or by the button) says only that you need help, and the ground gets no count. Both can see that it is off.</p></details>
        </div>
      </Card>

      <Card title="Who are you setting this for?">
        <Seg label="Role" value={role} onChange={setRole} options={ROLES.map((x) => ({ id: x.id, label: x.label }))} />
        <p className="small muted">{ROLES.find((x) => x.id === role)!.blurb}</p>
        <ul className="list tiny muted">{LEVELS.map((l) => <li key={l.id}><strong>{l.label}:</strong> {l.reveals}</li>)}</ul>
        <p className="tiny muted">Sharing areas group the readings a medical officer would look at together, so they are not the same as the body areas on Today. Each area below lists exactly what it contains.</p>
        <div className="col">
          {SHARE_CATEGORIES.map((c) => (
            <div key={c} className="col" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span className="lab">{catLabel(c)} <span className="tiny muted">(on the body figure: {ON_FIGURE[c]})</span></span>
              <span className="tiny muted">{c === 'symptoms' ? 'What you tick at check-in, medication classes you log, and photos you add' : INDICATORS.filter((i) => i.category === c && i.source !== 'env' && i.source !== 'dosimeter').map((i) => i.label.toLowerCase()).join(', ')}</span>
              <div className="seg" role="group" aria-label={`${catLabel(c)} shared with ${role}`}>
                {LEVELS.map((l) => <button key={l.id} aria-pressed={s[role][c] === l.id} onClick={() => setShare(me, role, c, l.id as Level)} data-testid={`share-${role}-${c}-${l.id}`}>{l.label}</button>)}
              </div>
            </div>
          ))}
        </div>
        <div className="row wrap">
          <button className="btn sm" onClick={() => SHARE_CATEGORIES.forEach((c) => setShare(me, role, c, 'none'))}>Make everything private</button>
          <button className="btn sm" onClick={() => SHARE_CATEGORIES.forEach((c) => setShare(me, role, c, 'detail'))}>Share everything</button>
        </div>
      </Card>

      {v && (
        <Card title={`Exactly what the ${ROLES.find((x) => x.id === role)!.label.toLowerCase()} sees about you right now`}>
          {role === 'commander' && r && <p><StatusTag status={r.tier} label={`Readiness: ${READY_LABEL[r.tier]}`} /> <span className="small muted">(always visible to the commander, without the reason)</span></p>}
          <p>{v.overall === 'private' ? <StatusTag status="private" label="Nothing personal is shared" /> : <StatusTag status={v.overall} label={`Overall: ${STATUS_LABEL[v.overall]}`} />}</p>
          <div className="tablewrap"><table data-testid="role-preview">
            <thead><tr><th>Area</th><th>Level</th><th>They see</th></tr></thead>
            <tbody>
              {SHARE_CATEGORIES.map((c) => {
                const x = v.categories[c]
                return (
                  <tr key={c}><td>{catLabel(c)}</td><td>{LEVELS.find((l) => l.id === x.level)!.label}</td>
                    <td>{x.status === undefined ? <span className="muted">Nothing</span> : <>
                      {STATUS_LABEL[x.status]}
                      {x.indicators && <span className="muted">{x.indicators.length ? ': ' : ''}{x.indicators.map((i) => `${IND[i.ind].short} ${i.value !== undefined && !Number.isNaN(i.value) ? i.value.toFixed(IND[i.ind].decimals) + ' ' + IND[i.ind].unit : i.inRange ? 'in range' : 'out of range'}`).join(', ')}</span>}
                    </>}</td></tr>
                )
              })}
            </tbody>
          </table></div>
          {v.findings.length > 0 && <ul className="list small">{v.findings.map((f) => <li key={f.key}>{f.emergency ? 'Emergency sharing: ' : ''}{f.title ? `Alert in ${catLabel(f.category).toLowerCase()}: ${f.title}` : `That an alert exists in ${catLabel(f.category).toLowerCase()}, not what it says`}{f.action ? `. Advice shown: ${f.action}` : ''}</li>)}</ul>}
        </Card>
      )}

      <Card title="Access log" right={<span className="small muted">Stored on your device</span>}>
        {log.length === 0 && <p className="muted">Nobody has looked at your shared data yet. A look is logged each time the medical officer or commander opens their Crew screen; it is not a measure of whether your items are being handled.</p>}
        {log.length > 0 && <div className="tablewrap"><table data-testid="access-log">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Level</th></tr></thead>
          <tbody>{log.map((x, i) => <tr key={i}><td>{shortDay(mission, x.day)}, {new Date(x.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>{ROLES.find((r2) => r2.id === x.role)?.label}</td><td>{x.what}</td><td>{LEVELS.find((l) => l.id === x.level)?.label}</td></tr>)}</tbody>
        </table></div>}
      </Card>
    </>
  )
}
