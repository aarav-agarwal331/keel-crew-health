import { dayLabel } from '../core/mission'
import { useApp } from '../state'
import { Card, href, LinkRow, Seg } from '../ui/kit'

export function More() {
  const { mission, missions, loadMission, day, setDay, me, setMe, theme, setTheme, computeMs, resetLocal } = useApp()
  return (
    <>
      <h1>More</h1>
      <div className="col">
        <LinkRow to={href('replay')} title="Mission replay" sub="Watch a health event develop, get detected, and turn into an action, in under a minute." />
        <LinkRow to={href('link')} title="Earth link" sub="Signal delay, blackouts, what is queued for the ground. Includes the demo control that cuts the link." />
        <LinkRow to={href('sharing')} title="Sharing and privacy" sub="You choose what each role can see. Each time the medical officer or commander opens Crew, it is logged." />
        <LinkRow to={href('validation')} title="Does it work? Validation" sub="Detection rates and false alerts measured on real wearable data and on simulated missions." />
        <LinkRow to={href('method')} title="How Keel works, and its limits" sub="The method in plain language, with equations and limitations." />
        <LinkRow to={href('guide')} title="Guide: measurements and everything Keel can recommend" sub="What each reading means, how to take it, why space changes it, and the full list of actions with sources." />
        <LinkRow to={href('data')} title="Data sources and sensors" sub="Switch mission, import your own wearable data, connect a heart-rate strap." />
      </div>

      <Card title="Demo controls">
        <p className="small muted">These exist only so you can explore the demo: switch crew member, data set and mission day.</p>
        <div className="field">
          <label htmlFor="who">Whose device is this?</label>
          <select id="who" value={me} onChange={(e) => setMe(e.target.value)} data-testid="who">
            {mission.crew.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.role_label}</option>)}
          </select>
          <span className="small muted">On a real mission each crew member has their own Keel. Here you can switch to see each person's view.</span>
        </div>
        <div className="field">
          <label htmlFor="mis">Data set</label>
          <select id="mis" value={mission.id} onChange={(e) => void loadMission(e.target.value)} data-testid="mission-select">
            {missions.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.kind})</option>)}
          </select>
          <span className="small muted">{mission.blurb}</span>
        </div>
        <div className="field">
          <label htmlFor="day">Mission clock: {dayLabel(mission, day)}</label>
          <input id="day" type="range" min={0} max={mission.days - 1} value={day} onChange={(e) => setDay(Number(e.target.value))} data-testid="day-slider" />
          <div className="row wrap">
            <button className="btn sm" onClick={() => setDay(day - 1)}>− 1 day</button>
            <button className="btn sm" onClick={() => setDay(day + 1)} data-testid="day-plus">+ 1 day</button>
            {mission.default_day !== undefined && <button className="btn sm" onClick={() => setDay(mission.default_day!)}>Back to the demo day</button>}
          </div>
        </div>
      </Card>
      <Card title="This tablet">
        <div className="row wrap">
          <span className="lab">Display</span>
          <Seg label="Colour theme" value={theme} onChange={setTheme} options={[{ id: 'dark', label: 'Dark (cabin night)' }, { id: 'light', label: 'Light' }]} />
        </div>
        <p className="small muted">Keel last re-checked the whole crew's readings on this tablet in {computeMs.toFixed(0)} milliseconds. There is no server.</p>
        <button className="btn sm danger" onClick={() => { if (confirm('Delete every check-in, log, sharing setting and imported data set stored on this device?')) void resetLocal() }}>Erase my data on this device</button>
      </Card>
      <p className="banner">Keel is an independent student project for the 2026 NASA Space Apps Challenge. It is not a NASA product and is not endorsed by NASA. It is decision support, not a medical device.</p>
    </>
  )
}
