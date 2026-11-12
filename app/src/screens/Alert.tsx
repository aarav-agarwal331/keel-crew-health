import { useState } from 'react'
import { CM, describeChange, REFS, RULE, STATUS_LABEL, TIER_LABEL, unusualness } from '../core/analysis'
import { IND, shortDay } from '../core/mission'
import type { ShareCategory } from '../core/sharing'
import { SHARE_CATEGORIES } from '../core/sharing'
import type { Tier } from '../core/types'
import { useApp } from '../state'
import { TrendChart } from '../ui/charts'
import { Card, href, Sources, StatusTag } from '../ui/kit'
import { bandFor } from '../ui/series'

const TIERS: Tier[] = ['self', 'cmo', 'ground']
const DID = ['Did it', 'Did part of it', 'Not yet', 'Chose not to']

export function Alert({ alertKey }: { alertKey?: string }) {
  const { mission, model, day, me, today, analyses, entries, actions, logAction, link, setShare, sharing } = useApp()
  const a = today()
  const [did, setDid] = useState('')
  const [feel, setFeel] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const f = a?.findings.find((x) => x.key === alertKey) ?? a?.findings[0]
  if (!a || !f) {
    return (
      <Card title="No open alert">
        <p className="muted">There is nothing open for this crew member on {shortDay(mission, day)}. Alerts close on their own once readings return to your normal range for three days.</p>
        <a className="btn" href={href('today')}>Back to Today</a>
      </Card>
    )
  }
  const mine = entries.filter((e) => e.mission === mission.id && e.crew === me)
  const rule = RULE[f.ruleId]
  const logs = actions.filter((x) => x.alertKey === f.key).sort((x, y) => y.ts - x.ts)
  const shareCats = f.categories.filter((c): c is ShareCategory => (SHARE_CATEGORIES as readonly string[]).includes(c))
  const sharedWithCmo = shareCats.length > 0 && shareCats.every((c) => sharing[me]?.cmo[c] === 'detail')
  const submit = async () => {
    await logAction({ crew: me, alertKey: f.key, day, did: did || 'No action recorded', feel, note })
    setSaved(true)
    setDid(''); setFeel(null); setNote('')
  }
  return (
    <>
      <a href={href('today')} className="small">← Today</a>
      <section className="card">
        <StatusTag status={f.status} label={STATUS_LABEL[f.status]} />
        <h1>{f.title}</h1>
        <p>{f.summary}</p>
        <p className="small muted">Open for {f.days} day{f.days === 1 ? '' : 's'}, since {shortDay(mission, f.start)}.{f.crewWide ? ' This affects the whole crew.' : ''}</p>
      </section>

      <section className="card action" data-testid="alert-action">
        <span className="tag">Recommended action</span>
        <p className="do">{f.action}</p>
        <ol className="list steps">{f.steps.map((s) => <li key={s}><span>{s}</span></li>)}</ol>
      </section>

      {f.changes.length > 0 && (
        <Card title="What changed">
          {f.changes.map((c) => {
            const b = bandFor(mission, model, analyses[me], me, c.ind, mine)
            const def = IND[c.ind]
            return (
              <div key={c.ind} className="col" style={{ gap: 4, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <strong>{describeChange(c)}</strong>
                <span className="small muted">How unusual for you: {unusualness(c)}</span>
                <TrendChart values={b.values} expected={b.hasBand ? b.expected : undefined} lo={b.hasBand ? b.lo : undefined} hi={b.hasBand ? b.hi : undefined} from={day - 27} to={day} labelFor={(t) => shortDay(mission, t)} unit={def.unit} decimals={def.decimals} concern={def.concern} height={150}
                  markers={[{ day: f.start, label: 'Alert opened', kind: 'alert' }]} refLines={c.ind === 'co2' ? [{ y: 3.0, label: 'ISS limit (3.0)' }] : undefined} ariaLabel={`${def.label}, last four weeks`} />
              </div>
            )
          })}
        </Card>
      )}

      <Card title="What may be contributing">
        {f.factors.length === 0 && <p className="muted">Nothing else in your recent data stands out. That makes an outside cause less likely, not impossible.</p>}
        <ul className="list">{f.factors.map((x) => <li key={x.id}><strong>{x.text}.</strong> <span className="muted">{x.evidence}</span></li>)}</ul>
        <p className="tiny muted">Taken only from your own readings and check-ins, and the shared cabin sensors.</p>
      </Card>

      <Card title="Who should know">
        <div className="tier" role="list" aria-label="Escalation level">
          {TIERS.map((t, i) => <div key={t} role="listitem" className={f.tier === t ? 'on' : ''} aria-current={f.tier === t ? 'step' : undefined}><span className="tiny">Level {i + 1}</span>{TIER_LABEL[t]}</div>)}
        </div>
        <p>{f.tierReason}</p>
        {f.tier === 'ground' && <p className="banner">{link.available ? 'A link is available. Keel has queued a summary; you decide what it contains in Sharing.' : 'No link right now. Keel keeps a summary queued and sends it when a link opens. Until then the medical officer decides on board.'}</p>}
        {!f.crewWide && shareCats.length > 0 && (sharedWithCmo
          ? <p className="small muted">The medical officer can see the details of this alert because you shared them.</p>
          : <button className="btn" onClick={() => shareCats.forEach((c) => setShare(me, 'cmo', c, 'detail'))} data-testid="share-cmo">Share this alert's details with the medical officer</button>)}
        {f.crewWide && <p className="small muted">Cabin-level readings are not personal data, so the whole crew sees this alert.</p>}
      </Card>

      <Card title="What did you do?">
        <div className="choices" role="group" aria-label="What did you do">{DID.map((d) => <button key={d} className="choice" aria-pressed={did === d} onClick={() => { setDid(d); setSaved(false) }}>{d}</button>)}</div>
        <span className="lab">How do you feel now?</span>
        <div className="choices five" role="group" aria-label="How do you feel now, 1 worst to 5 best">{[1, 2, 3, 4, 5].map((n) => <button key={n} className="choice" aria-pressed={feel === n} onClick={() => { setFeel(n); setSaved(false) }}><span className="n">{n}</span><span className="tiny">{n === 1 ? 'Worse' : n === 3 ? 'Same' : n === 5 ? 'Better' : ''}</span></button>)}</div>
        <div className="field"><label htmlFor="note">Note (optional)</label><input id="note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="" /></div>
        <button className="btn primary" disabled={!did && feel === null} onClick={submit} data-testid="log-action">Save to my log</button>
        {saved && <p role="status" className="small">Saved on this device.</p>}
        {logs.length > 0 && <ul className="list small">{logs.map((l) => <li key={l.id ?? l.ts}><strong>{shortDay(mission, l.day)}:</strong> {l.did}{l.feel ? `, feeling ${l.feel}/5` : ''}{l.note ? `. ${l.note}` : ''}</li>)}</ul>}
      </Card>

      <Card title="Where this advice comes from">
        {f.countermeasures.map((id) => CM[id]).filter(Boolean).map((c) => (
          <div key={c.id} className="col" style={{ gap: 4 }}>
            <div className="row wrap"><strong>{c.title}</strong><span className="tag">{c.type === 'official' ? 'NASA document' : 'Published research'}</span></div>
            <p className="small">{c.text}</p>
            <Sources ids={c.refs} refs={REFS} />
          </div>
        ))}
        <details>
          <summary>Audit trail: exactly why Keel said this</summary>
          <div className="col small">
            <p>Rule <code>{f.ruleId}</code> from the on-board rule table (<code>shared/rules.json</code>). No language model wrote any of this text.</p>
            {f.score !== undefined && <p>Detector: fused score {f.score.toFixed(2)} against the notice threshold {f.threshold?.toFixed(2)} and the alert threshold {model.thresholds.alert.toFixed(2)} ({f.detectorTier === 'alert' ? 'alert tier reached' : 'notice tier'}). Thresholds are set to a false-alert budget of {model.budgets?.notice ?? 1} per person-month for notices and {model.budgets?.alert ?? 0.25} for alerts{model.simulated_calibration ? ', calibrated on simulated missions' : ''}.</p>}
            <p>Rule condition: <code>{JSON.stringify(rule?.when)}</code></p>
            <p>Three-day deviations (robust SD, direction of concern): {Object.entries(a.u3).filter(([, v]) => !Number.isNaN(v)).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}</p>
            <a href={href('method', 'action')}>How alerts become actions</a>
          </div>
        </details>
      </Card>
      <p className="banner">Decision support only. Keel does not diagnose and cannot rule anything out. If you feel unwell, tell the medical officer whatever this screen says.</p>
    </>
  )
}
