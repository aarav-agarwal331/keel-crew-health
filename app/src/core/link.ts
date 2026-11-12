/**
 * Earth link model.  SIMULATED: approximate geometry (circular, coplanar orbits; the transfer is
 * a smooth arc), good to roughly a minute of delay.  Verified anchor values (docs/DOMAIN.md
 * refs 1-5): one-way Earth-Mars delay about 4 min at closest approach and about 24 min at the
 * greatest distance; Earth-Moon light time 1.27 s; operational lunar latency 3-14 s; a two-week
 * command moratorium around solar conjunction for robotic Mars missions.
 */
import type { Mission } from './types'

const AU_KM = 149_597_870.7
const C_KM_S = 299_792.458
const DEG = Math.PI / 180

export interface LinkState {
  available: boolean
  /** one-way delay in seconds (NaN when no geometry applies) */
  delayS: number
  distanceAu: number
  reason: string
  manualCut: boolean
  scheduledBlackout: boolean
}

/** Earth-vehicle distance in AU on a flight day of an outbound Mars transit of `total` days. */
export function marsTransitDistanceAu(fd: number, total: number): number {
  const f = Math.min(1, Math.max(0, fd / total))
  const r = 1 + 0.524 * (3 * f * f - 2 * f * f * f) // smooth 1 AU -> 1.524 AU
  // vehicle sweeps about 150 degrees around the Sun, faster when closer in; Earth 0.9856 deg/day
  const sweep = 150 * (f * 1.12 - 0.12 * f * f)
  const earth = 0.9856 * fd
  const dth = (earth - sweep) * DEG
  return Math.sqrt(1 + r * r - 2 * r * Math.cos(dth))
}

export function delayFor(m: Mission, day: number): { delayS: number; distanceAu: number } {
  const fd = day - m.pre_days
  if (fd < 0) return { delayS: 0, distanceAu: 0 }
  if (m.link?.profile === 'mars_transit') {
    const au = marsTransitDistanceAu(fd, m.flight_days)
    return { delayS: (au * AU_KM) / C_KM_S, distanceAu: au }
  }
  if (m.link?.profile === 'lunar') return { delayS: 1.27, distanceAu: 384_400 / AU_KM }
  return { delayS: NaN, distanceAu: NaN }
}

/** Scripted link outages in the demo missions (flight-day ranges, inclusive). */
export function scheduledBlackout(m: Mission, day: number): string | null {
  const fd = day - m.pre_days
  if (m.link?.profile === 'mars_transit') {
    if (fd >= 118 && fd <= 131) return 'Scripted two-week blackout (antenna fault), modelled on the two-week command pause at solar conjunction'
    if (fd >= 162 && fd <= 164) return 'Scripted outage during the solar particle event'
  }
  if (m.link?.profile === 'lunar') {
    if (fd >= 20 && fd <= 22) return 'Scripted relay outage (rover traverse out of line of sight)'
  }
  return null
}

export function linkState(m: Mission, day: number, manualCut: boolean): LinkState {
  const { delayS, distanceAu } = delayFor(m, day)
  const sched = scheduledBlackout(m, day)
  if (m.kind === 'personal' || m.kind === 'real') return { available: false, delayS: NaN, distanceAu: NaN, reason: 'No ground link is modelled for this data set. Everything runs on this device.', manualCut, scheduledBlackout: false }
  if (manualCut) return { available: false, delayS, distanceAu, reason: 'You cut the link (demo control)', manualCut, scheduledBlackout: !!sched }
  if (sched) return { available: false, delayS, distanceAu, reason: sched, manualCut, scheduledBlackout: true }
  return { available: true, delayS, distanceAu, reason: day < m.pre_days ? 'On Earth: direct contact' : 'Link nominal', manualCut, scheduledBlackout: false }
}

export function fmtDelay(s: number): string {
  if (Number.isNaN(s)) return 'n/a'
  if (s < 1) return 'under 1 s'
  if (s < 60) return `${s.toFixed(1)} s`
  const mm = Math.floor(s / 60)
  const ss = Math.round(s - mm * 60)
  return `${mm} min ${String(ss).padStart(2, '0')} s`
}

export interface OutboxItem {
  id?: number
  mission: string
  crew: string
  day: number
  bytes: number
  payload: string
  state: 'queued' | 'sent'
  queuedTs: number
  sentDay?: number
  delayS?: number
}
