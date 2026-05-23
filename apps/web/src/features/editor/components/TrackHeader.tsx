import { cn } from '../../../lib/utils'
import { trackColor } from '@ama-midi/shared'

export interface TrackHeaderProps {
  track:        number
  isMuted:      boolean
  noteCount:    number
  maxCount:     number
  isActive?:    boolean
  onToggleMute: () => void
}

export function TrackHeader({
  track, isMuted, noteCount, maxCount, isActive = false, onToggleMute,
}: TrackHeaderProps) {
  const density = maxCount > 0 ? noteCount / maxCount : 0
  const color = trackColor(track)

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors hover:bg-shell-bg select-none',
        isActive && 'bg-white/[0.04] rounded-[var(--radius-sm)]',
        isMuted && 'opacity-30',
      )}
      onClick={onToggleMute}
      title={isMuted ? `Track ${track} (muted — click to unmute)` : `Track ${track} — click to mute`}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0 transition-shadow"
        style={{
          backgroundColor: color,
          boxShadow: isActive
            ? `0 0 0 3px color-mix(in srgb, ${color} 30%, transparent)`
            : undefined,
        }}
      />

      <span className={cn('text-xs w-4 shrink-0', isActive ? 'text-shell-text font-medium' : 'text-shell-muted')}>
        T{track}
      </span>

      <div className="flex-1 h-1.5 rounded-full bg-shell-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${density * 100}%`, backgroundColor: color }}
        />
      </div>

      <span className="text-[9px] text-shell-muted w-3 text-right shrink-0">
        {isMuted ? 'M' : ''}
      </span>
    </div>
  )
}
