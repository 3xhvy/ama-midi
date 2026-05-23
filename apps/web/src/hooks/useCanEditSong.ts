import type { SongStatus } from '@ama-midi/shared'
import { useSongChartAccess } from './useSongChartAccess'

/** @deprecated Prefer useSongChartAccess for readOnlyMessage */
export function useCanEditSong(songId?: string, song?: { status: SongStatus } | null): boolean {
  return useSongChartAccess(songId, song).canEdit
}
