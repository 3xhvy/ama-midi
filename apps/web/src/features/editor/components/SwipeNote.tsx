import { useState } from 'react'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import { trackColor } from '@ama-midi/shared'
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

  return (
    <>
      <div
        data-note={note.id}
        className="absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear"
        style={{
          left: cx - 8,
          top: y - 8,
          backgroundColor: trackColor(note.track),
          boxShadow: isSelected ? '0 0 0 2px rgba(255,255,255,0.90)' : undefined,
        }}
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
          borderLeft:   `6px solid ${trackColor(note.track)}`,
        }}
      />
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: y - 24 }} />}
    </>
  )
}
