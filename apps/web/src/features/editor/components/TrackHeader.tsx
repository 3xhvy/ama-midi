import { cn } from '../../../lib/utils'

export interface TrackHeaderProps {
  track:        number
  isMuted:      boolean
  noteCount:    number
  maxCount:     number
  onToggleMute: () => void
}

export function TrackHeader({ track, isMuted, noteCount, maxCount, onToggleMute }: TrackHeaderProps) {
  const density = maxCount > 0 ? noteCount / maxCount : 0

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-opacity hover:bg-shell-bg select-none',
        isMuted && 'opacity-30',
      )}
      onClick={onToggleMute}
      title={isMuted ? `Track ${track} (muted — click to unmute)` : `Track ${track} — click to mute`}
    >
      <span className="text-xs text-shell-text w-4 shrink-0">T{track}</span>

      {/* Density bar */}
      <div className="flex-1 h-1.5 rounded-full bg-shell-border overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${density * 100}%` }}
        />
      </div>

      <span className="text-[9px] text-shell-muted w-3 text-right shrink-0">
        {isMuted ? 'M' : ''}
      </span>
    </div>
  )
}
