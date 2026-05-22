import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import type { NoteVariantProps } from './TapNote'

export function SwipeNote({
  note, gridWidth, pxPerSecond,
  isSelected = false, onClick,
}: NoteVariantProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2

  const ringClass = isSelected ? 'ring-2 ring-white' : ''

  return (
    <>
      <div
        data-note={note.id}
        className={cn(
          'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear',
          ringClass,
        )}
        style={{ left: cx - 8, top: y - 8, backgroundColor: note.color }}
        title={`${note.title} | Track ${note.track} | ${note.time}s | SWIPE →`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          left:         cx + 6,
          top:          y - 4,
          width:        0,
          height:       0,
          borderTop:    '4px solid transparent',
          borderBottom: '4px solid transparent',
          borderLeft:   `6px solid ${note.color}`,
        }}
      />
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: y - 24 }} />}
    </>
  )
}
