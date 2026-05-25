import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackColor } from '@ama-midi/shared'
import { trackBarWidth } from '../utils/track-density'
import { Skeleton } from '../../../components/ui'

export interface TrackHeaderProps {
  track:        number
  isMuted:      boolean
  noteCount:    number
  density:      number
  isActive?:    boolean
  isLoading?:   boolean
  onToggleMute: () => void
}

export function TrackHeader({
  track, isMuted, noteCount, density, isActive = false, isLoading = false, onToggleMute,
}: TrackHeaderProps) {
  const barWidth = trackBarWidth(density)
  const color = trackColor(track)
  const [hovered, setHovered] = useState(false)

  const muteTitle = isMuted ? `Track ${track} (muted — click to unmute)` : `Track ${track} — click to mute`
  const noteTitle = `${noteCount} note${noteCount === 1 ? '' : 's'} on this track`

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors rounded select-none',
        isActive && 'bg-primary-light dark:bg-white/[0.04] rounded-[var(--radius-sm)]',
        !isActive && hovered && 'bg-primary-light/50 dark:bg-primary/15',
        isMuted && 'opacity-30',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggleMute}
      title={hovered ? noteTitle : muteTitle}
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

      {isLoading ? (
        <Skeleton className="flex-1" height={4} />
      ) : (
        <div className="track-activity-bar-bg flex-1">
          <div
            className="track-activity-bar-fill"
            style={{ width: `${barWidth * 100}%`, backgroundColor: color }}
          />
        </div>
      )}

      <span className="text-[9px] text-shell-muted w-3 text-right shrink-0">
        {isMuted ? 'M' : ''}
      </span>
    </div>
  )
}
