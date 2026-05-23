import { useNavigate } from 'react-router-dom'
import type { DashboardSongRow } from '@ama-midi/shared'
import { SongStatusBadge } from '../../components/ui'
import { songEditorPath } from '../navigation/song-editor-path'
import { timeAgo } from '../../lib/utils'

export function DashboardSongList({ songs, emptyLabel }: { songs: DashboardSongRow[]; emptyLabel: string }) {
  const navigate = useNavigate()
  if (!songs.length) return <p className="text-sm text-shell-muted">{emptyLabel}</p>

  return (
    <ul className="divide-y divide-shell-border rounded-lg border border-shell-border bg-shell-surface">
      {songs.map((song) => (
        <li key={song.id}>
          <button
            type="button"
            onClick={() => navigate(songEditorPath(song.projectId, song.id))}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-shell-bg"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-shell-text">{song.name}</p>
              <p className="truncate text-xs text-shell-muted">{song.projectName}</p>
            </div>
            <SongStatusBadge status={song.status} />
            <span className="text-xs text-shell-muted shrink-0">{timeAgo(song.updatedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
