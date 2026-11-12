/** Local database (IndexedDB).  Nothing in here ever leaves the device. */
import { openDB, type IDBPDatabase } from 'idb'
import type { AccessEntry, SharingSettings } from './core/sharing'
import type { ActionLog, Entry, Mission } from './core/types'

let dbp: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB('keel', 2, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('entries')) d.createObjectStore('entries', { keyPath: 'key' })
        if (!d.objectStoreNames.contains('actions')) d.createObjectStore('actions', { keyPath: 'id', autoIncrement: true })
        if (!d.objectStoreNames.contains('sharing')) d.createObjectStore('sharing')
        if (!d.objectStoreNames.contains('access')) d.createObjectStore('access', { keyPath: 'id', autoIncrement: true })
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv')
        if (!d.objectStoreNames.contains('missions')) d.createObjectStore('missions', { keyPath: 'id' })
      },
    })
  }
  return dbp
}

async function safe<T>(fn: (d: IDBPDatabase) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn(await db())
  } catch (err) {
    console.warn('Keel storage unavailable, continuing in memory', err)
    return fallback
  }
}

export const store = {
  entries: () => safe((d) => d.getAll('entries') as Promise<Entry[]>, []),
  putEntry: (e: Entry) => safe((d) => d.put('entries', e).then(() => undefined), undefined),
  actions: () => safe((d) => d.getAll('actions') as Promise<ActionLog[]>, []),
  addAction: (a: ActionLog) => safe((d) => d.add('actions', a).then((k) => k as number), -1),
  sharing: (key: string) => safe((d) => d.get('sharing', key) as Promise<SharingSettings | undefined>, undefined),
  putSharing: (key: string, s: SharingSettings) => safe((d) => d.put('sharing', s, key).then(() => undefined), undefined),
  access: () => safe((d) => d.getAll('access') as Promise<AccessEntry[]>, []),
  addAccess: (a: AccessEntry) => safe((d) => d.add('access', a).then(() => undefined), undefined),
  kv: <T,>(key: string) => safe((d) => d.get('kv', key) as Promise<T | undefined>, undefined),
  putKv: (key: string, v: unknown) => safe((d) => d.put('kv', v, key).then(() => undefined), undefined),
  missions: () => safe((d) => d.getAll('missions') as Promise<Mission[]>, []),
  putMission: (m: Mission) => safe((d) => d.put('missions', m).then(() => undefined), undefined),
  clearAll: () => safe(async (d) => {
    for (const s of ['entries', 'actions', 'sharing', 'access', 'kv', 'missions']) await d.clear(s)
  }, undefined),
}
