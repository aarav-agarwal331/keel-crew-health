import { useApp } from '../state'
import { useMeterUnit } from './meterUnit'

/** A blood sugar under 35 is either a dangerous low in mg/dL or a reading in mmol/L.  It is saved at once
 *  and counted as the dangerous low until the crew member says which unit the meter showed; the question
 *  stays on Check-in and Today until it is answered. */
export function GlucoseUnit() {
  const { me, day, entries, mission, saveEntry, voidReading, actions, logAction } = useApp()
  const [unit, setUnit] = useMeterUnit()
  const e = entries.find((x) => x.mission === mission.id && x.crew === me && x.day === day)
  const r = [...(e?.readings ?? [])].reverse().find((q) => q.ind === 'glucose' && !q.void)
  // only a typed number under 35 saved before the unit was known is ambiguous; a meter's LO readout is not
  if (!e || !r || r.v >= 35 || unit === 'mg' || !r.unitUnknown) return null
  if (actions.some((a) => a.crew === me && a.did === 'Confirmed blood sugar unit' && a.note === String(r.ts))) return null
  const mg = Math.round(r.v * 18)
  const asMmol = async () => {
    setUnit('mmol')
    await voidReading(me, day, 'glucose', r.ts)
    await saveEntry({ crew: me, day, values: { ...e.values, glucose: mg }, symptoms: e.symptoms, meds: e.meds, photos: e.photos }, ['glucose'])
  }
  return (
    <div className="banner strong" role="alert" data-testid="glucose-unit">
      <p><strong>Blood sugar {r.v}: which unit did your meter show?</strong> Keel has saved it and treats it as a dangerously low {r.v} mg/dL until you answer. If you feel shaky, sweaty or confused, take sugar now if you are awake and can swallow, and call a crewmate.</p>
      <div className="row wrap">
        <button className="btn primary" onClick={() => void asMmol()} data-testid="unit-mmol">mmol/L (change it to {mg} mg/dL)</button>
        <button className="btn alert" onClick={() => { setUnit('mg'); void logAction({ crew: me, alertKey: `glucose-unit|${day}`, day, did: 'Confirmed blood sugar unit', feel: null, note: String(r.ts) }) }} data-testid="unit-mgdl">mg/dL: it really is {r.v}</button>
      </div>
    </div>
  )
}
