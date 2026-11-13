import { useEffect, useState } from 'react'
import { store } from '../db'

/** Which unit this crew member's blood sugar meter shows.  A meter shows one fixed unit, so it is asked once
 *  and kept on the tablet; until it is known, a value under 35 is treated as a dangerous low and the unit is asked. */
export type MeterUnit = 'mg' | 'mmol' | null
const listeners = new Set<(u: MeterUnit) => void>()
export function useMeterUnit(): [MeterUnit, (u: MeterUnit) => void] {
  const [u, setU] = useState<MeterUnit>(null)
  useEffect(() => {
    void store.kv<MeterUnit>('glucose-meter-unit').then((v) => setU(v ?? null))
    listeners.add(setU)
    return () => { listeners.delete(setU) }
  }, [])
  const set = (v: MeterUnit) => { void store.putKv('glucose-meter-unit', v); listeners.forEach((f) => f(v)) }
  return [u, set]
}
/** "LO" and "HI" are what a meter shows outside its range: both are dangerous, so they are kept as values past the lines. */
export const METER_LO = 19
export const METER_HI = 600
