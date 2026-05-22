import { SongCard } from './SongCard'
import { Skeleton } from '../../components/ui'
import type { Song } from '@ama-midi/shared'

export function SongGrid({ songs, isLoading }: { songs: Song[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-shell-surface rounded-xl border border-shell-border p-5">
            <Skeleton height={16} width="75%" className="mb-3" />
            <div className="flex gap-1.5 mb-3">
              {Array.from({ length: 8 }).map((_, j) => <Skeleton key={j} width={8} height={8} rounded="full" />)}
            </div>
            <Skeleton height={12} width="50%" />
          </div>
        ))}
      </div>
    )
  }

  if (songs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-shell-muted text-sm">No songs yet — create your first one</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {songs.map((song) => <SongCard key={song.id} song={song} />)}
    </div>
  )
}
