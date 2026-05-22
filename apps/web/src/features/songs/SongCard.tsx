import { useNavigate } from 'react-router-dom'
import { cn, timeAgo } from '../../lib/utils'
import { Button, StatusBadge, Avatar } from '../../components/ui'
import { NOTE_PRESET_COLORS } from '@ama-midi/shared'
import type { Song } from '@ama-midi/shared'

function TrackDots({ noteCount }: { noteCount: number }) {
  const filled = Math.min(8, Math.round((noteCount / 50) * 8))
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-colors"
          style={{ backgroundColor: i < filled ? NOTE_PRESET_COLORS[i % NOTE_PRESET_COLORS.length] : 'var(--shell-border)' }}
        />
      ))}
    </div>
  )
}

export function SongCard({ song, className }: { song: Song; className?: string }) {
  const navigate = useNavigate()
  return (
    <div
      className={cn(
        'bg-shell-surface rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 border border-shell-border cursor-pointer group',
        className,
      )}
      onClick={() => navigate(`/songs/${song.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-shell-text text-[15px] truncate">{song.name}</h3>
        <StatusBadge status="draft" />
      </div>
      <TrackDots noteCount={song.noteCount ?? 0} />
      <div className="flex items-center gap-1.5 mt-3">
        <Avatar name={song.creatorName ?? 'Unknown'} src={song.creatorAvatarUrl} size="xs" />
        <span className="text-xs text-shell-muted truncate">{song.creatorName ?? 'Unknown'}</span>
        <span className="text-xs text-shell-muted ml-auto">{timeAgo(song.updatedAt)}</span>
      </div>
      <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="primary" size="sm" rounded className="w-full"
          onClick={(e) => { e.stopPropagation(); navigate(`/songs/${song.id}`) }}
        >
          Open Editor
        </Button>
      </div>
    </div>
  )
}
