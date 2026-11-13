import { readiness, READY_LABEL } from '../core/readiness'
import { SYMPTOMS } from '../core/mission'
import { alertFields, alertState, contextNote } from '../core/alerts'
import { useAutoAlert } from '../ui/useAutoAlert'
import { STATUS_LABEL, unusualness, URGENCY_LABEL, WHO_LABEL } from '../core/analysis'
import { deployedScore, episodes } from '../core/detect'
import { TempEntry } from '../ui/TempEntry'
import { AskCmo } from '../ui/AskCmo'
import { RepeatEntry } from '../ui/RepeatEntry'
import { GlucoseUnit } from '../ui/GlucoseUnit'
import { CATEGORIES, IND, rawSeries, shortDay } from '../core/mission'
import { useEffect, useState } from 'react'
import { LEVELS, SHARE_CATEGORIES, type ShareCategory } from '../core/sharing'
import { useApp } from '../state'
import { store } from '../db'
import { BodyMap, SYSTEMS } from '../ui/BodyMap'
import { TrendChart } from '../ui/charts'
import { Card, Chev, Glyph, href, LinkRow, ReadingLog, Ring, StatusTag } from '../ui/kit'
import { bandFor } from '../ui/series'

const CAT: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))
const LEVEL_WORD: Record<string, string> = Object.fromEntries(LEVELS.map((l) => [l.id, l.label]))

const HEADLINE: Record<string, string> = {
  learning: 'Keel is still learning what is normal for you. Keep wearing the sensor and checking in.',
  steady: 'No change detected in your readings. Steady does not mean well: if you feel unwell, say so.',
  watch: 'Something has moved away from your normal. No rush, but look today.',
  act: 'Keel recommends one action today.',
  urgent: 'Do this now.',
}

export function Today() {
  const { mission, model, day, me, today, analyses, entries, link, sharing, setShare, actions, logAction } = useApp()
  // a reading just entered here (the thermometer box) that is "act now" alerts the crew automatically, as on Check-in
  const auto = useAutoAlert((today(me, day)?.findings ?? []).some((f) => f.status === 'urgent' && (f.readings ?? []).some((r) => Date.now() - r.ts < 120e3)))
  const [intro, setIntro] = useState(false)
  useEffect(() => { void store.kv<boolean>('intro-dismissed').then((v) => setIntro(!v)) }, [])
  const a = today()
  if (!a) return null
  const mine = entries.filter((e) => e.mission === mission.id && e.crew === me)
  const primary = a.findings[0]
  const others = a.findings.slice(1)
  // the readings the recommended action rests on come first, then the largest other changes
  // only readings that actually moved enough to matter (outside the band, or notably unusual) are listed
  const evidence = primary && !primary.crewWide ? primary.changes.filter((c) => c.notable || c.daysOut > 0).map((c) => c.ind) : []
  const changes = [...a.changes.filter((c) => evidence.includes(c.ind)), ...a.changes.filter((c) => !evidence.includes(c.ind) && c.notable)].slice(0, 4)
  // sharing an alert opens only its main area; mood and symptoms stay as the crew member set them
  const shareCats = (primary?.categories ?? []).slice(0, 1).filter((c): c is ShareCategory => (SHARE_CATEGORIES as readonly string[]).includes(c))
  const needsCmo = !!primary && primary.kind === 'personal' && primary.tier !== 'self' && !shareCats.every((c) => sharing[me]?.cmo[c] === 'detail')
  const crew = mission.crew.find((c) => c.id === me)
  // "Steady" is shown only when nothing at all is amber: an area worth a look, or cabin CO2 above the advisory line, changes the headline
  // the personal headline is about the person; cabin air has its own banner and card
  const softAreas = SYSTEMS.filter((x) => a.systems[x.id] === 'watch' && x.id !== 'environment').map((x) => x.label.toLowerCase())
  const shown: typeof a.status = a.status === 'steady' && softAreas.length ? 'watch' : a.status
  const liveRules = new Set(a.findings.map((x) => x.ruleId))
  const waiting = a.openItems.filter((x) => !(x.day === day && liveRules.has(x.ruleId)))

  // routine: what the mission day asks of this person
  const checkedByMe = mine.some((e) => e.day === day)
  const checked = checkedByMe || !Number.isNaN(rawSeries(mission, me, 'mood', mine)[day])
  const an = analyses[me]
  const notices30 = an ? episodes(deployedScore(an.scored, model), model.thresholds.notice, model.params.merge_gap, day).filter(([s0]) => s0 > day - 30).length : 0
  const sleepLast = rawSeries(mission, me, 'sleep_h', mine)[day]
  const ex = rawSeries(mission, me, 'ex_min', mine)
  const fd = day - mission.pre_days
  const target = fd >= 0 && mission.simulated ? 120 : 60
  const exDone = ex[day] >= target * 0.8
  const wearOk = !Number.isNaN(rawSeries(mission, me, 'rhr', mine)[day])
  // the thermometer is on the list so that a personal baseline exists before a fever question comes up
  const askingTemp = a.findings.some((x) => ['R-ILL', 'R-SYM-ILL', 'R-V-TEMP', 'R-V-TEMP-HI'].includes(x.ruleId))
  const spotDue = ['mass', 'sbp', 'glucose', 'temp_oral'].filter((k) => !(k === 'temp_oral' && askingTemp)).filter((k) => {
    const v = rawSeries(mission, me, k, mine)
    for (let t = day; t > day - 7 && t >= 0; t--) if (!Number.isNaN(v[t])) return false
    return true
  })
  let streak = 0
  for (let t = day - (wearOk ? 0 : 1); t >= 0; t--) {
    const worn = !Number.isNaN(rawSeries(mission, me, 'rhr', mine)[t])
    const logged = !Number.isNaN(rawSeries(mission, me, 'mood', mine)[t])
    if (worn && logged) streak++
    else break
  }
  const week = ex.slice(Math.max(0, day - 6), day + 1).filter((v) => !Number.isNaN(v))
  const weekPct = week.length ? week.reduce((x, y) => x + y, 0) / (target * 6) : 0

  const crewPct = mission.crew.map((c) => rawSeries(mission, c.id, 'ex_min', entries.filter((e) => e.mission === mission.id && e.crew === c.id)).slice(Math.max(0, day - 6), day + 1).filter((v) => !Number.isNaN(v)).reduce((x, y) => x + y, 0) / (target * 6)).reduce((x, y) => x + Math.min(1.2, y), 0) / mission.crew.length
  const co2 = rawSeries(mission, me, 'co2', mine)
  const rad = rawSeries(mission, me, 'rad', mine)
  const cum = rad.slice(mission.pre_days, day + 1).filter((v) => !Number.isNaN(v)).reduce((x, y) => x + y, 0)

  return (
    <>
      <GlucoseUnit />
      {intro && mission.simulated && (
        <section className="card intro" data-testid="intro">
          <p className="small"><strong>When Earth can't answer, Keel tells you what to do and who to tell.</strong> Responds at once to dangerous readings you enter. You choose who sees what. It also watches your readings against your own normal. Demo: {crew?.name.split(' ')[0]}'s tablet, simulated {mission.title}.</p>
          <div className="row wrap">
            <a className="btn primary sm" href={href('checkin', 'demo')} data-testid="intro-danger">Demo: enter a dangerous reading</a>
            <a className="btn sm" href={href('replay')} data-testid="intro-replay">Demo: replay a scripted event</a>
            <a className="btn sm" href={href('validation')}>The evidence</a>
            <button className="btn sm" onClick={() => { setIntro(false); void store.putKv('intro-dismissed', true) }} aria-label="Hide this introduction">Hide</button>
          </div>
        </section>
      )}
      <section className={`card st-${shown}`} data-testid="today-status" style={{ color: undefined }}>
        <div className={`hero st-${shown}`}>
          <div className="glyph"><Glyph status={shown} size={44} /></div>
          <div className="col" style={{ gap: 4, color: 'var(--text)' }}>
            <h1>{a.staleDays >= 2 && !primary ? 'No recent data' : STATUS_LABEL[shown]}</h1>
            <p className="muted">{primary ? primary.title : a.staleDays >= 2 ? `No readings for ${a.staleDays} days, so Keel cannot say how you are. Wear the sensor tonight and do a check-in.` : shown === 'watch' && !primary ? `No action needed yet. Keep an eye on: ${softAreas.join(', ')}.` : a.status === 'steady' && changes.length ? `Nothing needs action. ${changes.length === 1 ? 'One reading is' : `${changes.length} readings are`} a little off your usual; Keel is watching.` : HEADLINE[a.status]}</p>
            <p className="small muted" data-testid="commander-sees">Your commander sees: {READY_LABEL[readiness(a).tier]}, with no reason.</p>
            {primary?.kind === 'personal' && <p className="small muted" data-testid="based-on">{Object.entries(a.features.sym ?? {}).some(([, v]) => v > 0) ? `Triggered by readings that drifted from your normal, together with symptoms you reported in the last three days (${Object.entries(a.features.sym ?? {}).filter(([, v]) => v > 0).map(([k]) => SYMPTOMS.find((x) => x.id === k)?.label.toLowerCase() ?? k).join(', ')}).` : 'Triggered by readings that drifted from your normal, with no symptoms reported.'}</p>}
          </div>
        </div>
        {a.status === 'steady' && a.co2Advisory !== null && <p className="banner info"><strong>Cabin CO2 is {a.co2Advisory.toFixed(1)} mmHg.</strong> Headaches get more likely the higher it goes; 2.5 is Keel's advisory line and 3.0 its alert. If you have a headache, log it at check-in and move to better airflow.</p>}
        {mission.simulated && <p className="small muted">Demo crew member, simulated readings.</p>}
        {a.adapting && <p className="banner">Day {a.adapting.day} of {a.adapting.name.toLowerCase()}. Your body is expected to change during adaptation, so Keel has widened your normal ranges for now.</p>}
      </section>

      {primary && (
        <section className="card action" data-testid="today-action">
          <span className="tag plain">Recommended action</span>
          <p className="do">{primary.action}</p>
          <p className="small"><strong>When:</strong> {URGENCY_LABEL[primary.urgency].toLowerCase()}. <strong>Who:</strong> {(primary.who ?? WHO_LABEL[primary.tier]).toLowerCase()}.</p>
          <p className="small">{primary.tierReason}</p>
          <AskCmo f={primary} />
          {primary.steps.filter((q) => /^For whoever is with you/.test(q)).slice(0, 1).map((q) => <p key={q} className="banner strong small">{q}</p>)}
          <RepeatEntry f={primary} />
          {primary.status === 'urgent' && !primary.crewWide && (() => {
            const urgentNow = [primary, ...others].filter((x) => x.status === 'urgent')
            const akey = `alert|${urgentNow.map((x) => x.key).sort().join('+')}`
            // an item counts as alerted, and acknowledged, if any earlier alert covered it
            const { sent, acks } = alertState(actions, me, urgentNow.map((x) => x.key))
            const onlyCmo = urgentNow.every((x) => x.cmoOnly && !x.patientIsCmo)
            const on = sharing[me]?.emergency !== false
            return <div className="col">
              {auto.counting && <div className="banner strong" role="alert"><p><strong>Alerting the medical officer and commander in {auto.autoLeft} s.</strong></p><p className="small" data-testid="cancel-auto-alert-today">A typing mistake? Withdraw that reading in the list below; the alert then goes only for anything else.</p></div>}
              {!sent && <button className="btn alert block" style={{ minHeight: 72, fontSize: '1.2rem' }} onClick={() => void logAction({ crew: me, alertKey: akey, day, did: 'Alerted the crew', feel: null, ...alertFields(urgentNow, '', contextNote(a.findings)) })} data-testid="alert-crew">{onlyCmo ? 'Alert the medical officer now' : 'Alert the medical officer and commander now'}</button>}
              {sent && !auto.escalated && !acks.some((x) => /medical officer/.test(x.note)) && Date.now() - sent.ts > 5 * 60e3 && <button className="btn alert block" onClick={() => void logAction({ crew: me, alertKey: akey, day, did: 'Alerted the crew', feel: null, ...alertFields(urgentNow, ' (no answer after 5 minutes: sent again)') })} data-testid="alert-again">No answer yet: alert them again</button>}
              {sent && <p className="banner strong" role="status"><strong>Alert sent at {new Date(sent.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}.</strong> {acks.length ? acks.map((x) => `Acknowledged ${x.note} at ${new Date(x.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}.`).join(' ') : 'Not acknowledged yet: it stays at the top of their Crew screens until the medical officer does.'}</p>}
              {sent && <p className="small">Until it is acknowledged, Keel sends it again every five minutes while this screen is open; it cannot once the tablet is put away.</p>}
              <p className="small">{on ? sent ? 'The details are visible on their Crew screens (emergency sharing).' : 'The details are visible on their Crew screens (emergency sharing). Saving an urgent check-in alerts them after ten seconds; this button alerts them now.' : 'Emergency sharing is off: the alert says only that you need help, not why.'}</p>
            </div>
          })()}
          {others.filter((x) => x.status === 'urgent').length > 0 && (
            <div className="col" data-testid="also-now">
              <span className="lab">Also act now</span>
              <ol className="list steps">{others.filter((x) => x.status === 'urgent').map((x) => <li key={x.key}><span className="col" style={{ gap: 6 }}><span><strong>{x.title}.</strong> {x.action}</span>{x.steps.filter((q) => /^For whoever is with you/.test(q)).slice(0, 1).map((q) => <span key={q} className="banner strong small">{q}</span>)}<RepeatEntry f={x} /></span></li>)}</ol>
            </div>
          )}
          {primary.status === 'urgent' && others.some((x) => ['R-ILL', 'R-SYM-ILL'].includes(x.ruleId)) && <div className="col" style={{ gap: 4 }}><p className="small"><strong>After the above:</strong> an infection-like notice is also open, so take your temperature when you can.</p><TempEntry secondary /></div>}
          {(primary.also ?? []).length > 0 && <div><p className="small"><strong>Also today, from the same readings:</strong></p><ul className="list small">{primary.also!.map((x) => <li key={x.title}><strong>{x.title}.</strong> {x.action}</li>)}</ul></div>}
          {['R-ILL', 'R-SYM-ILL', 'R-V-TEMP', 'R-V-TEMP-HI'].includes(primary.ruleId) && primary.status !== 'urgent' ? <TempEntry /> : <><ReadingLog readings={primary.readings ?? []} title={[primary, ...others].filter((x) => x.status === "urgent").length > 1 ? "Readings behind the first item" : "Readings this is based on"} /></>}
          <a className="btn block" href={href('alert', primary.key)} data-testid="open-alert">Why, and what next <Chev /></a>
          {needsCmo && <button className="btn block" onClick={() => shareCats.forEach((c) => setShare(me, 'cmo', c, 'detail'))} data-testid="today-share-cmo">Share {shareCats.map((c) => CAT[c].toLowerCase()).join(', ')} in full detail with the medical officer</button>}
          {needsCmo && <p className="small muted">This changes one setting: <strong>{shareCats.map((c) => CAT[c]).join(', ')}</strong> goes from "{LEVEL_WORD[sharing[me]?.cmo[shareCats[0]] ?? 'none']}" to "Full detail" for the medical officer, until you change it back in Sharing. Readings in other areas, such as sleep or reaction time, stay as you set them. <strong>You still need to tell them.</strong></p>}
          {primary.kind === 'personal' && primary.tier !== 'self' && !needsCmo && <p className="small muted">The medical officer can see this alert.</p>}
        </section>
      )}
      {waiting.length > 0 && (
        <Card title="Waiting for the medical officer to close">
          <ul className="list small">{waiting.map((x) => <li key={x.key}><strong>{x.title}</strong> <span className="muted">({shortDay(mission, x.day)}{x.withdrawn ? '; you withdrew the reading as a typing mistake' : ''}{x.settled ? '; your repeat was back on the safe side' : ''})</span></li>)}</ul>
          <p className="small muted">These came from your own entries. A later normal reading does not close them: the medical officer does, with a note{crew?.role === 'cmo' ? ' (for you, the commander)' : ''}.</p>
        </Card>
      )}
      {mission.kind === 'personal' && <p className="banner strong">This is your own imported data. Keel's advice is written for a space crew with a medical officer on board. If a reading or symptom worries you, contact a doctor; in an emergency call your local emergency number.</p>}
      {!link.available && mission.simulated && <p className="banner" data-testid="offline-banner">No link to Earth right now. Everything on this screen was worked out on this device.</p>}
      {a.status === 'urgent' ? (others.filter((f) => f.status !== 'urgent').length > 0 && (
        <details className="card"><summary>After the above, still to do: {others.filter((f) => f.status !== 'urgent').map((f) => `${f.title} (${f.status === 'act' ? 'act today' : 'worth a look'})`).join('; ')}</summary>
          {others.filter((f) => f.status !== 'urgent').map((f) => <LinkRow key={f.key} to={href('alert', f.key)} left={<span className={`st-${f.status}`}><Glyph status={f.status} /></span>} title={f.title} sub={f.action} />)}
        </details>
      )) : (<>
        {others.map((f) => (
        <LinkRow key={f.key} to={href('alert', f.key)} left={<span className={`st-${f.status}`}><Glyph status={f.status} /></span>} title={f.title} sub={f.action} />
      ))}
      </>)}

      {askingTemp && primary && primary.status !== 'urgent' && !['R-ILL', 'R-SYM-ILL', 'R-V-TEMP', 'R-V-TEMP-HI'].includes(primary.ruleId) && (
        <Card title="Also: take your temperature"><TempEntry /></Card>
      )}
      <Card title={changes.length ? (primary ? (primary.kind === 'vital' || primary.kind === 'symptom' ? 'Other changes in your readings (not the cause of the alert above)' : 'What changed') : 'Worth knowing') : 'Nothing unusual'} right={<a className="chip" href={href('trends')}>All trends</a>}>
        {!changes.length && <p className="muted">{a.learning ? 'Baselines appear after about a week of readings.' : 'Every tracked reading is within your usual range over the last three days.'}</p>}
        {changes.map((c) => {
          const b = bandFor(mission, model, analyses[me], me, c.ind, mine)
          return (
            <a className="change" key={c.ind} href={href('trends', c.ind)}>
              <div className="col" style={{ gap: 2 }}>
                <span><strong>{IND[c.ind].label}</strong> <span className="num big" style={{ marginLeft: 6 }}>{Number.isNaN(c.value) ? '–' : c.value.toFixed(IND[c.ind].decimals)}</span> <span className="muted small">{IND[c.ind].unit}</span></span>
                <span className="small">{c.ind === 'sleep_mid' ? `The middle of your sleep was ${Math.abs(c.value).toFixed(1)} h ${c.value >= 0 ? 'after' : 'before'} the schedule; you usually sleep ${Math.abs(c.expected).toFixed(1)} h ${c.expected >= 0 ? 'after' : 'before'} it.` : `${c.direction === 'higher' ? 'Higher than' : 'Lower than'} your usual ${c.expected.toFixed(IND[c.ind].decimals)}.`} {unusualness(c)}{c.ind === 'temp' ? ' Wrist skin temperature, not a fever reading.' : ''}</span>
              </div>
              <TrendChart compact values={b.values} lo={b.lo} hi={b.hi} from={day - 20} to={day} labelFor={(t) => shortDay(mission, t)} unit={IND[c.ind].unit} decimals={IND[c.ind].decimals} concern={IND[c.ind].concern} ariaLabel={`${IND[c.ind].label}, last three weeks`} />
            </a>
          )
        })}
      </Card>

      <div className="grid2">
        <Card title="Your body at a glance">
          <BodyMap systems={a.systems} key={`${me}-${day}`} />
        </Card>
        <div className="col" style={{ gap: 14 }}>
          <Card id="today-routine" title="Today's routine" right={<span className="chip num" title="Days in a row with the sensor worn and a check-in done">{streak}-day streak</span>}>
            <div className="row" style={{ gap: 14 }}>
              {!a.exerciseHold && <Ring value={weekPct} label={`Exercise this week: ${Math.round(weekPct * 100)} percent of plan`} />}
              <div className="col" style={{ gap: 2 }}>
                <strong>{a.exerciseHold ? 'Exercise: paused' : 'Exercise this week'}</strong>
                <span className="small muted">{a.exerciseHold ? `The plan is suspended until the medical officer clears you. Minutes logged this week, before the pause or by the exercise devices: ${Math.round(week.reduce((x, y) => x + y, 0))}.` : `${Math.round(week.reduce((x, y) => x + y, 0))} of ${target * 6} planned minutes. Every session protects bone, muscle and heart.`}</span>
              </div>
            </div>
            {mission.crew.length > 1 && <p className="small muted">Crew goal this week: <strong className="num" style={{ color: 'var(--text)' }}>{Math.round(crewPct * 100)}%</strong> of planned exercise done together. Individual numbers stay private.</p>}
            <a className="btn sm" href={href('checkin')} data-testid="report-symptom">Report a symptom now</a>
            <ul className="list">
              <li><StatusTag status={checked ? 'steady' : 'learning'} label={checkedByMe ? 'Check-in done' : checked ? 'Check-in done (simulated)' : 'Daily check-in (about a minute)'} size={18} />{!checked && <a className="btn sm" href={href('checkin')} style={{ marginLeft: 'auto', float: 'right' }}>Start</a>}</li>
              <li><StatusTag status={wearOk ? 'steady' : 'learning'} label={wearOk ? 'Sensor worn last night' : 'No sensor data last night: wear it tonight'} size={18} /></li>
              <li><StatusTag status={a.exerciseHold ? 'watch' : exDone ? 'steady' : 'learning'} label={a.exerciseHold ? 'No exercise until the medical officer clears you' : exDone ? 'Exercise done today' : `Exercise: ${Number.isNaN(ex[day]) ? 0 : Math.round(ex[day])} of ${target} min today`} size={18} /></li>
              {spotDue.length > 0 && <li><StatusTag status="learning" label={`Weekly measurement due: ${spotDue.map((k) => IND[k].label.toLowerCase()).join(', ')}`} size={18} /> <a className="btn sm" href={href('checkin', 'measure')} data-testid="enter-measurements">Enter</a></li>}
              {!Number.isNaN(sleepLast) && sleepLast < 5.5 && <li><StatusTag status="watch" label={`Sleep last night ${sleepLast.toFixed(1)} h. The scheduled sleep period is 8.5 h.`} size={18} /></li>}
            </ul>
          </Card>
          <Card title="Cabin" right={<span className="small muted">{mission.environment}</span>}>
            <div className="grid3">
              <a className="col" style={{ gap: 0, textDecoration: 'none', color: 'inherit' }} href={href('trends', 'co2')}>
                <span className="small muted">Carbon dioxide {a.co2Advisory !== null && <StatusTag status="watch" label="" size={15} />}</span>
                <span><span className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{Number.isNaN(co2[day]) ? '–' : co2[day].toFixed(1)}</span> <span className="small muted">mmHg</span></span>
                <span className="tiny muted">{a.co2Advisory !== null ? 'Above Keel\'s advisory line of 2.5' : 'Advisory line 2.5, alert at 3.0'}</span>
              </a>
              <a className="col" style={{ gap: 0, textDecoration: 'none', color: 'inherit' }} href={href('trends', 'rad')}>
                <span className="small muted">Radiation dose</span>
                <span><span className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{cum.toFixed(0)}</span> <span className="small muted">mSv this mission (dosimeter estimate)</span></span>
                <span className="tiny muted">Today {Number.isNaN(rad[day]) ? '–' : rad[day].toFixed(2)} mSv.{fd > 20 && mission.flight_days ? ` At this mission's average daily rate so far, about ${Math.round((cum / (fd + 1)) * mission.flight_days / 10) * 10} mSv by flight day ${mission.flight_days}, the end of this leg; ${Math.round((cum / (fd + 1)) * mission.flight_days * 2 / 10) * 10 > 600 ? 'a return trip at the same rate would take the total past the 600 mSv career limit.' : `a return trip at the same rate would bring the total to about ${Math.round((cum / (fd + 1)) * mission.flight_days * 2 / 10) * 10} mSv.`}` : ''} The 600 mSv career limit also counts earlier flights.</span>
              </a>
            </div>
          </Card>
        </div>
      </div>
      <p className="small muted">In the last 30 days the readings detector opened {notices30} notice{notices30 === 1 ? '' : 's'} (not counting fixed safety lines or symptoms you reported). Keel can be wrong: expect one or two false notices a month, possibly more, and most notices turn out to be nothing. <a href={href('validation')}>How often it is right</a></p>
      <p className="banner">Keel is decision support, not a medical device. It does not diagnose. It shows how your readings compare with your own normal and points to documented countermeasures.</p>
    </>
  )
}
