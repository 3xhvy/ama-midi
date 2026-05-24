import { Pencil1Icon, EnterIcon } from '@radix-ui/react-icons'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SongStatusEnum } from '@ama-midi/shared'
import type { Song, SongStatus } from '@ama-midi/shared'
import { timeAgo } from '../../lib/utils'
import { Button, IconButton, Input } from '../../components/ui'
import { SongStatusMenu } from './SongStatusMenu'
import { EditSongModal } from './EditSongModal'
import { SongPersonCell } from './SongPersonCell'
import { resolveSongPersonAvatar } from './song-person-avatar'
import { songEditorPath } from '../navigation/song-editor-path'
import { filterProjectSongs, validationHint, type SongTableStatusFilter } from './song-table-filters'

export function SongTable({ projectId, songs }: { projectId: string; songs: Song[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<SongTableStatusFilter>('ALL')
  const [editingSong, setEditingSong] = useState<Song | null>(null)

  const filtered = useMemo(
    () => filterProjectSongs(songs, { query, status }),
    [songs, query, status],
  )

  function clearFilters() {
    setQuery('')
    setStatus('ALL')
  }

  return (
    <>
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
            {SongStatusEnum.entries.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.labelFallback}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-lg border border-shell-border bg-shell-surface">
          <table className="w-full text-sm">
            <thead className="bg-shell-bg text-xs uppercase text-shell-muted">
              <tr>
                <th className="px-3 py-2 text-left">Song</th>
                <th className="px-3 py-2 text-left">Created by</th>
                <th className="px-3 py-2 text-left">Composer</th>
                <th className="px-3 py-2 text-left">QA</th>
                <th className="px-3 py-2 text-left">Charts</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Last Edited</th>
                <th className="px-3 py-2 text-left">Validation</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-shell-muted">
                    {query || status !== 'ALL' ? (
                      <div className="flex flex-col items-center gap-2">
                        <span>No songs match. Clear filters?</span>
                        <Button size="sm" variant="secondary" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      </div>
                    ) : (
                      'No songs yet.'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((song, index) => (
                  <tr
                    key={song.id}
                    data-tour={index === 0 ? 'song-table-row' : undefined}
                    className="border-t border-shell-border hover:bg-shell-bg"
                  >
                    <td className="px-3 py-2 font-medium text-shell-text">{song.name}</td>
                    <td className="px-3 py-2">
                      <SongPersonCell name={song.creatorName} avatarUrl={resolveSongPersonAvatar(song, 'creator')} />
                    </td>
                    <td className="px-3 py-2">
                      <SongPersonCell name={song.assignedComposerName} avatarUrl={resolveSongPersonAvatar(song, 'composer')} />
                    </td>
                    <td className="px-3 py-2">
                      <SongPersonCell name={song.assignedQaName} avatarUrl={resolveSongPersonAvatar(song, 'qa')} />
                    </td>
                    <td className="px-3 py-2 text-shell-muted">{song.chartSummary ?? '—'}</td>
                    <td className="px-3 py-2">
                      <SongStatusMenu songId={song.id} projectId={projectId} status={song.status as SongStatus} />
                    </td>
                    <td className="px-3 py-2 text-shell-muted">{timeAgo(song.updatedAt)}</td>
                    <td className="px-3 py-2 text-shell-muted">{validationHint(song.status as SongStatus)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          size="sm"
                          variant="outlined"
                          tooltip="Edit song"
                          aria-label="Edit song"
                          onClick={() => setEditingSong(song)}
                        >
                          <Pencil1Icon className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          size="sm"
                          variant="outlined"
                          tooltip="Open editor"
                          aria-label="Open editor"
                          onClick={() => navigate(songEditorPath(projectId, song.id))}
                        >
                          <EnterIcon className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EditSongModal
        song={editingSong}
        projectId={projectId}
        open={!!editingSong}
        onOpenChange={(open) => { if (!open) setEditingSong(null) }}
      />
    </>
  )
}
