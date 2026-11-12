import { REFS } from '../core/analysis'
import { INDICATORS } from '../core/mission'
import { SYSTEMS } from '../ui/BodyMap'
import { Card, href, Sources } from '../ui/kit'

const HAZARDS = [
  { name: 'Space radiation', does: 'Cosmic rays and solar storms. Mostly a long-term risk; a solar storm can also matter within hours.', keel: 'Daily and mission-total dose against the 600 mSv career limit; an alert with the shelter procedure when the dose rate jumps.' },
  { name: 'Isolation and confinement', does: 'Mood and sleep problems become more likely the longer a small crew is shut in together.', keel: 'Private mood check-ins, sleep duration and timing, reaction self-test, each against your own normal.' },
  { name: 'Distance from Earth', does: 'Up to about 24 minutes of signal delay each way, blackouts, no resupply and no quick return.', keel: 'Everything runs on board. The link only carries a summary you approve, when a link exists.' },
  { name: 'Gravity fields', does: 'Without weight, bone and muscle are lost, fluid shifts toward the head, and the body must re-adapt at each gravity change.', keel: 'Exercise against plan, resting heart rate and HRV; normal ranges are widened and re-learned after each gravity change.' },
  { name: 'Hostile, closed environment', does: 'Recycled air and water, shared microbes, an immune system that behaves differently.', keel: 'Cabin carbon dioxide with the levels linked to headaches; early signs of infection from heart rate, HRV and temperature.' },
]

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
        <ul className="list">
          <li><strong>Now, whatever Keel shows:</strong> chest pain or pressure, shortness of breath at rest, severe side or back pain, fainting, a resting oxygen reading of 92% or lower. Tell the medical officer.</li>
          <li><strong>Today:</strong> when Keel shows "Act today" with the medical officer level, or a temperature of 38.0 °C or more.</li>
          <li><strong>When a link opens:</strong> anything the medical officer wants a flight surgeon to review. Keel keeps the summary queued.</li>
        </ul>
        <p className="small muted">These are general thresholds from public clinical guidance, not a flight rule.</p>
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
