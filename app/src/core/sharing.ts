/** Crew-owned data: per-role, per-category sharing levels, and what each level reveals. */
export type Role = 'cmo' | 'commander' | 'ground'
export type Level = 'none' | 'status' | 'trend' | 'detail'

export const ROLES: { id: Role; label: string; blurb: string }[] = [
  { id: 'cmo', label: 'Crew medical officer', blurb: 'The crew member trained to provide care on board.' },
  { id: 'commander', label: 'Commander', blurb: 'Decides who does what. Always sees your readiness tier, never the reasons unless you share them.' },
  { id: 'ground', label: 'Flight surgeon on the ground', blurb: 'Receives a compact summary when a link is available.' },
]

export const LEVELS: { id: Level; label: string; reveals: string }[] = [
  { id: 'none', label: 'Private', reveals: 'Nothing beyond the always-visible items above.' },
  { id: 'status', label: 'Status', reveals: 'Only steady / worth a look / act today / act now. Under emergency sharing the medical officer also sees the title of a safety item, or of a notice that includes a symptom you reported.' },
  { id: 'trend', label: 'Trends', reveals: 'Status, the title of any notice from your readings, and whether each reading is inside your normal range.' },
  { id: 'detail', label: 'Full detail', reveals: 'Status, trends, the actual numbers and your notes.' },
]

export const SHARE_CATEGORIES = ['cardio', 'sleep', 'exercise', 'cognition', 'nutrition', 'symptoms'] as const
export type ShareCategory = (typeof SHARE_CATEGORIES)[number]

export type SharingSettings = Record<Role, Record<ShareCategory, Level>> & {
  /** agreed before flight: a red-flag symptom or a fixed safety threshold is shown to the medical officer and the commander (the backup) at once */
  emergency?: boolean
}

const all = (l: Level): Record<ShareCategory, Level> => ({ cardio: l, sleep: l, exercise: l, cognition: l, nutrition: l, symptoms: l })

/** Defaults: the medical officer sees status only, everyone else nothing.  Mood and symptoms start private. */
export function defaultSharing(): SharingSettings {
  return {
    cmo: { ...all('status'), cognition: 'status', symptoms: 'status' },
    commander: all('none'),
    ground: all('none'),
    emergency: true,
  }
}

const RANK: Record<Level, number> = { none: 0, status: 1, trend: 2, detail: 3 }
export const allows = (have: Level, need: Level) => RANK[have] >= RANK[need]

export interface AccessEntry {
  id?: number
  ts: number
  mission: string
  crew: string
  role: Role
  category: string
  level: Level
  what: string
  day: number
}
