/// <reference lib="webworker" />
/** All detection runs here, on the device, off the main thread.  No network access is used. */
import { scorePerson, type ModelJson } from '../core/detect'
import { features } from '../core/mission'
import type { CrewAnalysis, Entry, Mission } from '../core/types'

export interface WorkerRequest { id: number; mission: Mission; model: ModelJson; entries: Entry[] }
export interface WorkerResponse { id: number; analyses: Record<string, CrewAnalysis>; ms: number }

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, mission, model, entries } = e.data
  const t0 = performance.now()
  const analyses: Record<string, CrewAnalysis> = {}
  for (const c of mission.crew) {
    const x = features(mission, c.id, model.indicators, entries)
    analyses[c.id] = { crewId: c.id, x, scored: scorePerson(x, model, mission.phases) }
  }
  const res: WorkerResponse = { id, analyses, ms: performance.now() - t0 }
  ;(self as unknown as Worker).postMessage(res)
}
