import { SongStatusEnum, type DashboardSongRow, type SongStatus } from '@ama-midi/shared'

export function uniqueDashboardSongs(...lists: DashboardSongRow[][]): DashboardSongRow[] {
  const byId = new Map<string, DashboardSongRow>()
  for (const list of lists) {
    for (const song of list) byId.set(song.id, song)
  }
  return [...byId.values()]
}

export function countSongsByStatus(songs: DashboardSongRow[]): Array<{ status: SongStatus; count: number }> {
  const counts = new Map<SongStatus, number>()
  for (const song of songs) {
    counts.set(song.status, (counts.get(song.status) ?? 0) + 1)
  }

  return SongStatusEnum.keys
    .map((status) => ({ status, count: counts.get(status) ?? 0 }))
    .filter((entry) => entry.count > 0)
}
