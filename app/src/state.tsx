import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { analyzeDay, type DayAnalysis } from './core/analysis'
import type { ModelJson } from './core/detect'
import { linkState, type LinkState, type OutboxItem } from './core/link'
import { defaultSharing, type AccessEntry, type Level, type Role, type SharingSettings } from './core/sharing'
import type { ActionLog, CrewAnalysis, Entry, Mission } from './core/types'
import { groundSummary } from './core/visibility'
import { store } from './db'
import type { WorkerResponse } from './worker/detect.worker'

export interface MissionMeta { id: string; title: string; kind: string; blurb: string; model: string }

export const BUILTIN: MissionMeta[] = [
  { id: 'mars_transit', title: 'Mars transit', kind: 'simulated', blurb: 'Four crew, 180-day outbound transit. Simulated.', model: 'model_mission' },
  { id: 'lunar_surface', title: 'Lunar surface stay', kind: 'simulated', blurb: 'Four crew, 35 days at a south-polar base. Simulated.', model: 'model_mission' },
]

export type ViewRole = 'self' | 'cmo' | 'commander'

interface Ctx {
  ready: boolean
  error: string | null
  mission: Mission
  model: ModelJson
  missions: MissionMeta[]
  loadMission: (id: string) => Promise<void>
  addMission: (m: Mission, model: string) => Promise<void>
  analyses: Record<string, CrewAnalysis>
  computeMs: number
  day: number
  setDay: (d: number) => void
  me: string
  setMe: (id: string) => void
  today: (crewId?: string, day?: number) => DayAnalysis | null
  entries: Entry[]
  saveEntry: (e: Omit<Entry, 'key' | 'ts' | 'mission'>) => Promise<void>
  actions: ActionLog[]
  logAction: (a: Omit<ActionLog, 'id' | 'ts' | 'mission'>) => Promise<void>
  sharing: Record<string, SharingSettings>
  setShare: (crew: string, role: Role, cat: string, level: Level) => void
  access: AccessEntry[]
  logAccess: (a: Omit<AccessEntry, 'id' | 'ts' | 'mission'>) => void
  link: LinkState
  linkCut: boolean
  setLinkCut: (v: boolean) => void
  outbox: OutboxItem[]
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  resetLocal: () => Promise<void>
}

const C = createContext<Ctx | null>(null)
export const useApp = () => {
  const v = useContext(C)
  if (!v) throw new Error('store missing')
  return v
}

const BASE = import.meta.env.BASE_URL
const getJson = async <T,>(path: string): Promise<T> => {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error(`Could not load ${path}`)
  return (await r.json()) as T
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [mission, setMission] = useState<Mission | null>(null)
  const [model, setModel] = useState<ModelJson | null>(null)
  const [missions, setMissions] = useState<MissionMeta[]>(BUILTIN)
  const [analyses, setAnalyses] = useState<Record<string, CrewAnalysis>>({})
  const [computeMs, setComputeMs] = useState(0)
  const [day, setDayRaw] = useState(0)
  const [me, setMeRaw] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [actions, setActions] = useState<ActionLog[]>([])
  const [sharing, setSharing] = useState<Record<string, SharingSettings>>({})
  const [access, setAccess] = useState<AccessEntry[]>([])
  const [linkCut, setLinkCut] = useState(false)
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [theme, setThemeRaw] = useState<'dark' | 'light'>('dark')
  const [error, setError] = useState<string | null>(null)
  const [analysedFor, setAnalysedFor] = useState('')
  const worker = useRef<Worker | null>(null)
  const reqId = useRef(0)
  const lastOutDay = useRef(-1)

  // --- worker ------------------------------------------------------------------------------
  useEffect(() => {
    const w = new Worker(new URL('./worker/detect.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<WorkerResponse & { missionId?: string }>) => {
      if (e.data.id !== reqId.current) return
      setAnalyses(e.data.analyses)
      setComputeMs(e.data.ms)
      setAnalysedFor(String(e.data.id))
    }
    worker.current = w
    return () => w.terminate()
  }, [])

  useEffect(() => {
    if (!mission || !model || !worker.current) return
    reqId.current += 1
    worker.current.postMessage({ id: reqId.current, mission, model, entries: entries.filter((x) => x.mission === mission.id) })
  }, [mission, model, entries])

  // --- load ----------------------------------------------------------------------------------
  const applyMission = useCallback(async (m: Mission, modelName: string) => {
    const mdl = await getJson<ModelJson>(`data/${modelName}.json`)
    setAnalyses({})
    setAnalysedFor('')
    setModel(mdl)
    setMission(m)
    const savedDay = await store.kv<number>(`day:${m.id}`)
    const savedMe = await store.kv<string>(`me:${m.id}`)
    setDayRaw(Math.min(m.days - 1, savedDay ?? m.default_day ?? m.days - 1))
    setMeRaw(savedMe && m.crew.some((c) => c.id === savedMe) ? savedMe : m.default_crew ?? m.crew[0].id)
    const sh: Record<string, SharingSettings> = {}
    for (const c of m.crew) sh[c.id] = (await store.sharing(`${m.id}|${c.id}`)) ?? defaultSharing()
    setSharing(sh)
    setOutbox([])
    lastOutDay.current = -1
    setLinkCut(false)
    void store.putKv('mission', m.id)
  }, [])

  const loadMission = useCallback(async (id: string) => {
    try {
      const custom = (await store.missions()).find((x) => x.id === id)
      const meta = missions.find((x) => x.id === id)
      const m = custom ?? (await getJson<Mission>(`data/missions/${id}.json`))
      await applyMission(m, meta?.model ?? (custom as (Mission & { model?: string }) | undefined)?.model ?? 'model_mission')
    } catch (err) {
      setError(String(err))
    }
  }, [applyMission, missions])

  const addMission = useCallback(async (m: Mission, modelName: string) => {
    await store.putMission({ ...m, model: modelName } as Mission)
    setMissions((prev) => [...prev.filter((x) => x.id !== m.id), { id: m.id, title: m.title, kind: m.kind ?? 'personal', blurb: m.blurb, model: modelName }])
    await applyMission(m, modelName)
  }, [applyMission])

  useEffect(() => {
    void (async () => {
      try {
        const [e, a, acc, th, last, customs] = await Promise.all([store.entries(), store.actions(), store.access(), store.kv<'dark' | 'light'>('theme'), store.kv<string>('mission'), store.missions()])
        setEntries(e)
        setActions(a)
        setAccess(acc)
        if (th) setThemeRaw(th)
        let extra: MissionMeta[] = []
        try {
          extra = await getJson<MissionMeta[]>('data/missions/index.json')
        } catch { /* optional */ }
        const all = [...BUILTIN, ...extra.filter((x) => !BUILTIN.some((b) => b.id === x.id)), ...customs.map((m) => ({ id: m.id, title: m.title, kind: m.kind ?? 'personal', blurb: m.blurb, model: (m as Mission & { model?: string }).model ?? 'model_mission' }))]
        setMissions(all)
        const id = last && all.some((x) => x.id === last) ? last : 'mars_transit'
        const custom = customs.find((x) => x.id === id)
        const m = custom ?? (await getJson<Mission>(`data/missions/${id}.json`))
        await applyMission(m, all.find((x) => x.id === id)?.model ?? 'model_mission')
      } catch (err) {
        setError(String(err))
      }
    })()
  }, [applyMission])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // --- derived -------------------------------------------------------------------------------
  const cache = useRef(new Map<string, DayAnalysis>())
  useEffect(() => { cache.current.clear() }, [analyses, entries, mission, model])
  const today = useCallback((crewId?: string, d?: number): DayAnalysis | null => {
    if (!mission || !model) return null
    const id = crewId ?? me
    const an = analyses[id]
    if (!an) return null
    const dd = d ?? day
    const key = `${id}|${dd}`
    let v = cache.current.get(key)
    if (!v) {
      v = analyzeDay(mission, id, an, model, dd, entries.filter((x) => x.mission === mission.id))
      cache.current.set(key, v)
    }
    return v
  }, [mission, model, analyses, me, day, entries])

  const link = useMemo(() => (mission ? linkState(mission, day, linkCut) : { available: false, delayS: NaN, distanceAu: NaN, reason: '', manualCut: false, scheduledBlackout: false }), [mission, day, linkCut])

  // --- outbox: one compact summary per mission day, queued while there is no link ----------
  useEffect(() => {
    if (!mission || !Object.keys(analyses).length || mission.kind === 'personal' || mission.kind === 'real') return
    if (day < mission.pre_days) return
    setOutbox((prev) => {
      let out = prev
      if (day < lastOutDay.current) { out = []; lastOutDay.current = -1 }
      const from = lastOutDay.current < 0 ? Math.max(mission.pre_days, day - 6) : lastOutDay.current + 1
      const add: OutboxItem[] = []
      for (let d = from; d <= day; d++) {
        const ls = linkState(mission, d, d === day ? linkCut : false)
        const an = today(me, d)
        const payload = an ? groundSummary(mission.id, me, d - mission.pre_days, an, sharing[me] ?? defaultSharing()) : '{}'
        add.push({ mission: mission.id, crew: me, day: d, bytes: new TextEncoder().encode(payload).length, payload, state: ls.available ? 'sent' : 'queued', queuedTs: Date.now(), sentDay: ls.available ? d : undefined, delayS: ls.delayS })
      }
      lastOutDay.current = day
      out = [...out, ...add]
      if (link.available) out = out.map((o) => (o.state === 'queued' ? { ...o, state: 'sent' as const, sentDay: day, delayS: link.delayS } : o))
      return out.slice(-60)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, analysedFor, link.available, me, mission?.id])

  // --- actions -------------------------------------------------------------------------------
  const setDay = useCallback((d: number) => {
    if (!mission) return
    const v = Math.max(0, Math.min(mission.days - 1, Math.round(d)))
    setDayRaw(v)
    void store.putKv(`day:${mission.id}`, v)
  }, [mission])
  const setMe = useCallback((id: string) => {
    setMeRaw(id)
    setOutbox([])
    lastOutDay.current = -1
    if (mission) void store.putKv(`me:${mission.id}`, id)
  }, [mission])
  const saveEntry = useCallback(async (e: Omit<Entry, 'key' | 'ts' | 'mission'>) => {
    if (!mission) return
    const full: Entry = { ...e, mission: mission.id, key: `${mission.id}|${e.crew}|${e.day}`, ts: Date.now() }
    await store.putEntry(full)
    setEntries((prev) => [...prev.filter((x) => x.key !== full.key), full])
  }, [mission])
  const logAction = useCallback(async (a: Omit<ActionLog, 'id' | 'ts' | 'mission'>) => {
    if (!mission) return
    const full: ActionLog = { ...a, mission: mission.id, ts: Date.now() }
    const id = await store.addAction(full)
    setActions((prev) => [...prev, { ...full, id }])
  }, [mission])
  const setShare = useCallback((crew: string, role: Role, cat: string, level: Level) => {
    if (!mission) return
    setSharing((prev) => {
      const cur = prev[crew] ?? defaultSharing()
      const next = { ...cur, [role]: { ...cur[role], [cat]: level } }
      void store.putSharing(`${mission.id}|${crew}`, next)
      return { ...prev, [crew]: next }
    })
  }, [mission])
  const seen = useRef(new Set<string>())
  const logAccess = useCallback((a: Omit<AccessEntry, 'id' | 'ts' | 'mission'>) => {
    if (!mission) return
    const k = `${mission.id}|${a.crew}|${a.role}|${a.category}|${a.level}|${a.day}`
    if (seen.current.has(k)) return
    seen.current.add(k)
    const full: AccessEntry = { ...a, mission: mission.id, ts: Date.now() }
    void store.addAccess(full)
    setAccess((prev) => [...prev, full])
  }, [mission])
  const setTheme = useCallback((t: 'dark' | 'light') => {
    setThemeRaw(t)
    void store.putKv('theme', t)
  }, [])
  const resetLocal = useCallback(async () => {
    await store.clearAll()
    location.reload()
  }, [])

  const ready = !!mission && !!model && Object.keys(analyses).length > 0 && !!me
  const value: Ctx | null = mission && model ? {
    ready, error, mission, model, missions, loadMission, addMission, analyses, computeMs, day, setDay, me, setMe, today, entries, saveEntry,
    actions, logAction, sharing, setShare, access, logAccess, link, linkCut, setLinkCut, outbox, theme, setTheme, resetLocal,
  } : null

  if (error) return <div className="boot"><h1>Keel could not start</h1><p>{error}</p><button className="btn" onClick={() => location.reload()}>Try again</button></div>
  if (!value || !ready) return <div className="boot" role="status"><div className="boot-mark" aria-hidden="true" /><p>Starting Keel on this device…</p></div>
  return <C.Provider value={value}>{children}</C.Provider>
}
