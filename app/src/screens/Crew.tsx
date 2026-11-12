import { useEffect, useMemo, useState } from 'react'
import { STATUS_LABEL } from '../core/analysis'
import { CATEGORIES, IND, shortDay } from '../core/mission'
import { readiness, READY_LABEL } from '../core/readiness'
import { allows, defaultSharing, SHARE_CATEGORIES, type Role } from '../core/sharing'
import { categoryStatus, viewFor } from '../core/visibility'
import { useApp } from '../state'
import { Card, Glyph, href, Seg, StatusTag } from '../ui/kit'

const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id

export function Crew() {
  const { mission, day, today, sharing, logAccess, me } = useApp()
  const meRole = mission.crew.find((c) => c.id === me)?.role
  const [role, setRole] = useState<Role>(meRole === 'cmo' ? 'cmo' : 'commander')
  const rows = useMemo(() => mission.crew.map((c) => {
    const a = today(c.id)
    const s = sharing[c.id] ?? defaultSharing()
    return { c, a, s, r: a ? readiness(a) : null, v: a ? viewFor(role, a, s) : null }
  }), [mission, today, sharing, role])

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

  return (
    <>
      <div className="card-h"><h1>Crew readiness</h1><Seg label="View as" value={role} onChange={setRole} options={[{ id: 'commander', label: 'Commander' }, { id: 'cmo', label: 'Medical officer' }]} /></div>
      <p className="muted">{shortDay(mission, day)}. {role === 'commander' ? 'Whether Keel has any flags for each crew member before a demanding task tomorrow, such as a spacewalk. You see a tier for everyone; reasons appear only where a crew member has chosen to share them.' : 'What each crew member has chosen to share with you. Nothing is shown that they have not shared, except emergencies they agreed to share.'}</p>
      <p className="banner">Demo view. On a mission each role has its own device; here you can switch roles. Every look is written to the crew member's access log.</p>

      {role === 'commander' && (
        <section className="card" data-testid="crew-summary">
          <h2>Task tomorrow: spacewalk</h2>
          <p><strong className="num" style={{ fontSize: '1.5rem' }}>Keel has no flags for {ready} of {rows.length}</strong> crew. This is not a medical clearance.</p>
          <p className="small muted">NASA's medical operations standard requires medical clearance before every spacewalk. Keel's tier is one input to that conversation with the medical officer.</p>
        </section>
      )}

      {env.map((f) => <a key={f.key} className="linkrow" href={href('alert', f.key)}><span className="row"><span className="st-act"><Glyph status="act" /></span><span className="col" style={{ gap: 2 }}><strong>{f.title}</strong><span className="small muted">{f.action}</span></span></span></a>)}
      {pattern.length > 0 && (
        <Card title="Crew-wide pattern">
          <ul className="list">{pattern.map((p) => <li key={p.cat}><strong>{p.n} of {rows.length}</strong> crew show a change in {catLabel(p.cat).toLowerCase()} over the last three days.</li>)}</ul>
          <p className="small muted">When several people drift together, look for a shared cause: cabin air, schedule, workload. Counts only, no names, and only when three or more people are affected.</p>
        </Card>
      )}

      <div className="grid2">
        {rows.map(({ c, a, r, v, s }) => (
          <section className="card" key={c.id} data-testid={`crew-${c.id}`}>
            <div className="card-h"><div className="col" style={{ gap: 0 }}><h2>{c.name}</h2><span className="small muted">{c.role_label}</span></div></div>
            {!a || !r || !v ? <p className="muted">No data.</p> : <>
              {role === 'commander' && <p><StatusTag status={r.tier} label={READY_LABEL[r.tier]} /></p>}
              {role === 'commander' && r.tier !== 'go' && r.tier !== 'unknown' && (() => {
                const shown = r.reasons.filter((x) => allows((s.commander as Record<string, 'none' | 'status' | 'trend' | 'detail'>)[x.category] ?? 'none', 'trend'))
                return shown.length
                  ? <ul className="list small">{shown.map((x, i) => <li key={i}>{x.text}</li>)}</ul>
                  : <p className="small muted"><StatusTag status="private" label="" size={16} /> Reason not shared. Ask {c.name.split(' ')[0]} or the medical officer.</p>
              })()}
              {v.findings.filter((x) => x.emergency).map((x) => <p key={x.key} className="banner strong"><strong>{x.title}.</strong> {x.action} <span className="small">(shared automatically: emergency sharing)</span></p>)}
              {role === 'cmo' && <p>{v.overall === 'private' ? <StatusTag status="private" label="Nothing shared with you" /> : <StatusTag status={v.overall} label={STATUS_LABEL[v.overall]} />}</p>}
              {role === 'cmo' && (
                <ul className="list small">
                  {SHARE_CATEGORIES.filter((cat) => v.categories[cat].status !== undefined).map((cat) => {
                    const x = v.categories[cat]
                    const outs = x.indicators?.filter((i) => !i.inRange) ?? []
                    return <li key={cat}><StatusTag status={x.status!} label={catLabel(cat)} size={16} />{outs.length > 0 && <span className="muted">: {outs.map((i) => `${IND[i.ind].short}${i.value !== undefined && !Number.isNaN(i.value) ? ` ${i.value.toFixed(IND[i.ind].decimals)} ${IND[i.ind].unit}` : ' out of range'}`).join(', ')}</span>}</li>
                  })}
                  {v.findings.filter((x) => !x.emergency).map((f) => <li key={f.key}><strong>{f.title ?? `Alert in ${catLabel(f.category).toLowerCase()}`}</strong>{f.action ? <span className="muted"> · advised: {f.action}</span> : ''} <span className="muted">({f.days} d)</span></li>)}
                  {SHARE_CATEGORIES.every((cat) => v.categories[cat].status === undefined) && <li className="muted">This crew member keeps their data private. They can share from their own Sharing screen.</li>}
                </ul>
              )}
            </>}
          </section>
        ))}
      </div>
      <p className="banner">The tier is a rule-based summary: it is never better than the worst area on the crew member's own screen, and nausea or clearly slowed reactions always mean a conversation first. It is not a validated fitness-for-duty test and not a clearance.</p>
    </>
  )
}
