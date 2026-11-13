import { useEffect, useState } from 'react'
import { store } from '../db'
import { useApp } from '../state'

/** Which unit this crew member's blood sugar meter shows.  A meter shows one fixed unit, so it is asked once
 *  and kept on the tablet; until it is known, a value under 35 is treated as a dangerous low and the unit is asked. */
export type MeterUnit = 'mg' | 'mmol' | null
const listeners = new Set<(key: string, u: MeterUnit) => void>()
export function useMeterUnit(): [MeterUnit, (u: MeterUnit) => void] {
  // per crew member: each person has their own meter, and the demo tablet is shared
  const { me } = useApp()
  const key = `glucose-meter-unit|${me}`
  const [u, setU] = useState<MeterUnit>(null)
  useEffect(() => {
    setU(null)
    void store.kv<MeterUnit>(key).then((v) => setU(v ?? null))
    const l = (k: string, v: MeterUnit) => { if (k === key) setU(v) }
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [key])
  const set = (v: MeterUnit) => { void store.putKv(key, v); listeners.forEach((f) => f(key, v)) }
  return [u, set]
}
/** "LO" and "HI" are what a meter shows outside its range: both are dangerous, so they are kept as values past the lines. */
export const METER_LO = 19
export const METER_HI = 600

/** Turn what the person typed into mg/dL with their meter's unit; null if it cannot be a meter reading. */
export function toMgdl(raw: string, unit: MeterUnit): number | null {
  const t = raw.trim().toUpperCase()
  if (t === 'LO') return METER_LO
  if (t === 'HI') return METER_HI
  const v = Number(raw.replace(',', '.'))
  if (Number.isNaN(v)) return null
  const mg = unit === 'mmol' ? Math.round(v * 18.016) : v
  // a meter cannot read above its own maximum: a larger value means the unit is wrong
  return mg > METER_HI ? null : mg
}
