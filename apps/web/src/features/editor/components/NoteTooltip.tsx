import { Avatar } from '../../../components/ui'
import { formatTime } from '../../../lib/utils'
import type { Note } from '@ama-midi/shared'

export interface NoteTooltipProps {
  note:     Note
  position: { x: number; y: number }
}

export function NoteTooltip({ note, position }: NoteTooltipProps) {
  return (
    <div
      className="absolute z-50 bg-shell-surface border border-shell-border rounded-lg shadow-md px-3 py-2 pointer-events-none whitespace-nowrap"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -100%)' }}
    >
      <p className="text-xs font-medium text-shell-text">{note.title}</p>
      <p className="text-[10px] text-shell-muted mt-0.5">
        Track {note.track} · {formatTime(note.time)}
      </p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Avatar src={note.creatorAvatarUrl} name={note.creatorName || 'Unknown'} size="xs" />
        <span className="text-[10px] text-shell-muted">{note.creatorName || 'Unknown'}</span>
      </div>
    </div>
  )
}
