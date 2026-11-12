import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_LABEL, TIER_LABEL } from '../core/analysis'
import { linkState } from '../core/link'
import { IND, shortDay } from '../core/mission'
import type { TruthEvent } from '../core/types'
import { useApp } from '../state'
import { TrendChart, TrendLegend } from '../ui/charts'
import { Card, go, Icon, StatusTag } from '../ui/kit'
import { bandFor } from '../ui/series'

const SHOW: Record<string, string[]> = {
  illness: ['rhr', 'hrv', 'temp'], sleep_loss: ['sleep_h', 'pvt_rt', 'mood'], co2: ['co2', 'pvt_rt', 'sleep_h'], decond: ['ex7', 'rhr', 'hrv'],
  dehydration: ['fluid', 'rhr', 'mass'], low_mood: ['mood', 'sleep_h', 'ex7'], spe: ['rad', 'rhr', 'sleep_h'],
}

const RANK: Record<string, number> = { learning: 0, steady: 1, watch: 2, act: 3, urgent: 4 }
const TIER_RANK: Record<string, number> = { self: 0, cmo: 1, ground: 2 }

interface FeedItem { day: number; kind: 'alert' | 'truth' | 'link' | 'info'; title: string; body: string; status?: 'watch' | 'act' | 'urgent' | 'steady' }

export function Replay() {
  const { mission, model, today, analyses, setDay, setMe } = useApp()
  const events = mission.truth
  const [ei, setEi] = useState(() => Math.max(0, events.findIndex((e) => e.type === 'illness')))
  const ev: TruthEvent | undefined = events[ei]
  const crewIdx = ev && ev.crew >= 0 ? ev.crew : 0
  const crew = mission.crew[crewIdx]
  const start = ev ? Math.max(0, ev.onset - 16) : 0
  const end = ev ? Math.min(mission.days - 1, ev.onset + 9) : mission.days - 1
  const [t, setT] = useState(start)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(650)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => { setT(start); setPlaying(false) }, [ei, start])
  useEffect(() => {
    if (!playing) return
    timer.current = window.setInterval(() => setT((v) => { if (v >= end) { setPlaying(false); return v } return v + 1 }), speed)
    return () => window.clearInterval(timer.current)
  }, [playing, speed, end])

  const feed = useMemo(() => {
    const out: FeedItem[] = []
    const seen = new Map<string, number>()
    let linkUp = true
    for (let d = start; d <= t; d++) {
      const ls = linkState(mission, d, false)
      if (ls.available !== linkUp) {
        linkUp = ls.available
        out.push({ day: d, kind: 'link', title: linkUp ? 'Earth link restored' : 'Earth link lost', body: linkUp ? 'Queued summaries go out now.' : `${ls.reason}. Keel keeps working on board.` })
      }
      const a = today(crew.id, d)
      if (a) for (const f of a.findings) {
        // one entry when an alert opens, and another only if it gets more serious
        const rank = RANK[f.status] * 10 + TIER_RANK[f.tier]
        const prev = seen.get(f.key)
        if (prev === undefined) out.push({ day: d, kind: 'alert', status: f.status as FeedItem['status'], title: `${STATUS_LABEL[f.status]}: ${f.title}`, body: `${f.action} ${TIER_LABEL[f.tier]}.` })
        else if (rank > prev) out.push({ day: d, kind: 'alert', status: f.status as FeedItem['status'], title: `Escalated: ${f.title}`, body: `${f.action} ${TIER_LABEL[f.tier]}.` })
        seen.set(f.key, Math.max(prev ?? 0, rank))
      }
      for (const e of events) if (e.onset === d && (e.crew === crewIdx || e.crew < 0)) out.push({ day: d, kind: 'truth', title: `What was scripted: ${e.label.replace(/^Scripted /, '')}`, body: e.type === 'illness' ? `This is the day the simulated crew member first feels symptoms and ticks them at check-in. ${e.detail ?? ''}` : 'This is the day the scripted event starts.' })
    }
    return out
  }, [t, start, mission, today, crew.id, events, crewIdx])

  // only an alert that opens from three days before the event counts as a response to it;
  // anything earlier in the window is an unrelated (false) alert and is said to be one
  const firstAlert = feed.find((f) => f.kind === 'alert' && f.day >= (ev ? ev.onset - 3 : 0))
  const unrelated = feed.filter((f) => f.kind === 'alert' && ev && f.day < ev.onset - 3)
  const done = t >= end
  const an = analyses[crew.id]
  const inds = ev ? SHOW[ev.type] ?? ['rhr', 'hrv', 'sleep_h'] : ['rhr', 'hrv', 'sleep_h']
  const pct = ((t - start) / Math.max(1, end - start)) * 100
  const lead = ev && firstAlert ? ev.onset - firstAlert.day : null
  const cur = today(crew.id, t)
  const [val, setVal] = useState<{ det: number; net: number; n: number } | null>(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}results/real_eval.json`).then((r) => r.json()).then((j) => { const s = j.main[j.deployed]['1.0']; setVal({ det: s.detection_rate, net: s.net_detection, n: s.n_events }) }).catch(() => setVal(null))
  }, [])

  return (
    <>
      <h1>Mission replay</h1>
      <p className="muted">A scripted health event from the simulated mission, played at about {Math.round(1000 / speed * 10) / 10} mission days per second. Keel sees each day only as it arrives, exactly as it would on board.</p>
      <Card>
        <div className="field">
          <label htmlFor="ev">Event to replay</label>
          <select id="ev" value={ei} onChange={(e) => setEi(Number(e.target.value))} data-testid="replay-event">
            {events.map((e, i) => <option key={i} value={i}>{e.label} · {e.crew >= 0 ? mission.crew[e.crew].name : 'whole crew'} · {shortDay(mission, e.onset)}</option>)}
          </select>
        </div>
        <div className="row wrap">
          <button className="btn primary" onClick={() => { if (done) setT(start); setPlaying((p) => !p) }} data-testid="replay-play"><Icon name={playing ? 'pause' : 'play'} size={20} /> {playing ? 'Pause' : done ? 'Play again' : t > start ? 'Resume' : 'Play'}</button>
          <button className="btn" onClick={() => { setPlaying(false); setT(start) }}>Restart</button>
          <button className="btn" onClick={() => { setPlaying(false); setT((v) => Math.min(end, v + 1)) }} data-testid="replay-step">Step one day</button>
          <div className="seg" role="group" aria-label="Speed">{[[1300, 'Slow'], [650, 'Normal'], [250, 'Fast']].map(([ms, l]) => <button key={l} aria-pressed={speed === ms} onClick={() => setSpeed(ms as number)}>{l}</button>)}</div>
        </div>
        <div className="timeline" role="img" aria-label={`Replay position: ${shortDay(mission, t)}`}>
          <div className="fill" style={{ width: `${pct}%` }} />
          {feed.filter((f) => f.kind === 'alert').map((f, i) => <div key={i} className="mark alert" style={{ left: `${((f.day - start) / Math.max(1, end - start)) * 100}%` }} />)}
          {feed.filter((f) => f.kind === 'truth').map((f, i) => <div key={i} className="mark truth" style={{ left: `${((f.day - start) / Math.max(1, end - start)) * 100}%` }} />)}
        </div>
        <div className="card-h">
          <span className="num">Replay clock: <strong data-testid="replay-day">{shortDay(mission, t)}</strong> · {crew.name}</span>
          {cur && <StatusTag status={cur.status} label={STATUS_LABEL[cur.status]} />}
          <span className={`chip ${linkState(mission, t, false).available ? '' : 'down'}`}><span className="dot" />{linkState(mission, t, false).available ? 'In replay: link up' : 'In replay: no Earth link'}</span>
        </div>
      </Card>

      <div className="grid2">
        <Card title={`${crew.name.split(' ')[0]}'s readings`}>
          <TrendLegend />
          {inds.map((id) => {
            const def = IND[id]
            const b = bandFor(mission, model, an, crew.id, id, [])
            return (
              <div key={id} className="col" style={{ gap: 2 }}>
                <span className="small"><strong>{def.label}</strong> <span className="muted">({def.unit})</span></span>
                <TrendChart values={b.values.map((v, i) => (i <= t ? v : NaN))} lo={b.hasBand ? b.lo.map((v, i) => (i <= t ? v : NaN)) : undefined} hi={b.hasBand ? b.hi.map((v, i) => (i <= t ? v : NaN)) : undefined}
                  from={start} to={end} labelFor={(d) => shortDay(mission, d)} unit={def.unit} decimals={def.decimals} concern={def.concern} height={120}
                  refLines={id === 'co2' ? [{ y: 3, label: 'ISS limit' }] : undefined}
                  markers={[...(firstAlert && firstAlert.day <= t ? [{ day: firstAlert.day, label: 'Keel alert', kind: 'alert' as const }] : []), ...(ev && ev.onset <= t ? [{ day: ev.onset, label: ev.type === 'illness' ? 'Symptoms begin' : 'Event starts', kind: 'truth' as const }] : [])]}
                  ariaLabel={`${def.label} during the replay`} />
              </div>
            )
          })}
        </Card>
        <Card title="What Keel did">
          <div className="feed" aria-live="polite" data-testid="replay-feed">
            {feed.length === 0 && <p className="muted">Press Play. Nothing has happened yet.</p>}
            {feed.slice().reverse().map((f, i) => (
              <div className="item" key={`${f.day}-${i}`}>
                <div className="row wrap"><span className="tag num">{shortDay(mission, f.day)}</span>{f.kind === 'alert' && f.status ? <StatusTag status={f.status} label="" size={18} /> : <span className="tag">{f.kind === 'truth' ? 'Scripted event' : f.kind === 'link' ? 'Link' : 'Info'}</span>}</div>
                <strong>{f.title}</strong>
                <p className="small muted">{f.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {done && ev && (
        <section className="card action" data-testid="replay-result">
          <span className="tag">Result of this replay</span>
          {lead === null ? <p className="do">Keel did not flag this event inside the replay window.</p>
            : lead > 0 ? <p className="do">Keel flagged this {lead} day{lead === 1 ? '' : 's'} before {ev.type === 'illness' ? 'the first symptoms' : 'the scripted start'}, with a specific action and no link to Earth.</p>
              : <p className="do">Keel flagged this {lead === 0 ? (ev.type === 'illness' ? 'on the day symptoms began' : 'on the day it started') : `${-lead} day${lead === -1 ? '' : 's'} after ${ev.type === 'illness' ? 'symptoms began' : 'it started'}`}, with a specific action and no link to Earth.</p>}
          {unrelated.length > 0 && <p className="small">Earlier in this replay Keel also raised {unrelated.length} alert{unrelated.length === 1 ? '' : 's'} that had nothing to do with the scripted event. False alerts like that are part of the picture: the budget is about one notice per person-month.</p>}
          {val && <p className="small"><strong>Across all the real data, not this one script:</strong> Keel flagged {Math.round(val.det * 100)}% of {val.n} real illness episodes at one false alert per person-month, {Math.round(val.net * 100)} points more than luck. It did not give early warning. Everything except illness is tested in simulation only.</p>}
          <p className="small muted">One scripted event proves nothing by itself.</p>
          <div className="row wrap">
            <button className="btn primary" onClick={() => { setMe(crew.id); setDay(firstAlert ? Math.max(firstAlert.day + 1, Math.min(end, ev.onset - 1)) : ev.onset); go('today') }} data-testid="replay-open-today">Open that day as {crew.name.split(' ')[0]}</button>
            <a className="btn" href="#/validation">See the validation</a>
          </div>
        </section>
      )}
    </>
  )
}
