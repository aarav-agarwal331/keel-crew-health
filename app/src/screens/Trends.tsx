import { useMemo, useState } from 'react'
import { concernDev, deployedScore, episodes } from '../core/detect'
import { CATEGORIES, IND, INDICATORS, shortDay } from '../core/mission'
import { useApp } from '../state'
import { TrendChart, TrendLegend, type Marker } from '../ui/charts'
import { Card, href, Seg } from '../ui/kit'
import { bandFor } from '../ui/series'

type Range = '14' | '56' | 'all'

export function Trends({ focus }: { focus?: string }) {
  const { mission, model, day, me, analyses, entries, actions } = useApp()
  const [range, setRange] = useState<Range>('56')
  const [cat, setCat] = useState<string>(focus && IND[focus] ? IND[focus].category : 'all')
  const mine = useMemo(() => entries.filter((e) => e.mission === mission.id && e.crew === me), [entries, mission.id, me])
  const an = analyses[me]
  const from = range === 'all' ? 0 : Math.max(0, day - Number(range) + 1)
  const starts = useMemo(() => (an ? episodes(deployedScore(an.scored, model), model.thresholds.notice, model.params.merge_gap, day).map(([s]) => s) : []), [an, model, day])
  // an alert is drawn only on the charts of the readings that were out of range when it opened
  const markersFor = (ind: string): Marker[] => {
    const out: Marker[] = mission.phases.map((p) => ({ day: p.start, label: p.name, kind: 'phase' as const }))
    const j = model.indicators.indexOf(ind)
    if (an && j >= 0) for (const s of starts) {
      let hit = false
      for (let t = s; t <= Math.min(day, s + 3); t++) if (concernDev(an.scored.z[t][j], model.concern[j]) >= 1.5) hit = true
      if (hit && s > day - 60) out.push({ day: s, label: 'Notice', kind: 'alert' })
    }
    for (const a of actions.filter((x) => x.mission === mission.id && x.crew === me)) out.push({ day: a.day, label: 'You logged', kind: 'log' })
    return out
  }
  const list = INDICATORS.filter((i) => cat === 'all' || i.category === cat)
  const ordered = focus && IND[focus] ? [IND[focus], ...list.filter((i) => i.id !== focus)] : list
  return (
    <>
      <div className="card-h">
        <h1>Trends</h1>
        <Seg label="Time range" value={range} onChange={setRange} options={[{ id: '14', label: '2 weeks' }, { id: '56', label: '8 weeks' }, { id: 'all', label: 'Mission' }]} />
      </div>
      <p className="muted">Each chart shows your readings against <strong>your own</strong> usual range, learned from your previous four weeks. Alerts and mission phase changes are marked.</p>
      <div className="row wrap" role="group" aria-label="Filter by body system">
        <button className={`btn sm ${cat === 'all' ? 'on' : ''}`} aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All</button>
        {CATEGORIES.filter((c) => c.id !== 'symptoms').map((c) => <button key={c.id} className={`btn sm ${cat === c.id ? 'on' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>)}
      </div>
      <TrendLegend />
      <div className="grid2">
        {ordered.map((def) => {
          const b = bandFor(mission, model, an, me, def.id, mine)
          const last = [...Array(Math.min(day + 1, 14)).keys()].map((k) => b.values[day - k]).find((v) => v !== undefined && !Number.isNaN(v))
          if (!b.values.slice(0, day + 1).some((v) => !Number.isNaN(v))) return focus === def.id ? <Card key={def.id} title={def.label}><p className="muted">No readings yet. Enter one at check-in.</p><p className="small">{def.how}</p></Card> : null
          const std = (def as unknown as { standard?: { value: number; label: string } }).standard
          const refLines = def.id === 'co2' ? [{ y: 2.5, label: 'Advisory line 2.5' }, { y: 3.0, label: 'Keel alert 3.0 (ISS operating level)' }]
            : def.id === 'glucose' ? [{ y: 70, label: 'Low below 70' }, { y: 99, label: 'Fasting normal up to 99' }]
            : def.id === 'sbp' ? [{ y: 120, label: 'Normal 90 to 120' }, { y: 90, label: '' }]
            : std ? [{ y: std.value, label: std.label }] : undefined
          const band = b.hasBand && def.id !== 'glucose'
          const rows = Array.from({ length: Math.min(14, day - from + 1) }, (_, k) => day - k)
          return (
            <Card key={def.id} id={`ind-${def.id}`} className={focus === def.id ? 'action' : ''} title={def.label} right={<span className="num"><strong style={{ fontSize: '1.25rem' }}>{last === undefined ? '–' : last.toFixed(def.decimals)}</strong> <span className="small muted">{def.unit}</span></span>}>
              <TrendChart values={b.values} expected={band ? b.expected : undefined} lo={band ? b.lo : undefined} hi={band ? b.hi : undefined} from={from} to={day}
                labelFor={(t) => shortDay(mission, t)} unit={def.unit} decimals={def.decimals} markers={markersFor(def.id)} refLines={refLines} concern={def.concern} ariaLabel={`${def.label} over time against your usual range`} />
              <p className="small muted">{def.plain}{std ? ` Your usual is not the standard. Standard: ${std.label}.` : ''}{def.id === 'glucose' ? ' Shown against general reference values, not a personal range.' : ''}</p>
              <details>
                <summary>Why it matters, how to measure, and the numbers</summary>
                <div className="col small">
                  <p><strong>Why it matters in space.</strong> {def.why}</p>
                  <p><strong>How to measure.</strong> {def.how}</p>
                  {!def.detect && def.source === 'spot' && <p className="muted">Measured about weekly, so it is shown against your own past readings but is not part of the automatic alert.</p>}
                  <div className="tablewrap"><table>
                    <thead><tr><th>Day</th><th className="n">Reading</th><th className="n">Usual range</th></tr></thead>
                    <tbody>{rows.map((t) => <tr key={t}><td>{shortDay(mission, t)}</td><td className="n">{Number.isNaN(b.values[t]) ? 'not measured' : b.values[t].toFixed(def.decimals)}</td><td className="n">{band && !Number.isNaN(b.lo[t]) ? `${b.lo[t].toFixed(def.decimals)} to ${b.hi[t].toFixed(def.decimals)}` : '–'}</td></tr>)}</tbody>
                  </table></div>
                  <a href={href('guide', def.system)}>More in the guide</a>
                </div>
              </details>
            </Card>
          )
        })}
      </div>
    </>
  )
}
