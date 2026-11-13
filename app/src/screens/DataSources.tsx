import { useEffect, useRef, useState } from 'react'
import { bleSupported, connectStrap, rmssd, type StrapSession } from '../core/ble'
import { parseAny, toMission } from '../core/importers'
import { dayLabel } from '../core/mission'
import { useApp } from '../state'
import { TrendChart } from '../ui/charts'
import { Card, go, Simulated } from '../ui/kit'

export function DataSources() {
  const { mission, missions, loadMission, addMission, me, day, saveEntry, entries } = useApp()
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [strap, setStrap] = useState<StrapSession | null>(null)
  const [hr, setHr] = useState<number[]>([])
  const [rr, setRr] = useState<number[]>([])
  const [bleErr, setBleErr] = useState('')
  const [saved, setSaved] = useState('')
  const session = useRef<StrapSession | null>(null)
  useEffect(() => () => session.current?.stop(), [])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setErr(''); setMsg('')
    try {
      const text = await file.text()
      const res = parseAny(file.name, text)
      const m = toMission(res, 'My data')
      // imported watch data runs on the heart-rate-only model calibrated on real people, not the full-sensor mission model
      await addMission(m, 'model_import')
      setMsg(`Imported ${res.rows.length} days from ${res.format}. ${res.notes.join(' ')}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }
  const connect = async () => {
    setBleErr('')
    try {
      const s = await connectStrap((x) => { setHr((p) => [...p.slice(-299), x.hr]); if (x.rr.length) setRr((p) => [...p.slice(-399), ...x.rr]) }, () => { setStrap(null); session.current = null })
      session.current = s
      setStrap(s)
      setHr([]); setRr([])
    } catch (e) {
      setBleErr(e instanceof Error ? e.message : String(e))
    }
  }
  const stable = hr.slice(-60)
  const restHr = stable.length >= 30 ? [...stable].sort((a, b) => a - b)[Math.floor(stable.length * 0.2)] : NaN
  const hrv = rmssd(rr.slice(-150))
  const saveReading = async () => {
    // a strap reading is a spot check: it is logged and checked against the fixed safety lines, and it does
    // not overwrite the wearable's overnight resting heart rate
    const values: Record<string, number> = { rhr_spot: Math.round(restHr) }
    if (!Number.isNaN(hrv)) values.hrv = Math.round(hrv)
    // merge with the day's check-in: a strap reading must never erase symptoms, mood or other entries
    const cur = entries.find((e) => e.mission === mission.id && e.crew === me && e.day === day)
    await saveEntry({ crew: me, day, values: { ...(cur?.values ?? {}), ...values }, symptoms: cur?.symptoms ?? [], meds: cur?.meds, photos: cur?.photos }, ['rhr_spot'])
    setSaved(`Saved a resting heart rate check of ${values.rhr_spot} bpm${values.hrv ? ` and HRV ${values.hrv} ms` : ''} for ${dayLabel(mission, day)}.`)
  }

  return (
    <>
      <h1>Data sources and sensors</h1>
      <Card title="Data set in use" right={<Simulated real={!mission.simulated} source={mission.source?.name} />}>
        <p><strong>{mission.title}.</strong> {mission.blurb}</p>
        {mission.source?.citation && mission.kind === 'real' && <p className="small muted">{mission.source.citation} License: {mission.source.license}. {mission.source.url && <a href={mission.source.url} target="_blank" rel="noreferrer">Source</a>}</p>}
        <div className="col">
          {missions.map((m) => (
            <button key={m.id} className="linkrow" onClick={() => void loadMission(m.id)} aria-pressed={m.id === mission.id} data-testid={`load-${m.id}`}>
              <span className="col" style={{ gap: 2 }}><strong>{m.title}</strong><span className="small muted">{m.blurb}</span></span>
              <span className="tag">{m.id === mission.id ? 'In use' : m.kind}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Import your own wearable data">
        <p className="banner"><strong>Imported data uses its own detector settings.</strong> The on-board model is set for the full sensor set and, given only a watch's overnight heart rate, would almost never alert. So an import runs on a heart-rate-only model whose thresholds were calibrated on 251 real people; its expected performance is the "heart rate alone" row on the Validation screen (about one false notice a month). Activity, sleep and the other readings in the file are shown but not used for alerts. One more difference: the model was calibrated on resting heart rate computed from raw night-time samples, while an import gives the watch maker's own daily resting heart rate, which is smoothed differently, so its false-alert rate on your data may differ.</p>
        <p className="small muted">Read in this browser only; the file is never uploaded. Keel then learns your baseline from it and shows the same Today and Trends screens for you. Supported: a CSV with a <code>date</code> column and any of <code>rhr, hrv, spo2, temp, sleep_h, ex_min, mood, fluid, mass, sbp, glucose</code>; Fitbit export JSON (resting heart rate, sleep); Apple Health <code>export.xml</code>.</p>
        <div className="row wrap">
          <label className="btn primary" htmlFor="file">Choose a file</label>
          <input id="file" className="sr" type="file" accept=".csv,.json,.xml,.txt,text/csv,application/json,text/xml" onChange={(e) => void onFile(e.target.files?.[0])} data-testid="import-file" />
          <a className="btn" href={`${import.meta.env.BASE_URL}samples/sample_wearable.csv`} download>Download a sample CSV</a>
        </div>
        {msg && <div role="status" className="col"><p>{msg}</p><button className="btn" onClick={() => go('today')}>Open Today for this data</button></div>}
        {err && <p className="banner strong" role="alert">{err}</p>}
        <p className="tiny muted">Treat alerts on your own data as illustrations: the evidence comes from other people's watches, not yours.</p>
      </Card>

      <Card title="Live heart-rate strap">
        <p className="small muted">Connect any Bluetooth chest strap or watch that broadcasts the standard heart-rate service. Lie still for two minutes after waking, then save the reading as today's resting heart rate and HRV.</p>
        {!bleSupported() && <p className="banner">This browser has no Web Bluetooth (Safari and Firefox do not). Use Chrome or Edge on a laptop or Android tablet, or enter the reading by hand in Check-in.</p>}
        {bleSupported() && !strap && <button className="btn primary" onClick={() => void connect()} data-testid="ble-connect">Connect a strap</button>}
        {bleErr && <p className="banner strong" role="alert">{bleErr}</p>}
        {strap && (
          <div className="col">
            <div className="card-h"><span className="chip real">Live sensor · {strap.name}</span><button className="btn sm" onClick={() => { strap.stop(); setStrap(null) }}>Disconnect</button></div>
            <div className="grid3">
              <div><span className="small muted">Heart rate now</span><div className="num" style={{ fontSize: '2rem', fontWeight: 750 }}>{hr.length ? hr[hr.length - 1] : '–'} <span className="small muted">bpm</span></div></div>
              <div><span className="small muted">Resting estimate</span><div className="num" style={{ fontSize: '2rem', fontWeight: 750 }}>{Number.isNaN(restHr) ? '–' : Math.round(restHr)} <span className="small muted">bpm</span></div></div>
              <div><span className="small muted">HRV (RMSSD)</span><div className="num" style={{ fontSize: '2rem', fontWeight: 750 }}>{Number.isNaN(hrv) ? '–' : Math.round(hrv)} <span className="small muted">ms</span></div></div>
            </div>
            {hr.length > 2 && <TrendChart values={hr} from={0} to={hr.length - 1} labelFor={(t) => `${t}s`} unit="bpm" decimals={0} height={130} ariaLabel="Live heart rate" />}
            <button className="btn primary" disabled={Number.isNaN(restHr)} onClick={() => void saveReading()}>{Number.isNaN(restHr) ? `Keep still: ${Math.max(0, 30 - stable.length)} more seconds` : "Save as today's resting reading"}</button>
            {saved && <p role="status">{saved}</p>}
          </div>
        )}
      </Card>
    </>
  )
}
