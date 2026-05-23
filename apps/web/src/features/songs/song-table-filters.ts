import type { Song, SongStatus } from '@ama-midi/shared'

export type SongTableStatusFilter = 'ALL' | SongStatus

export function filterProjectSongs(
  songs: Song[],
  input: { query: string; status: SongTableStatusFilter },
): Song[] {
  const q = input.query.trim().toLowerCase()
  return songs.filter((song) => {
    const matchesQuery = !q || song.name.toLowerCase().includes(q)
    const matchesStatus = input.status === 'ALL' || song.status === input.status
    return matchesQuery && matchesStatus
  })
}

export function validationHint(status: SongStatus): string {
  if (status === 'NEEDS_FIX') return 'Fix required'
  if (status === 'IN_REVIEW') return 'Review pending'
  if (status === 'APPROVED' || status === 'PUBLISHED') return 'Passed'
  return 'Not validated'
}
