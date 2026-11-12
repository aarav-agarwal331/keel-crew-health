import { useState } from 'react'
import { useApp } from '../state'

/** Enter a thermometer reading right where the advice asks for it; the fixed rules then decide the next step. */
export function TempEntry() {
  const { me, day, entries, mission, saveEntry } = useApp()
  const cur = entries.find((e) => e.mission === mission.id && e.crew === me && e.day === day)
  const [v, setV] = useState(cur?.values.temp_oral !== undefined ? String(cur.values.temp_oral) : '')
  const [msg, setMsg] = useState('')
  const save = async () => {
    const t = Number(v.replace(',', '.'))
    if (Number.isNaN(t) || t < 34 || t > 42) { setMsg('Enter a temperature between 34 and 42 °C.'); return }
    await saveEntry({ crew: me, day, values: { ...(cur?.values ?? {}), temp_oral: t }, symptoms: cur?.symptoms ?? [] })
    setMsg(t >= 39.4 ? `${t.toFixed(1)} °C: tell the medical officer now.` : t >= 38 ? `${t.toFixed(1)} °C is in the fever range: no exercise today, see the medical officer today.` : `${t.toFixed(1)} °C is below 38.0. A light session is reasonable; repeat in four hours.`)
  }
  return (
    <div className="col" style={{ gap: 6 }}>
      <label className="lab small" htmlFor="temp-now">Thermometer reading (°C)</label>
      <div className="row">
        <input id="temp-now" type="number" inputMode="decimal" step="0.1" value={v} onChange={(e) => setV(e.target.value)} style={{ maxWidth: 160 }} data-testid="temp-now" />
        <button className="btn" onClick={() => void save()} data-testid="temp-save">Save reading</button>
      </div>
      {msg && <p role="status" className="small"><strong>{msg}</strong></p>}
    </div>
  )
}
