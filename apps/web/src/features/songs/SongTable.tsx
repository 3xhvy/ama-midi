import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SONG_STATUS_OPTIONS } from '@ama-midi/shared'
import type { SongStatus } from '@ama-midi/shared'
import { timeAgo } from '../../lib/utils'
import { Button, Input, SongStatusBadge } from '../../components/ui'
import { songEditorPath } from '../navigation/song-editor-path'
import type { Song } from '@ama-midi/shared'
import { filterProjectSongs, validationHint, type SongTableStatusFilter } from './song-table-filters'

export function SongTable({ projectId, songs }: { projectId: string; songs: Song[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<SongTableStatusFilter>('ALL')

  const filtered = useMemo(
    () => filterProjectSongs(songs, { query, status }),
    [songs, query, status],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs…"
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SongTableStatusFilter)}
          className="rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text"
        >
          <option value="ALL">All statuses</option>
          {SONG_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-shell-border bg-shell-surface">
        <table className="w-full text-sm">
          <thead className="bg-shell-bg text-xs uppercase text-shell-muted">
            <tr>
              <th className="px-3 py-2 text-left">Song</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Composer</th>
              <th className="px-3 py-2 text-left">QA</th>
              <th className="px-3 py-2 text-left">Last Edited</th>
              <th className="px-3 py-2 text-left">Validation</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-shell-muted">
                  No songs match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((song) => (
                <tr key={song.id} className="border-t border-shell-border hover:bg-shell-bg">
                  <td className="px-3 py-2 font-medium text-shell-text">{song.name}</td>
                  <td className="px-3 py-2">
                    <SongStatusBadge status={song.status as SongStatus} />
                  </td>
                  <td className="px-3 py-2 text-shell-muted">{song.assignedComposerName ?? '—'}</td>
                  <td className="px-3 py-2 text-shell-muted">{song.assignedQaName ?? '—'}</td>
                  <td className="px-3 py-2 text-shell-muted">{timeAgo(song.updatedAt)}</td>
                  <td className="px-3 py-2 text-shell-muted">{validationHint(song.status as SongStatus)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(songEditorPath(projectId, song.id))}
                    >
                      Open Editor
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
