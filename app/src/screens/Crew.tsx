import { useEffect, useMemo, useState } from 'react'
import { CM, STATUS_LABEL, URGENCY_LABEL } from '../core/analysis'
import { CATEGORIES, IND, shortDay } from '../core/mission'
import { overdueForCommander, readiness, READY_LABEL } from '../core/readiness'
import { allows, defaultSharing, SHARE_CATEGORIES, type Role } from '../core/sharing'
import { categoryStatus, viewFor, visibleExtras, visibleOpenItems } from '../core/visibility'
import { useApp } from '../state'
import { Card, Glyph, href, ReadingLog, Seg, StatusTag } from '../ui/kit'

const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id

export function Crew() {
  const { mission, day, today, sharing, logAccess, me, entries, logAction, actions } = useApp()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const meRole = mission.crew.find((c) => c.id === me)?.role
  const [role, setRole] = useState<Role>(meRole === 'cmo' ? 'cmo' : 'commander')
  const rows = useMemo(() => mission.crew.map((c) => {
    const a = today(c.id)
    const s = sharing[c.id] ?? defaultSharing()
    const e = entries.find((x) => x.mission === mission.id && x.crew === c.id && x.day === day)
    return {
      c, a, s, r: a ? readiness(a) : null, v: a ? viewFor(role, a, s) : null,
      open: a ? visibleOpenItems(role, a.openItems, s, c.role === 'cmo') : [],
      extras: visibleExtras(role, s, e?.meds, e?.photos, !!a?.findings.some((f) => f.status === 'urgent' && !f.crewWide)),
    }
  }), [mission, today, sharing, role, entries, day])

  // every look at someone's data is written to that person's access log
  useEffect(() => {
    for (const { c, v } of rows) {
      if (!v) continue
      if (role === 'commander') logAccess({ crew: c.id, role, category: 'readiness', level: 'status', what: 'Readiness tier', day })
      for (const cat of SHARE_CATEGORIES) if (v.categories[cat].status !== undefined) logAccess({ crew: c.id, role, category: cat, level: v.categories[cat].level, what: catLabel(cat), day })
    }
  }, [rows, role, day, logAccess])

  // crew-level pattern: counts only, and only when at least two people are affected
  const pattern = SHARE_CATEGORIES.map((cat) => ({ cat, n: rows.filter((x) => x.a && ['watch', 'act', 'urgent'].includes(categoryStatus(x.a, cat))).length })).filter((x) => x.n >= 3)
  const env = rows[0]?.a?.findings.filter((f) => f.kind === 'environment') ?? []
  // the counts are disjoint and add up to the crew: someone with a visible urgent item is counted only there
  const urgentNow = rows.filter((x) => x.v?.findings.some((f) => f.emergency)).length
  const calm = rows.filter((x) => !x.v?.findings.some((f) => f.emergency))
  const ready = calm.filter((x) => x.r?.tier === 'go').length
  const hold = calm.filter((x) => x.r?.tier === 'hold').length
  const minor = calm.filter((x) => x.r?.tier === 'caution').length

  return (
    <>
      {(() => {
        const isCmo = (crewId: string) => mission.crew.find((c) => c.id === crewId)?.role === 'cmo'
        const raised = actions.filter((x) => (x.did === 'Alerted the crew' || (x.did === 'Asked to be seen today' && (role === 'cmo' || isCmo(x.crew)))) && x.day <= day)
        const acksFor = (x: { alertKey: string; crew: string }) => actions.filter((q) => q.did === 'Acknowledged the alert' && q.alertKey === x.alertKey && q.crew === x.crew)
        // an alert stays until the medical officer has acknowledged it (the commander's acknowledgement is shown, not enough)
        // when the patient is the medical officer, the commander (their backup) acknowledging is enough
        const open0 = raised.filter((x) => !acksFor(x).some((q) => /medical officer/.test(q.note) || (isCmo(x.crew) && /commander/.test(q.note))))
        // one banner per crew member and kind: the latest alert, with how many times it has been sent
        const sends = (x: (typeof open0)[number]) => open0.filter((y) => y.crew === x.crew && y.did === x.did)
        const open = open0.filter((x) => sends(x).every((y) => y.ts <= x.ts))
        // one line per urgent item: split on "; " outside brackets only, with the "also open" context on its own line
        const items = (note: string) => {
          const t = note.replace(/ \((sent automatically|sent automatically: from the overnight sensor|no answer after 5 minutes: sent again|no answer after 10 minutes: sent to the whole crew|medical officer only)\)/g, '').replace(/ \((also open, shown to the medical officer only: [^)]*)\)$/, '; $1')
          const out: string[] = []
          let depth = 0, cur = ''
          for (let i = 0; i < t.length; i++) {
            const ch = t[i]
            if (ch === '(') depth++
            if (ch === ')') depth = Math.max(0, depth - 1)
            if (depth === 0 && t.startsWith('; ', i)) { out.push(cur); cur = ''; i++; continue }
            cur += ch
          }
          out.push(cur)
          return out.filter(Boolean).map((x) => x.replace(/^also open, shown to the medical officer only: /, 'Also open (shown to you only): '))
        }
        return open.map((x) => (
          <section key={x.ts} className={`card action${x.did === 'Alerted the crew' ? ' urgent-card' : ''}`} role="alert" data-testid="crew-alert">
            {x.did === 'Alerted the crew' && <StatusTag status="urgent" label="Act now" />}
            {role === 'commander' && x.safety && !isCmo(x.crew) ? <p className="do" data-testid="safety-alert">{`Crew safety concern about ${mission.crew.find((c) => c.id === x.crew)?.name}, raised at ${new Date(x.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}. Do not go alone: take another crew member with you and find the medical officer, who has the details.`}</p> : role === 'commander' && (x.cmoOnly || /\(medical officer only\)/.test(x.note)) && !isCmo(x.crew) ? <p className="do">{`${mission.crew.find((c) => c.id === x.crew)?.name} needs the medical officer urgently. Find the medical officer, and stay with ${mission.crew.find((c) => c.id === x.crew)?.name.split(' ')[0]}. (What it is stays with the medical officer.)`}</p> : <p className="do">{x.did === 'Asked to be seen today' ? `${mission.crew.find((c) => c.id === x.crew)?.name} asks to be seen today` : /\(sent automatically\)/.test(x.note) ? `Alert about ${mission.crew.find((c) => c.id === x.crew)?.name}, sent automatically after an urgent check-in` : `${mission.crew.find((c) => c.id === x.crew)?.name} raised an alert`} at {new Date(x.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}{x.did === 'Asked to be seen today' ? '. See them today.' : '. Go to them now.'}</p>}
            {!(role === 'commander' && (x.cmoOnly || x.safety || /\(medical officer only\)/.test(x.note)) && !isCmo(x.crew)) && sharing[x.crew]?.emergency !== false && items(role === 'commander' && !isCmo(x.crew) && x.cmdNote !== undefined ? x.cmdNote : x.note).length > 0 && <ul className="list" data-testid="alert-items">{items(role === 'commander' && !isCmo(x.crew) && x.cmdNote !== undefined ? x.cmdNote : x.note).map((t, i) => <li key={i}><strong>{t}</strong></li>)}</ul>}
            {sends(x).length > 1 && <p className="small">Sent {sends(x).length} times; first at {new Date(Math.min(...sends(x).map((y) => y.ts))).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}.</p>}
            {!sends(x).some((y) => acksFor(y).length) && Date.now() - Math.min(...sends(x).map((y) => y.ts)) > 5 * 60e3 && <p className="banner strong"><strong>Not acknowledged for {Math.round((Date.now() - Math.min(...sends(x).map((y) => y.ts))) / 60e3)} minutes{sends(x).some((y) => /whole crew/.test(y.note)) ? ': sent to the whole crew (in a flight version, every tablet)' : ''}.</strong> Whoever reads this: go to them, or find the medical officer.</p>}
            {acksFor(x).map((q) => <p key={q.ts} className="small">Acknowledged {q.note} at {new Date(q.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}.</p>)}
            {!acksFor(x).some((q) => q.note.includes(role === 'cmo' ? 'medical officer' : 'commander')) && <button className="btn primary" onClick={() => void logAction({ crew: x.crew, alertKey: x.alertKey, day, did: 'Acknowledged the alert', feel: null, note: `by the ${role === 'cmo' ? 'medical officer' : 'commander'}` })} data-testid="ack-alert">Acknowledge: I am on my way</button>}
            <p className="tiny muted">In a flight version this would sound on the medical officer's and commander's tablets over the cabin network; no Earth link is needed.</p>
          </section>
        ))
      })()}
      <div className="card-h"><h1>Crew readiness</h1><Seg label="View as" value={role} onChange={setRole} options={[{ id: 'commander', label: 'Commander' }, { id: 'cmo', label: 'Medical officer' }]} /></div>
      <p className="chip" data-testid="viewing-as">Viewing as {mission.crew.find((c) => c.role === role)?.name ?? (role === 'cmo' ? 'the medical officer' : 'the commander')} ({role === 'cmo' ? 'medical officer' : 'commander'}): demo view on one tablet</p>
      <p className="muted">{shortDay(mission, day)}. {role === 'commander' ? 'Whether Keel has any flags for each crew member before a demanding task tomorrow, such as a spacewalk. You see a tier for everyone; reasons appear only where a crew member has chosen to share them, and for urgent items under their emergency sharing (as their backup).' : 'What each crew member has chosen to share with you. Nothing is shown that they have not shared, except, under the emergency sharing they agreed to, every open urgent or same-day safety item with its readings. Their overall status here covers only the areas they share with you; the commander\'s tier (a separate thing) uses all their readings.'}</p>
      {role === 'commander' && <p className="small muted">Labels: "Act now" means an urgent item is open (go now). "Talk to the medical officer first" means something needs the medical officer before a demanding task. "Worth a look" means a minor flag.</p>}
      <p className="banner">Demo view. On a mission each role has its own device; here you can switch roles. Each time a role opens this screen it is written to each crew member's access log.</p>

      {role === 'commander' && (
        <section className="card" data-testid="crew-summary">
          <h2>Task tomorrow: a critical task (a spacewalk, or robotic-arm work)</h2>
          <p><strong className="num" style={{ fontSize: '1.3rem' }}>{urgentNow ? `${urgentNow} urgent now. ` : ''}{hold} {hold === 1 ? 'needs' : 'need'} a talk with the medical officer first. {minor} {minor === 1 ? 'has' : 'have'} minor flags. {ready} {ready === 1 ? 'has' : 'have'} none.</strong></p>
          <p className="small">This is not a medical clearance.</p>
          <p className="small muted">NASA's medical operations standard requires medical clearance before every spacewalk. Keel's tier is one input to that conversation with the medical officer.</p>
        </section>
      )}

      {env.map((f) => <a key={f.key} className="linkrow" href={href('alert', f.key)}><span className="row"><span className="st-act"><Glyph status="act" /></span><span className="col" style={{ gap: 2 }}><strong>{f.title}</strong><span className="small muted">{f.action}</span></span></span></a>)}
      {pattern.length > 0 && (
        <Card title="Crew-wide pattern">
          <ul className="list">{pattern.map((p) => <li key={p.cat}><strong>{p.n} of {rows.length}</strong> crew show a change in {catLabel(p.cat).toLowerCase()} over the last three days.</li>)}</ul>
          <p className="small muted">When several people drift together, look for a shared cause: an infection spreading, water or food, cabin air, schedule, workload. Tell the medical officer. Counts only, no names, and only when three or more people are affected.</p>
        </Card>
      )}

      <div className="grid2">
        {/* anyone with an urgent item this role may see comes first (order never reveals a private one) */}
        {[...rows].sort((x, y) => Number(!!y.v?.findings.some((f) => f.emergency)) - Number(!!x.v?.findings.some((f) => f.emergency))).map(({ c, a, r, v, s, open, extras }) => (
          <section className="card" key={c.id} data-testid={`crew-${c.id}`}>
            <div className="card-h"><div className="col" style={{ gap: 0 }}><h2>{c.name}</h2><span className="small muted">{c.role_label}</span></div></div>
            {!a || !r || !v ? <p className="muted">No data.</p> : <>
              {role === 'commander' && (v.findings.some((x) => x.emergency) ? <p><StatusTag status="urgent" label="Act now: an urgent item is open" /></p> : <p><StatusTag status={r.tier} label={r.tier === 'hold' && c.role === 'cmo' ? 'Talk to the named backup medic first' : READY_LABEL[r.tier]} /></p>)}
              {role === 'commander' && overdueForCommander(a, day, c.role === 'cmo') && <p className="small" data-testid="waiting-cmo"><strong>An item has waited more than a day for the medical officer.</strong> Nothing about it is shown here; please make sure the medical officer has seen {c.name.split(' ')[0]}.</p>}
              {s.emergency === false && <p className="tiny muted">Emergency sharing is switched off for this crew member: red-flag symptoms will not appear here.</p>}
              {role === 'commander' && r.tier !== 'go' && r.tier !== 'unknown' && (() => {
                const shown = r.reasons.filter((x) => allows((s.commander as Record<string, 'none' | 'status' | 'trend' | 'detail'>)[x.category] ?? 'none', 'trend'))
                return shown.length
                  ? <ul className="list small">{shown.map((x, i) => <li key={i}>{x.text}</li>)}</ul>
                  : c.role === 'commander' ? <p className="small muted">This is the commander's own card. The reasons are on their own Today screen.</p>
                  : v.findings.some((x) => x.safety) ? <p className="small"><strong>Crew safety concern: do not go to {c.name.split(' ')[0]} alone</strong> (details below).</p>
                  : v.findings.some((x) => x.emergency) ? <p className="small"><strong>Urgent: go to {c.name.split(' ')[0]} now</strong> (details below).</p>
                  : r?.reasons.some((x) => x.text === 'A private matter for the medical officer') ? <p className="small muted"><StatusTag status="private" label="" size={16} /> A private medical matter for the medical officer. Please do not ask {c.name.split(' ')[0]} about it.</p>
                  : <p className="small muted"><StatusTag status="private" label="" size={16} /> {v.findings.some((x) => x.emergency) ? 'Other reasons not shared.' : 'Reason private. The medical officer will advise if needed.'}</p>
              })()}
              {v.findings.filter((x) => x.emergency).map((x) => x.private ? (
                <div key={x.key} className="banner strong" data-testid="private-urgent">
                  {x.safety ? <p data-testid="safety-urgent"><strong>A crew safety concern is open. The medical officer has the details.</strong> Do not go to {c.name.split(' ')[0]} alone: take another crew member with you and find the medical officer.</p>
                    : <p><strong>An urgent item is open. What it is stays with the medical officer.</strong> Find the medical officer and stay with {c.name.split(' ')[0]}. Please do not ask {c.name.split(' ')[0]} about it.</p>}
                </div>
              ) : (
                <div key={x.key} className="banner strong">
                  <p><strong>{x.title}{x.symptoms?.length ? `: ${x.symptoms.join('; ').toLowerCase()}` : ''}.</strong> <span className="small">(shared automatically: emergency sharing)</span></p>
                  <ReadingLog readings={x.readings ?? []} title="Entered readings, in order" note={false} />
                  <p className="small">{c.name.split(' ')[0]} was told: "{x.action}"</p>
                  {(x.steps ?? []).filter((q) => /^For whoever is with you/.test(q)).map((q) => <p key={q} className="small" data-testid="responder-step"><strong>{q.replace(/^For whoever is with you: /, 'When you get there: ')}</strong></p>)}
                </div>
              ))}
              {role === 'cmo' && <p>{v.overall === 'private' ? <StatusTag status="private" label="Nothing shared with you" /> : <StatusTag status={v.overall} label={STATUS_LABEL[v.overall]} />}</p>}
              {role === 'cmo' && (
                <ul className="list small">
                  {SHARE_CATEGORIES.filter((cat) => v.categories[cat].status !== undefined).map((cat) => {
                    const x = v.categories[cat]
                    const outs = x.indicators?.filter((i) => !i.inRange) ?? []
                    return <li key={cat}><StatusTag status={x.status!} label={`${catLabel(cat)}${x.status !== 'steady' && x.status !== 'learning' ? ` (${STATUS_LABEL[x.status!].toLowerCase()})` : ''}`} size={20} />{v.findings.some((f) => f.emergency && f.category === cat) && <span>: because of {v.findings.filter((f) => f.emergency && f.category === cat).map((f) => (f.title ? f.title[0].toLowerCase() + f.title.slice(1) : '')).join('; ')}</span>}{outs.length > 0 && <span className="muted">{v.findings.some((f) => f.emergency && f.category === cat) ? '; trends outside the usual range' : ''}: {outs.map((i) => `${IND[i.ind].short}${i.value !== undefined && !Number.isNaN(i.value) ? ` ${i.value.toFixed(IND[i.ind].decimals)} ${IND[i.ind].unit}` : ' out of range'}`).join(', ')}</span>}</li>
                  })}
                  {v.findings.filter((x) => !x.emergency).filter((x, i, arr) => x.title || arr.findIndex((y) => !y.title && y.category === x.category) === i).map((f) => (
                    <li key={f.key}>
                      <strong>{f.title ?? (f.fixed ? `An item in ${catLabel(f.category).toLowerCase()} (details not shared)` : `Notice from the readings in ${catLabel(f.category).toLowerCase()} (details not shared)`)}</strong> <span className="muted">({STATUS_LABEL[f.status].toLowerCase()}, {f.days} {f.days === 1 ? 'day' : 'days'})</span>
                      {role === 'cmo' && c.role !== 'cmo' && f.key.includes('|P|') && ['act', 'urgent'].includes(f.status) && (() => {
                        const k = `${f.key}#${f.status}#${day - f.days + 1}`
                        const note = (notes[k] ?? '').trim()
                        const log = (did: string) => void logAction({ crew: c.id, alertKey: k, day, did, feel: null, note })
                        return (
                          <div className="row wrap">
                            <input type="text" aria-label={`Note on ${f.title ?? 'this notice'}`} value={notes[k] ?? ''} onChange={(e) => setNotes((p) => ({ ...p, [k]: e.target.value }))} placeholder="Note: what you found and decided" style={{ flex: 1, minWidth: 180 }} />
                            <button className="btn sm" disabled={!note} onClick={() => log('Noted by the medical officer (still open)')} data-testid="note-notice">Note only, keep open</button>
                            <button className="btn sm" disabled={!note} onClick={() => log('Closed by the medical officer: handled, not cleared for exercise or duties')} data-testid="close-notice-restricted">Handled, restrictions stay</button>
                            {f.title ? <button className="btn sm" disabled={!note} onClick={() => log('Closed by the medical officer: handled, no restriction')} data-testid="close-notice">Handled, no restriction</button>
                              : <button className="btn sm" disabled={!note} onClick={() => log('Closed by the medical officer: handled after an in-person exam, no restriction')} data-testid="close-notice-exam">Handled after examining them in person</button>}
                          </div>
                        )
                      })()}
                      {f.action && (
                        <details>
                          <summary>For the medical officer: what the crew member was told, and the basis</summary>
                          <div className="col small" style={{ paddingLeft: 30 }}>
                            <p><strong>{c.name.split(' ')[0]} was told ({URGENCY_LABEL[(f.urgency ?? 'routine') as 'now'].toLowerCase()}):</strong> "{f.action}"</p>
                            <ol className="list steps">{(f.steps ?? []).map((x) => <li key={x}><span>{x}</span></li>)}</ol>
                            <ReadingLog readings={f.readings ?? []} title="Entered readings, in order" note={false} />
                            {(f.changes ?? []).length > 0 && <p><strong>Readings shared with you:</strong> {f.changes!.map((ch) => `${IND[ch.ind].label} ${Number.isNaN(ch.value) ? '–' : ch.value.toFixed(IND[ch.ind].decimals)} ${IND[ch.ind].unit} (usual ${ch.expected.toFixed(IND[ch.ind].decimals)})`).join('; ')}.</p>}
                            {(f.countermeasures ?? []).map((id) => CM[id]).filter(Boolean).map((cm) => <p key={cm.id} className="muted"><strong>{cm.title}.</strong> {cm.text} [{cm.refs.join(', ')}]</p>)}
                            <p className="muted">Keel does not recommend medication or treatment. Those decisions are yours, with the onboard medical checklist and the flight surgeon when a link is available. If readings from other areas would help, ask the crew member to share them.</p>
                          </div>
                        </details>
                      )}
                    </li>
                  ))}
                  {SHARE_CATEGORIES.every((cat) => v.categories[cat].status === undefined) && <li className="muted">This crew member keeps their data private. They can share from their own Sharing screen.</li>}
                </ul>
              )}
              {role === 'cmo' && extras.meds.length > 0 && <p className="small"><strong>Medication logged today:</strong> {extras.meds.join(', ').toLowerCase()}.</p>}
              {role === 'cmo' && extras.photos.length > 0 && <div className="row wrap">{extras.photos.map((ph) => <figure key={ph.ts} style={{ margin: 0 }}><img src={ph.data} alt={`${ph.label} photo from ${c.name}`} style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 10 }} /><figcaption className="tiny">{ph.label}</figcaption></figure>)}</div>}
              {role === 'cmo' && a?.exerciseHold && <p className="small" data-testid={`ex-hold-${c.id}`}><strong>Exercise is on hold</strong> for {c.name.split(' ')[0]} until you clear them; minutes logged by the devices may still appear.</p>}
              {/* an item that needs the medical officer and has stayed open for two days or more is overdue: say so, without its content */}
              {role === 'cmo' && c.role !== 'cmo' && a && (() => {
                const overdue = a.findings.filter((f) => !f.crewWide && f.status === 'act' && f.tier !== 'self' && f.days >= 2)
                // while something urgent is open, the alert banner says it all
                return overdue.length > 0 && !a.findings.some((f) => f.status === 'urgent' && !f.crewWide) ? <p className="banner strong small" data-testid={`overdue-${c.id}`}><strong>Overdue:</strong> {overdue.length === 1 ? 'an item that needs you has' : `${overdue.length} items that need you have`} been open for {Math.max(...overdue.map((f) => f.days))} days. Please see {c.name.split(' ')[0]} today.</p> : null
              })()}
              {/* clearance is about the person: one action, saying exactly what it lifts */}
              {a?.restricted && (role === 'cmo' ? c.role !== 'cmo' : c.role === 'cmo') && (
                <div className="col" data-testid={`clearance-${c.id}`} style={{ gap: 6 }}>
                  <span className="lab">{c.name.split(' ')[0]} is restricted from exercise and duties by an earlier "not cleared" decision</span>
                  <div className="row wrap">
                    <input type="text" aria-label={`Clearance note for ${c.name}`} value={notes[`clear|${c.id}`] ?? ''} onChange={(e) => setNotes((p) => ({ ...p, [`clear|${c.id}`]: e.target.value }))} placeholder={role === 'cmo' ? 'Note: why they are cleared' : 'Who cleared them (flight surgeon or named backup) and why'} style={{ flex: 1, minWidth: 180 }} />
                    <button className="btn sm" disabled={!(notes[`clear|${c.id}`] ?? '').trim()} onClick={() => void logAction({ crew: c.id, alertKey: `clear|${c.id}`, day, did: role === 'cmo' ? 'Cleared for exercise and duties by the medical officer' : 'Cleared for exercise and duties, recorded by the commander', feel: null, note: (notes[`clear|${c.id}`] ?? '').trim() })} data-testid={`clear-person-${c.id}`}>Clear for exercise and duties</button>
                  </div>
                  <p className="tiny muted">This lifts every earlier "not cleared" decision on {c.name.split(' ')[0]}. It does not close open items, and a hold from an item still open stays until that item is closed.</p>
                </div>
              )}
              {/* the worklist: 'now' and 'today' findings from this person's own entries stay here until closed with a note */}
              {(role === 'cmo' || c.role === 'cmo') && open.length > 0 && (
                <div className="col" data-testid={`worklist-${c.id}`}>
                  <span className="lab">{role === 'cmo' && c.role === 'cmo' ? 'The medical officer\'s own open items: the commander, as backup, closes these' : 'Open items for you to close'}</span>
                  {open.map((x) => (
                    <div key={x.key} className="col" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <span className="small"><strong>{x.symptoms?.length ? `${x.title}: ${x.symptoms.join('; ').toLowerCase()} — ` : ''}{x.redacted ? `An item in ${catLabel(x.category).toLowerCase()} (details not shared; ask ${c.name.split(' ')[0]})` : x.title}</strong> <span className="muted">({shortDay(mission, x.day)}, {x.urgency === 'now' ? 'needed attention at once' : 'needed attention the same day'}{x.withdrawn ? '; the crew member withdrew the reading as a typing mistake' : ''}{x.settled ? '; a later reading that day was back on the safe side' : ''})</span></span>
                      <ReadingLog readings={x.readings ?? []} title="Entered readings" note={false} />
                      {!(role === 'cmo' && c.role === 'cmo') && (
                        <div className="row wrap">
                          <input type="text" aria-label={`Closing note for ${x.title}`} value={notes[x.key] ?? ''} onChange={(e) => setNotes((p) => ({ ...p, [x.key]: e.target.value }))} placeholder="Note: what you found and did" style={{ flex: 1, minWidth: 180 }} />
                          {role === 'cmo' && <button className="btn sm" disabled={!(notes[x.key] ?? '').trim()} onClick={() => void logAction({ crew: c.id, alertKey: x.key, day, did: `Closed by the ${role === 'cmo' ? 'medical officer' : 'commander (backup)'}: resolved, no restriction`, feel: null, note: (notes[x.key] ?? '').trim() })} data-testid="close-item">Close: resolved, no restriction</button>}
                          <button className="btn sm" disabled={!(notes[x.key] ?? '').trim()} onClick={() => void logAction({ crew: c.id, alertKey: x.key, day, did: `Closed by the ${role === 'cmo' ? 'medical officer' : 'commander (backup)'}: resolved, not cleared for exercise or duties`, feel: null, note: (notes[x.key] ?? '').trim() })} data-testid="close-item-restricted">Close: resolved, not cleared</button>
                        </div>
                      )}
                    </div>
                  ))}
                  <p className="tiny muted">A later normal reading does not close an item. Only a note from you does, and a new abnormal reading after your note reopens it. Consider consulting the flight surgeon at the next link for anything marked "at once".</p>
                </div>
              )}
            </>}
          </section>
        ))}
      </div>
      <p className="small muted">"Steady" and "no flags" mean within the person's own usual range and no rule triggered. They do not mean the values are healthy.</p>
      <p className="banner">The tier is a rule-based summary: it is never better than "Worth a look" when an area on the crew member's own screen is flagged, it is "Talk to the medical officer first" for anything urgent or anything that involves the medical officer, and nausea or clearly slowed reactions always mean a conversation first. It is not a validated fitness-for-duty test and not a clearance.</p>
    </>
  )
}
