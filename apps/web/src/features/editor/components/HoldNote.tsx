import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import type { NoteVariantProps } from './TapNote'

export function HoldNote({
  note, gridWidth, pxPerSecond,
  isSelected = false, viewMode = 'composer', onClick,
}: NoteVariantProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2
  const duration = note.duration ?? 0.5
  const bodyHeight = Math.max(24, duration * pxPerSecond)

  const ringClass = isSelected ? 'ring-2 ring-white' : ''

  return (
    <>
      <div
        data-note={note.id}
        className={cn('absolute pointer-events-none', ringClass)}
        style={{
          left:   cx - tw / 6,
          top:    y - 8,
          width:  tw / 3,
          height: bodyHeight + 16,
        }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
          style={{ top: 0, backgroundColor: note.color }}
          title={`${note.title} | Track ${note.track} | ${note.time}s | HOLD ${duration}s`}
          onClick={(e) => onClick(note, e)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        />
        <div
          className="absolute left-0 right-0 rounded-sm opacity-70 pointer-events-none"
          style={{ top: 8, height: bodyHeight, backgroundColor: note.color }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full opacity-50 pointer-events-none"
          style={{ top: bodyHeight + 8 - 4, backgroundColor: note.color }}
        />
      </div>
      {hovered && (viewMode === 'composer' || viewMode === 'developer') &&
        <NoteTooltip note={note} position={{ x: cx, y: y - 24 }} />}
    </>
  )
}
