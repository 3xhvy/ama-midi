import { useNavigate } from 'react-router-dom'
import type { DashboardSongRow } from '@ama-midi/shared'
import { SongStatusEnum } from '@ama-midi/shared'
import { SongStatusBadge } from '../../components/ui'
import { songEditorPath } from '../navigation/song-editor-path'
import { timeAgo } from '../../lib/utils'

export function DashboardSongList({ songs, emptyLabel }: { songs: DashboardSongRow[]; emptyLabel: string }) {
  const navigate = useNavigate()

  if (!songs.length) {
    return (
      <div className="rounded-md border border-dashed border-shell-border bg-shell-bg/60 px-3 py-3 text-sm text-shell-muted">
        {emptyLabel}
      </div>
    )
  }

  return (
    <ul className="overflow-hidden rounded-md border border-shell-border bg-shell-surface">
      {songs.map((song) => (
        <li key={song.id} className="border-b border-shell-border last:border-b-0">
          <button
            type="button"
            onClick={() => navigate(songEditorPath(song.projectId, song.id))}
            className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-shell-bg"
            style={{ boxShadow: `inset 3px 0 0 ${SongStatusEnum.color(song.status)}` }}
          >
            <div className="min-w-0 pl-1">
              <p className="truncate text-sm font-medium text-shell-text">{song.name}</p>
              <p className="truncate text-xs text-shell-muted">{song.projectName}</p>
            </div>
            <SongStatusBadge status={song.status} className="hidden sm:inline-flex" />
            <span className="shrink-0 text-xs text-shell-muted" title={SongStatusEnum.label(song.status)}>
              {timeAgo(song.updatedAt)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
