import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import type { Note } from '@ama-midi/shared'

export interface NoteCircleProps {
  note:       Note
  gridWidth:  number
  pxPerSecond: number
  isSelected?: boolean
  viewMode?:  'composer' | 'developer' | 'qa'
  allNotes?:  Note[]
  onClick:    (note: Note, e: React.MouseEvent) => void
}

export function NoteCircle({
  note, gridWidth, pxPerSecond,
  isSelected = false, viewMode = 'composer', allNotes = [], onClick,
}: NoteCircleProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2
  const cy = y

  const isNearBoundary   = note.time < 0.5 || note.time > 299.5
  const hasCloseNeighbor = allNotes.some(
    (n) => n.id !== note.id && n.track === note.track && Math.abs(n.time - note.time) < 0.3,
  )

  const ringClass =
    viewMode === 'qa'
      ? isNearBoundary
        ? 'ring-2 ring-orange-400'
        : hasCloseNeighbor
          ? 'ring-2 ring-yellow-400'
          : ''
      : isSelected
        ? 'ring-2 ring-white'
        : ''

  const displayTime = viewMode === 'developer' ? note.time : Math.round(note.time * 10) / 10

  return (
    <>
      <div
        className={cn(
          'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear group',
          ringClass,
        )}
        style={{ left: cx - 8, top: cy - 8, backgroundColor: note.color }}
        title={`${note.title} | Track ${note.track} | ${displayTime}s`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {viewMode === 'developer' && (
          <div className="absolute top-0 left-0 text-[8px] font-mono text-white/90 whitespace-nowrap bg-black/50 px-0.5 rounded leading-none pointer-events-none select-none opacity-0 group-hover:opacity-100">
            {note.id.slice(0, 8)}
          </div>
        )}
      </div>
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: cy - 24 }} />}
    </>
  )
}
