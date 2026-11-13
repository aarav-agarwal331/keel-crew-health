import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_LABEL, URGENCY_LABEL } from '../core/analysis'
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
const WHO: Record<string, string> = { self: 'self-managed', cmo: 'medical officer', ground: 'medical officer, flight surgeon when a link exists' }

interface FeedItem { day: number; kind: 'alert' | 'truth' | 'link' | 'info'; title: string; body: string; status?: 'watch' | 'act' | 'urgent' | 'steady'; ruleId?: string; led?: string }

// which rules count as Keel responding to each kind of scripted event.  A notice that reads the
// change as something else (low mood the day before an illness, say) is not counted as a flag for it.
const RELATED: Record<string, string[]> = {
  illness: ['R-ILL', 'R-SYM-ILL', 'R-V-TEMP', 'R-V-TEMP-HI', 'R-V-HR'],
  co2: ['R-CO2', 'R-CO2H', 'R-COG', 'R-SLEEP'], dehydration: ['R-HYDR', 'R-V-MASS'], sleep_loss: ['R-SLEEP', 'R-COG'],
  decond: ['R-EX', 'R-CARD'], low_mood: ['R-MOOD', 'R-V-MOOD'], spe: ['R-SPE'],
}

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
    const seen = new Map<string, { rank: number; rule: string; day: number }>()
    let linkUp = true
    for (let d = start; d <= t; d++) {
      const ls = linkState(mission, d, false)
      if (ls.available !== linkUp) {
        linkUp = ls.available
        out.push({ day: d, kind: 'link', title: linkUp ? 'Earth link restored' : 'Earth link lost', body: linkUp ? 'Queued summaries go out now.' : `${ls.reason}. Keel keeps working on board.` })
      }
      const a = today(crew.id, d)
      if (a) for (const f of a.findings) {
        // one entry when a finding opens, one if the same open notice comes to look like something
        // else, and one if it gets more serious.  Findings led by a reported symptom or an entered
        // reading are re-raised daily, so they are tracked by rule.
        const id = f.kind === 'personal' || f.kind === 'environment' ? f.key : `${f.kind}:${f.ruleId}`
        const rank = RANK[f.status] * 10 + TIER_RANK[f.tier]
        const prev = seen.get(id)
        const body = `${f.action} (${URGENCY_LABEL[f.urgency].toLowerCase()}; ${WHO[f.tier]})`
        const item = { day: d, kind: 'alert' as const, status: f.status as FeedItem['status'], ruleId: f.ruleId, led: f.kind }
        if (prev === undefined) out.push({ ...item, title: `${STATUS_LABEL[f.status]}: ${f.title}`, body })
        else if (prev.rule !== f.ruleId) out.push({ ...item, title: `Same notice (open since ${shortDay(mission, prev.day)}), read differently: ${f.title}`, body })
        else if (rank > prev.rank) out.push({ ...item, title: `More serious now: ${f.title}`, body })
        seen.set(id, { rank: prev && prev.rule === f.ruleId ? Math.max(prev.rank, rank) : rank, rule: f.ruleId, day: prev?.day ?? d })
      }
      for (const e of events) if (e.onset === d && (e.crew === crewIdx || e.crew < 0)) out.push({ day: d, kind: 'truth', title: `What was scripted: ${e.label.replace(/^Scripted /, '')}`, body: e.type === 'illness' ? `This is the day the scripted illness symptoms begin and the simulated crew member ticks them at check-in. An odd tired or congested day before this is ordinary simulated background, not the script. ${e.detail ?? ''} On any one night, ordinary night-to-night variation of about 3.3 bpm comes on top of the scripted rise.` : 'This is the day the scripted event starts.' })
    }
    return out
  }, [t, start, mission, today, crew.id, events, crewIdx])

  // only a notice whose rule matches the scripted event, opening from three days before it, counts
  // as a response to it; anything else in the window is listed as unrelated
  const related = ev ? RELATED[ev.type] ?? [] : []
  const firstAlert = feed.find((f) => f.kind === 'alert' && !!ev && f.day >= ev.onset - 3 && related.includes(f.ruleId ?? ''))
  const unrelated = feed.filter((f) => f.kind === 'alert' && f !== firstAlert && !!ev && !related.includes(f.ruleId ?? '') && (!firstAlert || f.day <= firstAlert.day))
  // when did the sensors alone say so?  The first day from three days before onset on which the
  // detector's own reading of the pattern (no symptom report needed) matches the scripted event
  const sensorDay = useMemo(() => {
    if (!ev) return null
    for (let d = Math.max(start, ev.onset - 3); d <= t; d++) {
      const pf = today(crew.id, d)?.findings.find((x) => x.kind === 'personal')
      if (pf && (RELATED[ev.type] ?? []).includes(pf.ruleId)) return d
    }
    return null
  }, [ev, start, t, today, crew.id])
  // a detector alert in the three days before onset that read the change as something else
  const misread = ev ? feed.find((f) => f.kind === 'alert' && f.led === 'personal' && f.day >= ev.onset - 3 && f.day < ev.onset && !related.includes(f.ruleId ?? '')) : undefined
  const done = t >= end
  const an = analyses[crew.id]
  const inds = ev ? SHOW[ev.type] ?? ['rhr', 'hrv', 'sleep_h'] : ['rhr', 'hrv', 'sleep_h']
  const pct = ((t - start) / Math.max(1, end - start)) * 100
  const lead = ev && firstAlert ? ev.onset - firstAlert.day : null
  const cur = today(crew.id, t)
  const [val, setVal] = useState<{ det: number; net: number; n: number; fa: number } | null>(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}results/real_eval.json`).then((r) => r.json()).then((j) => { const s = j.ablation.rhr[j.deployed]['1.0']; setVal({ det: s.detection_rate, net: s.net_detection, n: s.n_events, fa: s.fa_per_person_month }) }).catch(() => setVal(null))
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
                  markers={firstAlert && ev && firstAlert.day === ev.onset && ev.onset <= t ? [{ day: ev.onset, label: ev.type === 'illness' ? 'Symptoms + flag' : 'Event + flag', kind: 'alert' as const }]
                    : [...(firstAlert && firstAlert.day <= t ? [{ day: firstAlert.day, label: 'Keel flags', kind: 'alert' as const }] : []), ...(ev && ev.onset <= t ? [{ day: ev.onset, label: ev.type === 'illness' ? 'Symptoms begin' : 'Event starts', kind: 'truth' as const }] : [])]}
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
            : <p className="do">In this scripted case Keel flagged it {ev.type === 'illness' && firstAlert && firstAlert.led !== 'personal' ? 'with her check-in, ' : ''}{lead > 0 ? `${lead} day${lead === 1 ? '' : 's'} before` : lead === 0 ? 'on the day' : `${-lead} day${lead === -1 ? '' : 's'} after`} {ev.type === 'illness' ? 'symptoms began' : 'it started'}, with a specific action and no link to Earth.</p>}
          {ev.type === 'illness' && lead !== null && lead > 0 && <p className="small"><strong>Do not read this as early warning.</strong> On real data an alert a day or two ahead is only somewhat more common than luck would give, and not at the stricter tier.</p>}
          {ev.type === 'illness' && firstAlert && (
            <p className="small"><strong>Sensors alone, or with her check-in?</strong> {firstAlert.led === 'personal'
              ? `The sensors alone showed the pattern on ${shortDay(mission, firstAlert.day)}; no symptom report was needed for this flag.`
              : sensorDay === null
                ? `The flag on ${shortDay(mission, firstAlert.day)} came from the symptoms she ticked at check-in, combined with drifting readings. The sensors alone did not show the illness pattern in this window.`
                : `The flag on ${shortDay(mission, firstAlert.day)} came from the symptoms she ticked at check-in, combined with drifting readings. The sensors alone showed the illness pattern on ${shortDay(mission, sensorDay)}, ${sensorDay - ev.onset} day${sensorDay - ev.onset === 1 ? '' : 's'} after symptoms began.`}</p>
          )}
          {misread && firstAlert && <p className="small">On {shortDay(mission, misread.day)} the detector had already moved, but the readings then looked like something else ("{misread.title.replace(/^[^:]+: /, '')}") and the advice was for that. It is not counted as flagging this event.</p>}
          {unrelated.length > 0 && <p className="small">Keel's log for this replay also has {unrelated.length} {unrelated.length === 1 ? 'entry that is' : 'entries that are'} not about the scripted event. Some are one open notice being read differently as the days pass; some reflect ordinary lapses in the simulated routine, such as a missed exercise session; some are false alerts. That is part of the picture: notices are budgeted at about one false one per person-month in simulation, and real crews would likely see more.</p>}
          {val && <p className="small"><strong>Across all the real data, not this one script:</strong> heart rate alone (not the eleven-channel model in this replay, which is tested in simulation only) flagged {Math.round(val.det * 100)}% of {val.n} real illness episodes, {Math.round(val.net * 100)} points more than luck, at about {val.fa.toFixed(1)} false alerts per person-month. Useful early warning was not shown.</p>}
          <p className="small muted">The replay runs on past the demo's "today" ({shortDay(mission, mission.default_day ?? end)}) to show how the notice ends; those later days are simulated ahead. One scripted event proves nothing by itself. The day of the scripted illness was chosen from a short list when the demo missions were built, by looking at the detector's output for two quiet weeks beforehand{(mission as { staging?: { quiet_two_weeks_before: boolean } }).staging?.quiet_two_weeks_before === false ? '; no candidate day had them, so the first was used and earlier notices appear' : ''}. This replay is not a random draw.</p>
          <div className="row wrap">
            <button className="btn primary" onClick={() => { setMe(crew.id); setDay(firstAlert ? Math.max(firstAlert.day + 1, Math.min(end, ev.onset - 1)) : ev.onset); go('today') }} data-testid="replay-open-today">Open that day as {crew.name.split(' ')[0]}</button>
            <a className="btn" href="#/validation">See the validation</a>
          </div>
        </section>
      )}
    </>
  )
}
