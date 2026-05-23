import { useNavigate } from 'react-router-dom'
import { timeAgo } from '../../lib/utils'
import type { Song } from '@ama-midi/shared'

export function SongTable({ projectId, songs }: { projectId: string; songs: Song[] }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-hidden rounded-lg border border-shell-border bg-shell-surface">
      <table className="w-full text-sm">
        <thead className="bg-shell-bg text-xs uppercase text-shell-muted">
          <tr>
            <th className="px-3 py-2 text-left">Song</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-left">Difficulty</th>
            <th className="px-3 py-2 text-left">Owner</th>
            <th className="px-3 py-2 text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => (
            <tr
              key={song.id}
              className="cursor-pointer border-t border-shell-border hover:bg-shell-bg"
              onClick={() => navigate(`/projects/${projectId}/songs/${song.id}`)}
            >
              <td className="px-3 py-2 font-medium text-shell-text">{song.name}</td>
              <td className="px-3 py-2 text-shell-muted">{song.status}</td>
              <td className="px-3 py-2 text-shell-muted">{song.category}</td>
              <td className="px-3 py-2 text-shell-muted">{song.difficulty}</td>
              <td className="px-3 py-2 text-shell-muted">{song.assignedComposerName ?? song.creatorName}</td>
              <td className="px-3 py-2 text-right text-shell-muted">{timeAgo(song.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
