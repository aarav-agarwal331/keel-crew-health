import { useState } from 'react'
import { useApp } from '../state'
import { ReadingLog } from './kit'

/** Enter a thermometer reading right where the advice asks for it.  What happens next is decided by
 *  the fixed rules (shared/rules.json), not by this component: it only reports what they now say. */
export function TempEntry() {
  const { me, day, entries, mission, saveEntry, today } = useApp()
  const cur = entries.find((e) => e.mission === mission.id && e.crew === me && e.day === day)
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const save = async () => {
    const t = Number(v.replace(',', '.'))
    if (v.trim() === '' || Number.isNaN(t) || t < 30 || t > 45) { setErr('Enter the temperature in °C, between 30 and 45.'); return }
    setErr('')
    await saveEntry({ crew: me, day, values: { ...(cur?.values ?? {}), temp_oral: t }, symptoms: cur?.symptoms ?? [], meds: cur?.meds }, ['temp_oral'])
    setSaved(t)
    setV('')
  }
  const a = today(me, day)
  const rule = a?.findings.find((f) => f.ruleId === 'R-V-TEMP-HI') ?? a?.findings.find((f) => f.ruleId === 'R-V-TEMP')
  const log = (cur?.readings ?? []).filter((r) => r.ind === 'temp_oral')
  const highest = log.length ? Math.max(...log.map((r) => r.v)) : null
  let msg = ''
  if (saved !== null) {
    if (rule) msg = `${saved.toFixed(1)} °C saved. ${highest !== null && highest > saved ? `Your highest reading today was ${highest.toFixed(1)} °C, and that one still counts. ` : ''}${rule.action}`
    else if (saved < 35) msg = `${saved.toFixed(1)} °C saved. Below 35.0 °C is usually a measurement problem: wait five minutes and repeat. If it repeats, tell the medical officer.`
    else msg = `${saved.toFixed(1)} °C saved: no fever by this reading. That alone does not clear you for exercise. Follow the steps on this card.`
  }
  return (
    <div className="col" style={{ gap: 6 }}>
      <label className="lab small" htmlFor="temp-now">Thermometer reading (°C)</label>
      <div className="row">
        <input id="temp-now" type="number" inputMode="decimal" step="0.1" value={v} onChange={(e) => setV(e.target.value)} style={{ maxWidth: 160 }} data-testid="temp-now" />
        <button className="btn" onClick={() => void save()} data-testid="temp-save">Save reading</button>
      </div>
      {err && <p role="alert" className="small"><strong>{err}</strong></p>}
      {msg && <p role="status" className="small" data-testid="temp-msg"><strong>{msg}</strong></p>}
      <ReadingLog readings={log} />
    </div>
  )
}
