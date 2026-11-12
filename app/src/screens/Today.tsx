import { describeChange, STATUS_LABEL, TIER_LABEL, unusualness } from '../core/analysis'
import { IND, phaseAt, rawSeries, shortDay } from '../core/mission'
import { useApp } from '../state'
import { BodyMap } from '../ui/BodyMap'
import { TrendChart } from '../ui/charts'
import { Card, Chev, Glyph, href, LinkRow, Ring, StatusTag } from '../ui/kit'
import { bandFor } from '../ui/series'

const HEADLINE: Record<string, string> = {
  learning: 'Keel is still learning what is normal for you. Keep wearing the sensor and checking in.',
  steady: 'Your readings are inside your own normal range.',
  watch: 'Something has moved away from your normal. No rush, but look today.',
  act: 'Keel recommends one action today.',
  urgent: 'Do this now.',
}

export function Today() {
  const { mission, model, day, me, today, analyses, entries, link } = useApp()
  const a = today()
  if (!a) return null
  const mine = entries.filter((e) => e.mission === mission.id && e.crew === me)
  const primary = a.findings[0]
  const others = a.findings.slice(1)
  const changes = a.changes.slice(0, 3)
  const ph = phaseAt(mission, day)

  // routine: what the mission day asks of this person
  const checked = mine.some((e) => e.day === day)
  const ex = rawSeries(mission, me, 'ex_min', mine)
  const fd = day - mission.pre_days
  const target = fd >= 0 && mission.simulated ? 120 : 60
  const exDone = ex[day] >= target * 0.8
  const wearOk = !Number.isNaN(rawSeries(mission, me, 'rhr', mine)[day])
  const spotDue = ['mass', 'sbp', 'glucose'].filter((k) => {
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

  const co2 = rawSeries(mission, me, 'co2', mine)
  const rad = rawSeries(mission, me, 'rad', mine)
  const cum = rad.slice(mission.pre_days, day + 1).filter((v) => !Number.isNaN(v)).reduce((x, y) => x + y, 0)

  return (
    <>
      <section className={`card st-${a.status}`} data-testid="today-status" style={{ color: undefined }}>
        <div className={`hero st-${a.status}`}>
          <div className="glyph"><Glyph status={a.status} size={44} /></div>
          <div className="col" style={{ gap: 4, color: 'var(--text)' }}>
            <h1>{STATUS_LABEL[a.status]}</h1>
            <p className="muted">{primary ? primary.title : a.status === 'steady' && changes.length ? `Nothing needs action. ${changes.length === 1 ? 'One reading is' : `${changes.length} readings are`} a little off your usual; Keel is watching.` : HEADLINE[a.status]}</p>
          </div>
        </div>
        {!link.available && mission.simulated && <p className="banner strong" data-testid="offline-banner">No link to Earth right now. Everything on this screen was worked out on this device.</p>}
        {a.adapting && <p className="banner">Day {a.adapting.day} of {a.adapting.name.toLowerCase()}. Your body is expected to change during adaptation, so Keel has widened your normal ranges for now.</p>}
      </section>

      {primary && (
        <section className="card action" data-testid="today-action">
          <span className="tag">Recommended action</span>
          <p className="do">{primary.action}</p>
          <p className="small muted">{TIER_LABEL[primary.tier]}. {primary.tierReason}</p>
          <a className="btn primary block" href={href('alert', primary.key)} data-testid="open-alert">Why, and what next <Chev /></a>
        </section>
      )}
      {others.map((f) => (
        <LinkRow key={f.key} to={href('alert', f.key)} left={<span className={`st-${f.status}`}><Glyph status={f.status} /></span>} title={f.title} sub={f.action} />
      ))}

      <Card title={changes.length ? (primary ? 'What changed' : 'Worth knowing') : 'Nothing unusual'} right={<a className="chip" href={href('trends')}>All trends</a>}>
        {!changes.length && <p className="muted">{a.learning ? 'Baselines appear after about a week of readings.' : 'Every tracked reading is within your usual range over the last three days.'}</p>}
        {changes.map((c) => {
          const b = bandFor(mission, model, analyses[me], me, c.ind, mine)
          return (
            <a className="change" key={c.ind} href={href('trends', c.ind)}>
              <div className="col" style={{ gap: 2 }}>
                <span><strong>{IND[c.ind].label}</strong> <span className="num big" style={{ marginLeft: 6 }}>{Number.isNaN(c.value) ? '–' : c.value.toFixed(IND[c.ind].decimals)}</span> <span className="muted small">{IND[c.ind].unit}</span></span>
                <span className="small">{describeChange(c)}</span>
                <span className="small muted">{unusualness(c)}</span>
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
          <Card title="Today's routine" right={<span className="chip num" title="Days in a row with the sensor worn and a check-in done">{streak}-day streak</span>}>
            <div className="row" style={{ gap: 14 }}>
              <Ring value={weekPct} label={`Exercise this week: ${Math.round(weekPct * 100)} percent of plan`} />
              <div className="col" style={{ gap: 2 }}>
                <strong>Exercise this week</strong>
                <span className="small muted">{Math.round(week.reduce((x, y) => x + y, 0))} of {target * 6} planned minutes. Every session protects bone, muscle and heart.</span>
              </div>
            </div>
            <ul className="list">
              <li><StatusTag status={checked ? 'steady' : 'learning'} label={checked ? 'Check-in done' : 'Daily check-in (1 minute)'} size={18} />{!checked && <a className="btn sm" href={href('checkin')} style={{ marginLeft: 'auto', float: 'right' }}>Start</a>}</li>
              <li><StatusTag status={wearOk ? 'steady' : 'learning'} label={wearOk ? 'Sensor worn last night' : 'No sensor data last night: wear it tonight'} size={18} /></li>
              <li><StatusTag status={exDone ? 'steady' : 'learning'} label={exDone ? 'Exercise done today' : `Exercise: ${Number.isNaN(ex[day]) ? 0 : Math.round(ex[day])} of ${target} min today`} size={18} /></li>
              {spotDue.length > 0 && <li><StatusTag status="learning" label={`Weekly measurement due: ${spotDue.map((k) => IND[k].short.toLowerCase()).join(', ')}`} size={18} /></li>}
            </ul>
          </Card>
          <Card title="Cabin" right={<span className="small muted">{mission.environment}</span>}>
            <div className="grid3">
              <a className="col" style={{ gap: 0, textDecoration: 'none', color: 'inherit' }} href={href('trends', 'co2')}>
                <span className="small muted">Carbon dioxide</span>
                <span><span className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{Number.isNaN(co2[day]) ? '–' : co2[day].toFixed(1)}</span> <span className="small muted">mmHg</span></span>
                <span className="tiny muted">Headache risk rises above 2.5</span>
              </a>
              <a className="col" style={{ gap: 0, textDecoration: 'none', color: 'inherit' }} href={href('trends', 'rad')}>
                <span className="small muted">Radiation, mission total</span>
                <span><span className="num" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{cum.toFixed(0)}</span> <span className="small muted">of 600 mSv career limit</span></span>
                <span className="tiny muted">Today {Number.isNaN(rad[day]) ? '–' : rad[day].toFixed(2)} mSv</span>
              </a>
            </div>
          </Card>
        </div>
      </div>
      <p className="banner">Keel is decision support, not a medical device. It does not diagnose. It shows how your readings compare with your own normal and points to documented countermeasures. {ph.name}.</p>
    </>
  )
}
