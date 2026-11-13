import { CM, REFS, RULES, URGENCY_LABEL, WHO_LABEL } from '../core/analysis'
import { SYMPTOMS } from '../core/mission'
import { INDICATORS } from '../core/mission'
import { SYSTEMS } from '../ui/BodyMap'
import { Card, href, Sources } from '../ui/kit'

const HAZARDS = [
  { name: 'Space radiation', does: 'Cosmic rays and solar storms. Mostly a long-term risk; a solar storm can also matter within hours.', keel: 'Daily and mission-total dose from the dosimeter. Keel does not warn of solar storms: the vehicle alarm does. Afterwards Keel records the dose and asks about nausea.' },
  { name: 'Isolation and confinement', does: 'Mood and sleep problems become more likely the longer a small crew is shut in together.', keel: 'Private mood check-ins, sleep duration and timing, reaction self-test, each against your own normal.' },
  { name: 'Distance from Earth', does: 'Up to about 24 minutes of signal delay each way, blackouts, no resupply and no quick return.', keel: 'Everything runs on board. When a link exists it carries a small daily summary containing only what you chose to share.' },
  { name: 'Gravity fields', does: 'Without weight, bone and muscle are lost, fluid shifts toward the head, and the body must re-adapt at each gravity change.', keel: 'Exercise against plan, resting heart rate and HRV; normal ranges are widened and re-learned after each gravity change.' },
  { name: 'Hostile, closed environment', does: 'Recycled air and water, shared microbes, an immune system that behaves differently.', keel: 'Cabin carbon dioxide, with an advisory line at 2.5 mmHg, an alert at 3.0 and an urgent alert at 4.0; signs of infection in heart rate, HRV and temperature, usually visible once symptoms have started.' },
]

const NOW = RULES.filter((r) => r.urgency === 'now' && r.id !== 'R-RED' && r.id !== 'R-RED-EXP')
const TODAY = RULES.filter((r) => r.urgency === 'today' && r.scope !== 'personal')

export function Guide({ focus }: { focus?: string }) {
  return (
    <>
      <h1>Guide to measurements</h1>
      <p className="muted">You do not need medical training to use Keel. This page explains each reading: what it is, how to take it properly, and why spaceflight changes it.</p>
      <Card title="The five hazards of human spaceflight, and what Keel watches for each">
        <div className="tablewrap"><table>
          <thead><tr><th>Hazard</th><th>What it does</th><th>What Keel tracks</th></tr></thead>
          <tbody>{HAZARDS.map((h) => <tr key={h.name}><td><strong>{h.name}</strong></td><td>{h.does}</td><td>{h.keel}</td></tr>)}</tbody>
        </table></div>
        <Sources ids={['6', '7']} refs={REFS} />
      </Card>
      <Card title="When to involve someone else">
        <p className="small muted">This list is built from the rule table. At run time Keel also adapts the wording (who to tell, repeats, a crewmate first), but never the thresholds.</p>
        <ul className="list">
          <li><strong>Now, whatever else Keel shows.</strong> Tell the medical officer; if you are the medical officer, tell the commander.
            <ul className="list"><li>Any of these symptoms: {SYMPTOMS.filter((x) => x.red_flag).map((x) => x.label.toLowerCase()).join('; ')}.</li>{NOW.map((r) => <li key={r.id}>{r.title}.</li>)}</ul></li>
          <li><strong>Today.</strong> Whenever Keel shows "Act today" and "Who" is not "you manage this yourself", and:
            <ul className="list">{TODAY.map((r) => <li key={r.id}>{r.title}.</li>)}</ul></li>
          <li><strong>When a link opens:</strong> anything the medical officer wants a flight surgeon to review. The daily summary contains only what you chose to share.</li>
          <li><strong>If you have thoughts of harming yourself, or cannot function:</strong> tell the medical officer now. Keel tells only the medical officer what it is; the commander sees no reason, but your readiness tier for them changes to "Talk to the medical officer first".</li>
        </ul>
        <p className="small muted">Keel gives first steps (rest, fluids, a repeat reading, sugar for a low blood sugar) but never recommends medication; that is for the medical officer with the onboard medical checklist. Some fixed thresholds come from public clinical guidance for adults on Earth; others (for example heart rate 35, 120 and 150, and the severe blood-pressure and blood-sugar lines) are provisional values we chose, marked as such in each rule. No threshold has been reviewed by a clinician; values without a cited source are marked provisional in the rule below. A fixed rule looks at every reading from the most recent day that has one, and anything needing attention now or today stays on the medical officer's list until they close it with a note. "Steady" on the Today screen means no change was detected, not that you are well.</p>
      </Card>
      <Card title="Everything Keel can recommend" id="actions">
        <p className="small muted">The complete list of {RULES.length} rules. Each has one action, how soon, who should know, and where the advice comes from. Nothing else can appear on an alert.</p>
        {RULES.map((r) => (
          <details key={r.id}>
            <summary>{r.title}</summary>
            <div className="col small" style={{ paddingLeft: 30 }}>
              <p><strong>Do:</strong> {r.action}</p>
              <ol className="list steps">{r.steps.map((x) => <li key={x}><span>{x}</span></li>)}</ol>
              <p><strong>How soon:</strong> {URGENCY_LABEL[r.urgency].toLowerCase()}. <strong>Who:</strong> {WHO_LABEL[r.tier].toLowerCase()}.</p>
              <p className="muted"><strong>Triggered by:</strong> {{ personal: 'a pattern in your readings while a detector alert is open', vital: 'a single reading you entered, or a short run of readings, beyond a fixed threshold', symptom: 'a symptom you reported', environment: 'a cabin reading (the commander or engineer leads; the whole crew sees it)', adaptation: 'symptoms soon after a gravity change' }[r.scope]}.</p>
              {r.cm.map((c) => CM[c]).filter(Boolean).map((c) => <p key={c.id} className="muted"><strong>{c.title}</strong> ({c.type === 'official' ? 'NASA document' : 'published or public guidance'}). {c.text} [{c.refs.join(', ')}]</p>)}
            </div>
          </details>
        ))}
        <p className="figcap">Reference numbers: <a href={href('method', 'sources')}>source list</a>.</p>
      </Card>
      {SYSTEMS.map((s) => {
        const inds = INDICATORS.filter((i) => i.system === s.id)
        return (
          <Card key={s.id} id={`sys-${s.id}`} title={s.label} className={focus === s.id ? 'action' : ''}>
            <p className="small muted">{s.hazard}</p>
            {inds.map((i) => (
              <div key={i.id} className="col" style={{ gap: 4, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <div className="card-h"><h3>{i.label} <span className="muted small">({i.unit})</span></h3><a className="chip" href={href('trends', i.id)}>See my trend</a></div>
                <p className="small">{i.plain}</p>
                <p className="small"><strong>How to measure.</strong> {i.how}</p>
                <p className="small"><strong>Why it matters.</strong> {i.why}</p>
              </div>
            ))}
          </Card>
        )
      })}
    </>
  )
}
