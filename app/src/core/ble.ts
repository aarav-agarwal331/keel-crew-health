/**
 * Live heart-rate strap over Web Bluetooth (standard Heart Rate service 0x180D, measurement
 * characteristic 0x2A37).  Works in Chromium browsers over HTTPS or localhost.
 */
export interface HrSample { hr: number; rr: number[]; contact: boolean | null }

/** Parse a Heart Rate Measurement value per the Bluetooth GATT specification. */
export function parseHeartRate(dv: DataView): HrSample {
  const flags = dv.getUint8(0)
  const is16 = (flags & 0x01) !== 0
  const contactSupported = (flags & 0x04) !== 0
  const contact = contactSupported ? (flags & 0x02) !== 0 : null
  let o = 1
  const hr = is16 ? dv.getUint16(o, true) : dv.getUint8(o)
  o += is16 ? 2 : 1
  if (flags & 0x08) o += 2 // energy expended
  const rr: number[] = []
  if (flags & 0x10) for (; o + 1 < dv.byteLength; o += 2) rr.push((dv.getUint16(o, true) / 1024) * 1000)
  return { hr, rr, contact }
}

/** RMSSD in ms from successive RR intervals, ignoring physiologically impossible beats. */
export function rmssd(rr: number[]): number {
  const v = rr.filter((x) => x > 300 && x < 2000)
  if (v.length < 3) return NaN
  let s = 0
  let n = 0
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1]
    if (Math.abs(d) > 0.25 * v[i - 1]) continue // ectopic or missed beat
    s += d * d
    n++
  }
  return n >= 2 ? Math.sqrt(s / n) : NaN
}

export const bleSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator

export interface StrapSession { name: string; stop: () => void }

export async function connectStrap(onSample: (s: HrSample) => void, onEnd: () => void): Promise<StrapSession> {
  const nav = navigator as Navigator & { bluetooth?: { requestDevice: (o: unknown) => Promise<BluetoothDeviceLike> } }
  if (!nav.bluetooth) throw new Error('This browser does not support Web Bluetooth. Use Chrome or Edge.')
  const device = await nav.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })
  const server = await device.gatt!.connect()
  const service = await server.getPrimaryService('heart_rate')
  const ch = await service.getCharacteristic('heart_rate_measurement')
  const handler = (e: Event) => onSample(parseHeartRate((e.target as unknown as { value: DataView }).value))
  ch.addEventListener('characteristicvaluechanged', handler)
  await ch.startNotifications()
  device.addEventListener('gattserverdisconnected', onEnd)
  return { name: device.name ?? 'Heart-rate strap', stop: () => { try { ch.removeEventListener('characteristicvaluechanged', handler); device.gatt?.disconnect() } catch { /* already gone */ } } }
}

interface BluetoothDeviceLike {
  name?: string
  gatt?: { connect: () => Promise<{ getPrimaryService: (s: string) => Promise<{ getCharacteristic: (c: string) => Promise<EventTarget & { startNotifications: () => Promise<unknown> }> }> }>; disconnect: () => void }
  addEventListener: (t: string, f: () => void) => void
}
