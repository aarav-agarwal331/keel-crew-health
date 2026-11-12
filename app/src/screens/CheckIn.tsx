import { useEffect, useRef, useState } from 'react'
import { dayLabel, IND, rawSeries, SYMPTOMS } from '../core/mission'
import { useApp } from '../state'
import type { Photo } from '../core/types'
import { Card, go, href, ReadingLog } from '../ui/kit'

const MOODS = ['Very low', 'Low', 'OK', 'Good', 'Very good']
const FOOD = [{ label: 'All of it', v: 100 }, { label: 'Most', v: 85 }, { label: 'About half', v: 55 }, { label: 'Little', v: 30 }, { label: 'None', v: 0 }]
// classes only, no doses: context for the medical officer, because these move heart rate, reaction time and sleep
const MEDS = ['Sleep aid', 'Pain or fever medicine', 'Decongestant or antihistamine', 'Anti-nausea medicine', 'Other medicine']
const PHOTO_LABELS = ['Skin', 'Eye', 'Mouth or throat', 'Wound', 'Other']
// thermometer first: it is the reading Keel's advice most often asks for
const SPOT = ['temp_oral', 'spo2', 'sbp', 'dbp', 'glucose', 'mass', 'sleep_h', 'rhr'] as const

export function CheckIn({ open }: { open?: string }) {
  const { mission, day, me, entries, saveEntry } = useApp()
  const existing = entries.find((e) => e.mission === mission.id && e.crew === me && e.day === day)
  const [mood, setMood] = useState<number | null>(existing?.values.mood ?? null)
  const [sym, setSym] = useState<string[]>(existing?.symptoms ?? [])
  const usual = rawSeries(mission, me, 'fluid', []).slice(Math.max(0, day - 14), day).filter((v) => !Number.isNaN(v))
  const fluidHint = usual.length ? usual.reduce((a, b) => a + b, 0) / usual.length : 2.25
  const [fluid, setFluid] = useState<number>(existing?.values.fluid ?? 0)
  const [serious, setSerious] = useState((existing?.symptoms ?? []).some((x) => SYMPTOMS.find((q) => q.id === x)?.red_flag))
  const [noSym, setNoSym] = useState(existing ? existing.symptoms.length === 0 : false)
  const [more, setMore] = useState(open === 'measure')
  const [food, setFood] = useState<number | null>(existing?.values.energy ?? null)
  const [ex, setEx] = useState<number | null>(existing?.values.ex_min ?? null)
  const [spot, setSpot] = useState<Record<string, string>>(() => Object.fromEntries(SPOT.filter((k) => existing?.values[k] !== undefined).map((k) => [k, String(existing!.values[k])])))
  const [pvt, setPvt] = useState<number | null>(existing?.values.pvt_rt ?? null)
  const [meds, setMeds] = useState<string[]>(existing?.meds ?? [])
  const [photos, setPhotos] = useState<Photo[]>(existing?.photos ?? [])
  const [photoLabel, setPhotoLabel] = useState(PHOTO_LABELS[0])
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  // far-from-usual values are accepted, but only after the crew member confirms what the device showed
  const [pending, setPending] = useState<{ k: string; v: number }[]>([])
  const [confirmed, setConfirmed] = useState<Record<string, number>>({})

  const save = async (extra: Record<string, number> = {}) => {
    const ok = { ...confirmed, ...extra }
    const values: Record<string, number> = {}
    if (mood !== null) values.mood = mood
    if (fluid > 0) values.fluid = fluid
    if (food !== null) values.energy = food
    if (ex !== null) values.ex_min = ex
    if (pvt !== null) values.pvt_rt = pvt
    const bad: string[] = []
    const ask: { k: string; v: number }[] = []
    for (const k of SPOT) {
      const raw = spot[k]
      if (raw === undefined || raw === '') continue
      const v = Number(String(raw).replace(',', '.'))
      const [lo, hi] = IND[k].range
      const [hardLo, hardHi] = IND[k].limits ?? IND[k].range
      if (Number.isNaN(v) || v < hardLo || v > hardHi) { bad.push(`${IND[k].label}: ${raw} was not saved. Enter a value between ${hardLo} and ${hardHi} ${IND[k].unit}.`); continue }
      // an extreme but possible value is exactly the one that must not be lost: keep it once confirmed
      if ((v < lo || v > hi) && ok[k] !== v) { ask.push({ k, v }); continue }
      values[k] = v
    }
    // symptoms and everything valid are always saved, whatever is wrong with one number
    await saveEntry({ crew: me, day, values, symptoms: sym, meds, photos })
    setErr(bad.join(' '))
    setPending(ask)
    setSaved(true)
  }
  const confirm = (k: string, v: number) => { const next = { ...confirmed, [k]: v }; setConfirmed(next); void save(next) }
  const addPhoto = async (file: File | undefined) => {
    if (!file) return
    const data = await shrink(file)
    if (data) setPhotos((p) => [...p.slice(-2), { ts: Date.now(), label: photoLabel, data }])
  }
  const red = sym.some((s) => SYMPTOMS.find((x) => x.id === s)?.red_flag)

  const routine = SYMPTOMS.filter((x) => !x.red_flag)
  const redFlags = SYMPTOMS.filter((x) => x.red_flag)
  const toggle = (id: string) => { setNoSym(false); setSym((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])) }
  const saveBtn = (
    <div className="sticky-save col">
      {err && <p className="banner strong" role="alert">{err}</p>}
      {pending.map((q) => (
        <div className="banner strong" role="alert" key={q.k}>
          <p><strong>{IND[q.k].label}: {q.v} {IND[q.k].unit}</strong> is far outside the usual range and has not been saved yet. Everything else was saved. Is that what the device showed?</p>
          <div className="row wrap"><button className="btn primary" onClick={() => confirm(q.k, q.v)} data-testid={`confirm-${q.k}`}>Yes, save {q.v}</button><button className="btn" onClick={() => { setSpot((p) => ({ ...p, [q.k]: '' })); setPending((p) => p.filter((x) => x.k !== q.k)) }}>No, clear it</button></div>
        </div>
      ))}
      <button className="btn primary block" onClick={() => void save()} data-testid="save-checkin">Save check-in</button>
    </div>
  )
  return (
    <>
      <h1>Check-in</h1>
      <p className="muted">{dayLabel(mission, day)}. Four quick answers take about a minute. Your answers stay on this tablet. Other roles see only what <a href={href('sharing')}>Sharing</a> allows: by default the commander sees a readiness tier without the reason, and a symptom marked serious goes to the medical officer at once.</p>

      <Card title="1. How are you feeling?">
        <div className="choices five" role="group" aria-label="Mood, 1 very low to 5 very good">
          {MOODS.map((m, i) => <button key={m} className="choice" aria-pressed={mood === i + 1} onClick={() => setMood(i + 1)} data-testid={`mood-${i + 1}`}><span className="n">{i + 1}</span><span className="tiny">{m}</span></button>)}
        </div>
      </Card>

      <Card title="2. Any symptoms today?">
        <div className="choices" role="group" aria-label="Symptoms">
          <button className="choice" aria-pressed={noSym && sym.length === 0} onClick={() => { setSym([]); setNoSym(true) }} data-testid="sym-none">No symptoms</button>
          {routine.map((s) => <button key={s.id} className="choice" aria-pressed={sym.includes(s.id)} onClick={() => toggle(s.id)} data-testid={`sym-${s.id}`}>{s.label}</button>)}
        </div>
        <button className={`choice red ${serious ? '' : ''}`} aria-expanded={serious} onClick={() => setSerious((v) => !v)} data-testid="serious-toggle" style={{ minHeight: 56 }}>Something serious? Chest pain, fainting, trouble breathing, bleeding, vision loss, thoughts of harming yourself…</button>
        {serious && (
          <>
            <span className="lab">Tell the medical officer now if you have any of these. Ticking one and saving shows it to the medical officer at once (emergency sharing). The commander is shown it too, except the items marked "medical officer only".</span>
            <div className="choices" role="group" aria-label="Symptoms that need the medical officer now">
              {redFlags.map((s) => <button key={s.id} className="choice red" aria-pressed={sym.includes(s.id)} onClick={() => toggle(s.id)} data-testid={`sym-${s.id}`}>{s.label}{(s as { commander?: boolean }).commander === false ? <span className="tiny"> (medical officer only)</span> : null}</button>)}
            </div>
          </>
        )}
        {red && <p className="banner strong" role="alert"><strong>Do not wait.</strong> Save this check-in and tell the medical officer now, whatever else Keel shows. If you are the medical officer, tell the commander.</p>}
      </Card>

      <div className="grid2">
        <Card title="3. Fluids today">
          <div className="stepper">
            <button aria-label="One drink bag less" onClick={() => setFluid((v) => Math.max(0, Number((v - 0.25).toFixed(2))))}>−</button>
            <span className="v num" aria-live="polite">{fluid.toFixed(2)} L</span>
            <button aria-label="One drink bag more" onClick={() => setFluid((v) => Number((v + 0.25).toFixed(2)))} data-testid="fluid-plus">+</button>
          </div>
          <div className="row wrap"><button className="btn sm" onClick={() => setFluid(Math.round(fluidHint * 4) / 4)} data-testid="fluid-usual">Same as usual ({fluidHint.toFixed(1)} L)</button><button className="btn sm" onClick={() => setFluid((v) => Number((v + 1).toFixed(2)))}>+ 1 L</button></div>
          <p className="small muted">One tap on + is one 250 mL drink bag. Aim for at least 2.0 to 2.5 L a day. Left at zero, nothing is recorded.</p>
        </Card>
        <Card title="4. How much of your planned food did you eat?">
          <div className="choices" role="group" aria-label="Food intake">{FOOD.map((f) => <button key={f.v} className="choice" aria-pressed={food === f.v} onClick={() => setFood(f.v)}>{f.label}</button>)}</div>
        </Card>
      </div>

      {!more && saveBtn}
      {saved && <div className="card" role="status"><strong>Saved.</strong><p className="muted">Keel has re-checked your readings on this tablet with your new entries.</p><div className="row wrap"><button className="btn" onClick={() => go('today')}>See Today</button><a className="btn" href={href('sharing')}>Who can see this?</a></div></div>}

      <button className="btn block" aria-expanded={more} onClick={() => setMore((v) => !v)} data-testid="more-checkin">{more ? 'Hide the optional extras' : 'Add more: reaction test, exercise, measurements (optional)'}</button>
      {more && (
        <>
          <div className="grid2">
            <Card title="Reaction self-test (1 minute)">
              {pvt !== null ? <p>Saved: average response <strong className="num">{pvt.toFixed(0)} ms</strong>. <button className="btn sm" onClick={() => setPvt(null)}>Redo</button></p> : <Pvt onDone={setPvt} />}
            </Card>
            <Card title="Exercise today">
              <div className="stepper">
                <button aria-label="15 minutes less" onClick={() => setEx((v) => Math.max(0, (v ?? 0) - 15))}>−</button>
                <span className="v num" aria-live="polite">{ex ?? 0} min</span>
                <button aria-label="15 minutes more" onClick={() => setEx((v) => (v ?? 0) + 15)}>+</button>
              </div>
              <p className="small muted">Only needed if the exercise devices did not log your session.</p>
            </Card>
          </div>
          <Card title="Medication taken today (optional)">
            <div className="choices" role="group" aria-label="Medication taken today">
              {MEDS.map((x) => <button key={x} className="choice" aria-pressed={meds.includes(x)} onClick={() => setMeds((p) => (p.includes(x) ? p.filter((q) => q !== x) : [...p, x]))} data-testid={`med-${x.split(' ')[0].toLowerCase()}`}>{x}</button>)}
            </div>
            <p className="small muted">Classes only, no doses. These can move heart rate, reaction time and sleep, so Keel shows them next to any alert. The medical officer sees them only if you share Symptoms in detail. Keel never recommends medication.</p>
          </Card>
          <Card title="Photo for the medical officer (optional)">
            <div className="row wrap">
              <label className="lab small" htmlFor="photo-kind">What is it of?</label>
              <select id="photo-kind" value={photoLabel} onChange={(e) => setPhotoLabel(e.target.value)}>{PHOTO_LABELS.map((x) => <option key={x}>{x}</option>)}</select>
              <label className="btn" htmlFor="photo-in">Take or choose a photo</label>
              <input id="photo-in" type="file" accept="image/*" capture="environment" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = '' }} data-testid="photo-in" />
            </div>
            {photos.length > 0 && <div className="row wrap">{photos.map((ph) => <figure key={ph.ts} style={{ margin: 0 }}><img src={ph.data} alt={`${ph.label} photo`} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10 }} /><figcaption className="tiny">{ph.label} <button className="btn sm" onClick={() => setPhotos((p) => p.filter((x) => x.ts !== ph.ts))}>Remove</button></figcaption></figure>)}</div>}
            <p className="small muted">A rash, an eye, a wound. Up to three a day, shrunk and stored on this tablet when you save. Keel does not analyse photos. The medical officer sees them only if you share Symptoms in detail.</p>
          </Card>
          <Card title="Measurements (only what you took today)" id="measurements">
            <div className="grid3 fields">
              {SPOT.map((k) => (
                <div className="field" key={k}>
                  <label htmlFor={`f-${k}`}>{IND[k].label} <span className="muted small">({IND[k].unit})</span></label>
                  <input id={`f-${k}`} type="number" inputMode="decimal" step="any" value={spot[k] ?? ''} onChange={(e) => setSpot((p) => ({ ...p, [k]: e.target.value }))} />
                  <details><summary className="small">How to measure</summary><p className="small muted">{IND[k].how}</p></details>
                </div>
              ))}
            </div>
            <ReadingLog readings={(existing?.readings ?? []).filter((r) => (SPOT as readonly string[]).includes(r.ind))} />
            <p className="small muted">Taking a reading again? Type the new value and save: the earlier one is kept with its time, and both are shown to whoever you share them with.</p>
          </Card>
          {saveBtn}
        </>
      )}
    </>
  )
}

/** A one-minute reaction test in the style of the psychomotor vigilance test.  The flown
 *  Reaction Self-Test lasts three minutes; this shorter version is for daily self-comparison only. */
function Pvt({ onDone }: { onDone: (ms: number) => void }) {
  const [phase, setPhase] = useState<'idle' | 'wait' | 'go' | 'done'>('idle')
  const [rts, setRts] = useState<number[]>([])
  const [early, setEarly] = useState(0)
  const t0 = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const endAt = useRef(0)
  const DURATION = 60_000
  const arm = () => {
    setPhase('wait')
    timer.current = window.setTimeout(() => { t0.current = performance.now(); setPhase('go') }, 1000 + Math.random() * 3000)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const tap = () => {
    if (phase === 'idle') { setRts([]); setEarly(0); endAt.current = performance.now() + DURATION; arm(); return }
    if (phase === 'wait') { setEarly((e) => e + 1); return }
    if (phase === 'go') {
      const rt = performance.now() - t0.current
      const next = rt >= 100 ? [...rts, rt] : rts
      setRts(next)
      if (performance.now() >= endAt.current || next.length >= 20) { setPhase('done'); return }
      arm()
    }
  }
  const mean = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : NaN
  const lapses = rts.filter((r) => r >= 355).length
  if (phase === 'done') {
    return (
      <div className="col">
        <p>Average response <strong className="num">{mean.toFixed(0)} ms</strong> over {rts.length} trials, {lapses} slow response{lapses === 1 ? '' : 's'} (355 ms or more), {early} early tap{early === 1 ? '' : 's'}.</p>
        <div className="row wrap"><button className="btn primary" onClick={() => onDone(mean)} data-testid="pvt-save">Use this result</button><button className="btn" onClick={() => setPhase('idle')}>Redo</button></div>
      </div>
    )
  }
  return (
    <div className="col">
      <button className={`pvt ${phase === 'go' ? 'go' : ''}`} onPointerDown={tap} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap() } }} data-testid="pvt-target" aria-label={phase === 'idle' ? 'Start reaction test' : phase === 'go' ? 'Tap now' : 'Wait for the signal'}>
        {phase === 'idle' ? 'Tap to start (1 minute)' : phase === 'wait' ? 'Wait…' : 'TAP'}
      </button>
      <p className="small muted">{phase === 'idle' ? 'Tap as fast as you can each time the panel lights up. Sit still, same hand each day.' : `${rts.length} of up to 20 responses`}</p>
    </div>
  )
}

/** Shrink a photo to at most 900 px and JPEG, so it fits in the on-device database. */
async function shrink(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('image')); img.src = url })
    const k = Math.min(1, 900 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    URL.revokeObjectURL(url)
    return c.toDataURL('image/jpeg', 0.8)
  } catch {
    return null
  }
}
