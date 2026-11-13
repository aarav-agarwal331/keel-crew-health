import { useEffect, useMemo, useState } from 'react'
import { CM, STATUS_LABEL, URGENCY_LABEL } from '../core/analysis'
import { CATEGORIES, IND, shortDay } from '../core/mission'
import { readiness, READY_LABEL } from '../core/readiness'
import { allows, defaultSharing, SHARE_CATEGORIES, type Role } from '../core/sharing'
import { categoryStatus, viewFor, visibleExtras, visibleOpenItems } from '../core/visibility'
import { useApp } from '../state'
import { Card, Glyph, href, ReadingLog, Seg, StatusTag } from '../ui/kit'

const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id

export function Crew() {
  const { mission, day, today, sharing, logAccess, me, entries, logAction } = useApp()
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
      extras: visibleExtras(role, s, e?.meds, e?.photos),
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
  const ready = rows.filter((x) => x.r?.tier === 'go').length
  const hold = rows.filter((x) => x.r?.tier === 'hold').length
  const minor = rows.filter((x) => x.r?.tier === 'caution').length

  return (
    <>
      <div className="card-h"><h1>Crew readiness</h1><Seg label="View as" value={role} onChange={setRole} options={[{ id: 'commander', label: 'Commander' }, { id: 'cmo', label: 'Medical officer' }]} /></div>
      <p className="muted">{shortDay(mission, day)}. {role === 'commander' ? 'Whether Keel has any flags for each crew member before a demanding task tomorrow, such as a spacewalk. You see a tier for everyone; reasons appear only where a crew member has chosen to share them.' : 'What each crew member has chosen to share with you. Nothing is shown that they have not shared, except emergencies they agreed to share and, under that consent, the fact that an item is open in an area. Their overall tier is worked out from all their readings.'}</p>
      <p className="banner">Demo view. On a mission each role has its own device; here you can switch roles. Every look is written to the crew member's access log.</p>

      {role === 'commander' && (
        <section className="card" data-testid="crew-summary">
          <h2>Task tomorrow: spacewalk</h2>
          <p><strong className="num" style={{ fontSize: '1.3rem' }}>{hold} of {rows.length} should talk to the medical officer first. {minor} {minor === 1 ? 'has' : 'have'} minor flags. {ready} {ready === 1 ? 'has' : 'have'} none.</strong></p>
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
        {rows.map(({ c, a, r, v, s, open, extras }) => (
          <section className="card" key={c.id} data-testid={`crew-${c.id}`}>
            <div className="card-h"><div className="col" style={{ gap: 0 }}><h2>{c.name}</h2><span className="small muted">{c.role_label}</span></div></div>
            {!a || !r || !v ? <p className="muted">No data.</p> : <>
              {role === 'commander' && <p><StatusTag status={r.tier} label={r.tier === 'hold' && c.role === 'cmo' ? 'Talk to the flight surgeon or a backup first' : READY_LABEL[r.tier]} /></p>}
              {s.emergency === false && <p className="tiny muted">Emergency sharing is switched off for this crew member: red-flag symptoms will not appear here.</p>}
              {role === 'commander' && r.tier !== 'go' && r.tier !== 'unknown' && (() => {
                const shown = r.reasons.filter((x) => allows((s.commander as Record<string, 'none' | 'status' | 'trend' | 'detail'>)[x.category] ?? 'none', 'trend'))
                return shown.length
                  ? <ul className="list small">{shown.map((x, i) => <li key={i}>{x.text}</li>)}</ul>
                  : c.role === 'commander' ? <p className="small muted">This is the commander's own card. The reasons are on their own Today screen.</p>
                  : <p className="small muted"><StatusTag status="private" label="" size={16} /> Reason not shared. Ask {c.name.split(' ')[0]}{c.role === 'cmo' ? '' : ' or the medical officer'}.</p>
              })()}
              {v.findings.filter((x) => x.emergency).map((x) => (
                <div key={x.key} className="banner strong">
                  <p><strong>{x.title}{x.symptoms?.length ? `: ${x.symptoms.join('; ').toLowerCase()}` : ''}.</strong> <span className="small">(shared automatically: emergency sharing)</span></p>
                  <ReadingLog readings={x.readings ?? []} title="Entered readings, in order" note={false} />
                  <p className="small">{c.name.split(' ')[0]} was told: "{x.action}"</p>
                </div>
              ))}
              {role === 'cmo' && <p>{v.overall === 'private' ? <StatusTag status="private" label="Nothing shared with you" /> : <StatusTag status={v.overall} label={STATUS_LABEL[v.overall]} />}</p>}
              {role === 'cmo' && (
                <ul className="list small">
                  {SHARE_CATEGORIES.filter((cat) => v.categories[cat].status !== undefined).map((cat) => {
                    const x = v.categories[cat]
                    const outs = x.indicators?.filter((i) => !i.inRange) ?? []
                    return <li key={cat}><StatusTag status={x.status!} label={catLabel(cat)} size={16} />{outs.length > 0 && <span className="muted">: {outs.map((i) => `${IND[i.ind].short}${i.value !== undefined && !Number.isNaN(i.value) ? ` ${i.value.toFixed(IND[i.ind].decimals)} ${IND[i.ind].unit}` : ' out of range'}`).join(', ')}</span>}</li>
                  })}
                  {v.findings.filter((x) => !x.emergency).filter((x, i, arr) => x.title || arr.findIndex((y) => !y.title && y.category === x.category) === i).map((f) => (
                    <li key={f.key}>
                      <strong>{f.title ?? `Open item in ${catLabel(f.category).toLowerCase()} (details not shared)`}</strong> <span className="muted">({STATUS_LABEL[f.status].toLowerCase()} for {f.days} d)</span>
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
                          <button className="btn sm" disabled={!(notes[x.key] ?? '').trim()} onClick={() => void logAction({ crew: c.id, alertKey: x.key, day, did: `Closed by the ${role === 'cmo' ? 'medical officer' : 'commander (backup)'}`, feel: null, note: (notes[x.key] ?? '').trim() })} data-testid="close-item">Close</button>
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
      <p className="banner">The tier is a rule-based summary: it is never better than the worst area on the crew member's own screen, and nausea or clearly slowed reactions always mean a conversation first. It is not a validated fitness-for-duty test and not a clearance.</p>
    </>
  )
}
