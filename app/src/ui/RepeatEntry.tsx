import { useState } from 'react'
import { SPOT_KEY } from '../core/analysis'
import { IND, symptomsOn } from '../core/mission'
import type { Finding } from '../core/types'
import { useApp } from '../state'

/** The repeat reading an "act now" card asks for, entered right on the card.  The fixed rules decide what
 *  it means (a repeat counts only after its waiting time); this box only saves it. */
const REPEATABLE = ['glucose', 'spo2', 'rhr']
const LABEL: Record<string, string> = { glucose: 'blood sugar (mg/dL)', spo2: 'fingertip oxygen now (%)', rhr: 'heart rate now, sitting at rest (bpm)' }
export function RepeatEntry({ f }: { f: Finding }) {
  const { me, day, entries, mission, saveEntry } = useApp()
  const ind = (f.inds ?? []).map((x) => x.replace(/_manual$|_rise$/, '')).find((x) => REPEATABLE.includes(x))
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  if (!ind || f.kind !== 'vital') return null
  const key = SPOT_KEY[ind] ?? ind
  const cur = entries.find((e) => e.mission === mission.id && e.crew === me && e.day === day)
  const save = async () => {
    const x = Number(v.replace(',', '.'))
    const [lo, hi] = ind === 'glucose' ? [1, 1000] : IND[ind].limits ?? IND[ind].range
    if (v.trim() === '' || Number.isNaN(x) || x < lo || x > hi) { setErr(`Enter a value between ${lo} and ${hi} ${IND[ind].unit}.`); return }
    setErr('')
    await saveEntry({ crew: me, day, values: { ...(cur?.values ?? {}), [key]: x }, symptoms: cur?.symptoms ?? symptomsOn(mission, me, day, []), meds: cur?.meds, photos: cur?.photos }, [key])
    setV('')
  }
  return (
    <div className="col" style={{ gap: 6 }}>
      <label className="lab small" htmlFor={`repeat-${ind}`}>Repeat reading: {LABEL[ind]}</label>
      <div className="row">
        <input id={`repeat-${ind}`} type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} style={{ maxWidth: 160 }} data-testid="repeat-now" />
        <button className="btn" onClick={() => void save()} data-testid="repeat-save">Save repeat</button>
      </div>
      {err && <p role="alert" className="small"><strong>{err}</strong></p>}
    </div>
  )
}
