import { useState } from 'react'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import { trackColor } from '@ama-midi/shared'
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

  return (
    <>
      <div
        data-note={note.id}
        className="absolute cursor-pointer"
        style={{
          left:            cx - tw / 6,
          top:             y,
          width:           tw / 3,
          height:          bodyHeight,
          backgroundColor: trackColor(note.track),
          opacity:         0.85,
          borderRadius:    4,
          outline:         isSelected ? '2px solid rgba(255,255,255,0.90)' : undefined,
          outlineOffset:   isSelected ? '2px' : undefined,
        }}
        title={`${note.title} | Track ${note.track} | ${note.time}s | HOLD ${duration}s`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && (viewMode === 'composer' || viewMode === 'developer') &&
        <NoteTooltip note={note} position={{ x: cx, y: y - 24 }} />}
    </>
  )
}
