import { useMemo } from 'react'
import { REFS } from '../core/analysis'
import { delayFor, fmtDelay, scheduledBlackout } from '../core/link'
import { shortDay } from '../core/mission'
import { useApp } from '../state'
import { XYChart } from '../ui/charts'
import { Card, Icon, Sources, StatusTag } from '../ui/kit'

export function LinkScreen() {
  const { mission, day, setDay, link, linkCut, setLinkCut, outbox, computeMs } = useApp()
  const curve = useMemo(() => {
    const x: number[] = [], y: number[] = []
    for (let t = mission.pre_days; t < mission.days; t++) { x.push(t - mission.pre_days + 1); y.push(delayFor(mission, t).delayS / 60) }
    return { x, y }
  }, [mission])
  const queued = outbox.filter((o) => o.state === 'queued')
  const sent = outbox.filter((o) => o.state === 'sent').slice(-5).reverse()
  const hasLink = mission.kind !== 'personal' && mission.kind !== 'real'
  const upcoming = [...Array(mission.days - day).keys()].map((k) => day + k).find((t) => scheduledBlackout(mission, t))
  // where in a scripted blackout are we, and when is the link expected back?
  let b0 = day, b1 = day
  if (link.scheduledBlackout) {
    while (b0 > 0 && scheduledBlackout(mission, b0 - 1)) b0--
    while (b1 < mission.days - 1 && scheduledBlackout(mission, b1 + 1)) b1++
  }
  return (
    <>
      <h1>Earth link</h1>
      <section className="card" data-testid="link-status">
        <div className={`hero ${link.available ? 'st-steady' : 'st-private'}`}>
          <div className="glyph">{link.available ? <StatusTag status="steady" label="" size={40} /> : <Icon name="link" size={40} />}</div>
          <div className="col" style={{ gap: 4, color: 'var(--text)' }}>
            <h1>{link.available ? (day < mission.pre_days ? 'Direct contact' : `${fmtDelay(link.delayS)} each way`) : 'No link to Earth'}</h1>
            <p className="muted">{link.reason}{link.available && day >= mission.pre_days && !Number.isNaN(link.delayS) ? `. A question and its answer take at least ${fmtDelay(link.delayS * 2)}.` : ''}</p>
          </div>
        </div>
        <p><strong>Keel does not use the link to work.</strong> Detection, explanations and recommended actions all run on the tablet. In this demo one tablet holds the whole simulated crew (on a mission each person's tablet holds their own data); it last re-checked all four in {computeMs < 1000 ? 'a fraction of a second' : `${(computeMs / 1000).toFixed(1)} seconds`}. The link only carries a summary for the flight surgeon when one is available.</p>
        {hasLink && (link.scheduledBlackout && !linkCut ? (
          <div className="col">
            <p className="banner info"><strong>Day {day - b0 + 1} of a {b1 - b0 + 1}-day blackout.</strong> The link is expected back on {shortDay(mission, b1 + 1)}. No flight surgeon can be reached; the medical officer decides on board. Every screen you have used so far was running without it, and {queued.length} daily {queued.length === 1 ? 'summary is' : 'summaries are'} waiting to go.</p>
            <div className="row wrap"><button className="btn" onClick={() => setDay(mission.pre_days + 100)} data-testid="jump-link-up">Move the demo back to {shortDay(mission, mission.pre_days + 100)}, when the link was up, and cut it yourself</button></div>
          </div>
        ) : (
          <div className="row wrap">
            <button className={`btn ${linkCut ? 'primary' : 'danger'}`} onClick={() => setLinkCut(!linkCut)} data-testid="cut-link" aria-pressed={linkCut}>{linkCut ? 'Restore the link' : 'Cut the link now'}</button>
            <span className="small muted">{linkCut ? 'Link cut. Use any screen: nothing stops working. With no link no flight surgeon can be reached; the medical officer decides on board. Restore it when you are done.' : 'Demo control. Cut it, then use any screen: nothing stops working.'}</span>
            {linkCut && queued.length === 0 && <p className="banner info">Today's summary had already gone out before you cut the link, so nothing is waiting yet. The next one is made tomorrow and will wait here until the link is back. <button className="btn sm" onClick={() => setDay(day + 1)} data-testid="link-next-day">Go to tomorrow and see it wait</button></p>}
          </div>
        ))}
      </section>

      {hasLink && (
        <Card title="Queued for the ground" right={<span className="chip num" data-testid="queue-count">{queued.length} waiting</span>}>
          <p className="small muted">One summary per mission day goes out automatically, smaller than a text message. It contains only what you have chosen to share with the flight surgeon in Sharing (by default nothing personal except, under emergency sharing, a count of urgent items still open; plus cabin alerts). While there is no link, summaries wait here and go out together when it returns.</p>
          <p className="small">An emergency does not go to the ground by itself, even with the link up: the daily summary carries only a count of urgent items still open (under emergency sharing), and the medical officer decides whether to call the flight surgeon.</p>
          {queued.length > 0 && <ul className="list small num">{queued.slice(-6).map((o) => <li key={o.day}>{shortDay(mission, o.day)} · waiting</li>)}{queued.length > 6 && <li className="muted">and {queued.length - 6} earlier</li>}</ul>}
          {sent.length > 0 && <><span className="lab small">Recently sent</span><ul className="list small num">{sent.map((o) => <li key={o.day}>{shortDay(mission, o.day)} · sent {o.sentDay !== undefined && o.sentDay !== o.day ? `on ${shortDay(mission, o.sentDay)} (was queued)` : 'same day'}{o.delayS ? `, arrived ${fmtDelay(o.delayS)} later` : ''}</li>)}</ul></>}
          {outbox.length > 0 && <details><summary>See exactly what the latest summary contains ({outbox[outbox.length - 1].bytes} bytes)</summary><pre className="eq" data-testid="summary-payload">{JSON.stringify(JSON.parse(outbox[outbox.length - 1].payload), null, 1)}</pre></details>}
        </Card>
      )}

      {mission.link?.profile === 'mars_transit' && (
        <Card title="Signal delay over this transit">
          <XYChart series={[{ label: 'One-way delay', x: curve.x, y: curve.y }]} xLabel="Flight day" yLabel="Minutes, one way" ariaLabel="One-way signal delay in minutes over the transit" xDecimals={0} yDecimals={1} yMin={0} vline={day >= mission.pre_days ? { x: day - mission.pre_days + 1, label: 'Today' } : undefined} height={200} />
          <p className="small muted">Simulated with simplified geometry (circular, coplanar orbits). On this outbound leg the delay grows from seconds to about {Math.max(...curve.y).toFixed(0)} minutes. After arrival it keeps growing: Earth to Mars is about 4 minutes at closest approach and about 24 minutes at the greatest distance.{upcoming !== undefined && upcoming > day ? ` Next scripted blackout: ${shortDay(mission, upcoming)}.` : ''}</p>
        </Card>
      )}
      {mission.link?.profile === 'lunar' && <Card title="Lunar link"><p className="small">Light takes about 1.3 seconds each way between Earth and the Moon; NASA expects 3 to 14 seconds of operational latency on lunar missions. Short outages still happen when a rover drives out of line of sight of its relay, which is what this mission's scripted blackout shows.</p></Card>}

      <Card title="Why this matters">
        <p className="small">On the International Space Station a flight surgeon is seconds away by voice, talks privately with each crew member about once a week, and the ground team follows exercise and cabin-air data. Routine vital signs are not streamed to the ground, so Keel proposes more self-monitoring than ISS crews have today, on purpose. NASA's own planning documents say that on a Mars mission delays and blackouts will end reliable real-time telemedicine, and that medical decisions must move on board.</p>
        <Sources ids={['1', '2', '4', '8', '9', '12', '13']} refs={REFS} />
      </Card>
    </>
  )
}
