import { trackColor } from '@ama-midi/shared'
import type { ConflictAction, PlacementConflict } from '@ama-midi/shared'
import { formatTime } from './conflict-formatters'

interface Props {
  conflict:   PlacementConflict
  resolution: ConflictAction | undefined
  isActive:   boolean
  onClick:    () => void
}

const NOTE_TYPE_COLORS: Record<string, string> = {
  TAP:   'bg-[#EEF0FF] text-[#6C63FF]',
  HOLD:  'bg-red-50 text-red-500',
  SWIPE: 'bg-blue-50 text-blue-500',
}

function TypePill({ type }: { type: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${NOTE_TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-500'}`}>
      {type}
    </span>
  )
}

function StatusDot({ resolution }: { resolution: ConflictAction | undefined }) {
  const color = resolution === 'KEEP_EXISTING'
    ? 'bg-emerald-500'
    : resolution === 'REPLACE_WITH_PATTERN'
    ? 'bg-red-500'
    : 'bg-amber-300'
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
}

export function ConflictListItem({ conflict, resolution, isActive, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors ${
        isActive
          ? 'bg-[#EEF0FF] border-l-2 border-[#6C63FF]'
          : 'border-l-2 border-transparent hover:bg-slate-50'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: trackColor(conflict.track) }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-700 truncate">
          T{conflict.track} · {formatTime(conflict.time)}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <TypePill type={conflict.existingNote.noteType} />
          <span className="text-[9px] text-slate-400">→</span>
          <TypePill type={conflict.incomingNote.noteType} />
        </div>
        <div className="text-[10px] text-slate-400 truncate mt-0.5">
          {conflict.existingNote.creatorName}
        </div>
      </div>
      <StatusDot resolution={resolution} />
    </button>
  )
}
