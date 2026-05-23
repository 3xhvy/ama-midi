import { trackColor } from '@ama-midi/shared'
import type { ConflictAction, PlacementConflict } from '@ama-midi/shared'
import { formatTime } from './conflict-formatters'
import { typePillStyle } from './conflict-theme'

interface Props {
  conflict:   PlacementConflict
  resolution: ConflictAction | undefined
  isActive:   boolean
  onClick:    () => void
}

function TypePill({ type }: { type: string }) {
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold"
      style={typePillStyle(type)}
    >
      {type}
    </span>
  )
}

function StatusDot({ resolution }: { resolution: ConflictAction | undefined }) {
  const color = resolution === 'KEEP_EXISTING'
    ? 'var(--conflict-success)'
    : resolution === 'REPLACE_WITH_PATTERN'
    ? 'var(--conflict-danger)'
    : 'var(--conflict-warning)'
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

export function ConflictListItem({ conflict, resolution, isActive, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors border-l-2"
      style={{
        backgroundColor: isActive ? 'var(--conflict-list-active)' : 'transparent',
        borderLeftColor: isActive ? 'var(--conflict-accent)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--conflict-list-hover)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
        style={{ backgroundColor: trackColor(conflict.track) }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate" style={{ color: 'var(--modal-text)' }}>
          T{conflict.track} · {formatTime(conflict.time)}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <TypePill type={conflict.existingNote.noteType} />
          <span className="text-[9px]" style={{ color: 'var(--modal-muted)' }}>→</span>
          <TypePill type={conflict.incomingNote.noteType} />
        </div>
        <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--modal-muted)' }}>
          {conflict.existingNote.creatorName}
        </div>
      </div>
      <StatusDot resolution={resolution} />
    </button>
  )
}
