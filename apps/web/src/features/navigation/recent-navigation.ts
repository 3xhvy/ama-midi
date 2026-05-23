export const RECENT_SONGS_KEY = 'ama-midi:recent-songs:v1'
export const RECENT_PROJECTS_KEY = 'ama-midi:recent-projects:v1'

type RecentSongsStore = Record<string, { songId: string; openedAt: number }>
type RecentProjectsStore = { projectId: string; openedAt: number }[]

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function readJson<T>(storage: StorageLike, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(storage: StorageLike, key: string, value: unknown) {
  storage.setItem(key, JSON.stringify(value))
}

export function recordRecentSong(storage: StorageLike, projectId: string, songId: string) {
  const current = readJson<RecentSongsStore>(storage, RECENT_SONGS_KEY, {})
  current[projectId] = { songId, openedAt: Date.now() }
  writeJson(storage, RECENT_SONGS_KEY, current)
}

export function getRecentSongForProject(storage: StorageLike, projectId: string): string | null {
  const current = readJson<RecentSongsStore>(storage, RECENT_SONGS_KEY, {})
  return current[projectId]?.songId ?? null
}

export function recordRecentProject(storage: StorageLike, projectId: string) {
  const current = readJson<RecentProjectsStore>(storage, RECENT_PROJECTS_KEY, [])
  const next = [{ projectId, openedAt: Date.now() }, ...current.filter((p) => p.projectId !== projectId)]
  writeJson(storage, RECENT_PROJECTS_KEY, next.slice(0, 12))
}

export function getRecentProjects(storage: StorageLike): string[] {
  const current = readJson<RecentProjectsStore>(storage, RECENT_PROJECTS_KEY, [])
  return current.map((p) => p.projectId)
}
