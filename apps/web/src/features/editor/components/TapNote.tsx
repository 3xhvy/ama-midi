import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import { trackColor, type Note } from '@ama-midi/shared'

export interface NoteVariantProps {
  note:            Note
  gridWidth:       number
  pxPerSecond:     number
  isSelected?:     boolean
  validationRing?: 'error' | 'warning' | null
  validationHighlighted?: boolean
  allNotes?:       Note[]
  onClick:         (note: Note, e: React.MouseEvent) => void
}

export function TapNote({
  note, gridWidth, pxPerSecond,
  isSelected = false, validationRing = null, validationHighlighted = false, onClick,
}: NoteVariantProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2
  const cy = y

  const ringClass =
    validationHighlighted && validationRing === 'error'   ? 'ring-[3px] ring-red-400 scale-150 z-20' :
    validationHighlighted && validationRing === 'warning' ? 'ring-[3px] ring-yellow-400 scale-150 z-20' :
    validationRing === 'error'   ? 'ring-2 ring-red-400' :
    validationRing === 'warning' ? 'ring-2 ring-yellow-400' : ''

  const selectionShadow = isSelected && !validationRing
    ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.90)' }
    : undefined

  const displayTime = Math.round(note.time * 10) / 10

  return (
    <>
      <div
        data-note={note.id}
        className={cn(
          'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear',
          ringClass,
        )}
        style={{ left: cx - 8, top: cy - 8, backgroundColor: trackColor(note.track), ...selectionShadow }}
        title={`${note.title} | Track ${note.track} | ${displayTime}s`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: cy - 24 }} />}
    </>
  )
}
