import { trackToX, timeToY, trackWidth } from '../engine/coordinate-mapper'
import type { Note } from '@ama-midi/shared'

interface Props {
  note: Note
  gridWidth: number
  pxPerSecond: number
  onClick: (note: Note, e: React.MouseEvent) => void
  viewMode?: 'composer' | 'developer' | 'qa'
  isSelected?: boolean
  allNotes?: Note[]
}

export function NoteBlock({
  note,
  gridWidth,
  pxPerSecond,
  onClick,
  viewMode = 'composer',
  isSelected = false,
  allNotes = [],
}: Props) {
  const x = trackToX(note.track, gridWidth)
  const y = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)

  const isNearBoundary = note.time < 0.5 || note.time > 299.5
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
    <div
      className={`absolute rounded-sm cursor-pointer hover:brightness-110 transition-all flex items-center px-1 overflow-hidden group ${ringClass}`}
      style={{
        left: x + 1,
        top: y,
        width: tw - 2,
        height: 20,
        backgroundColor: note.color,
      }}
      onClick={(e) => onClick(note, e)}
      title={`${note.title} | Track ${note.track} | ${displayTime}s`}
    >
      <span className="text-xs text-white truncate leading-none">{note.title}</span>
      {viewMode === 'developer' && (
        <div className="absolute top-0 left-0 text-[8px] font-mono text-white/90 whitespace-nowrap bg-black/50 px-0.5 rounded leading-none pointer-events-none select-none opacity-0 group-hover:opacity-100">
          {note.id.slice(0, 8)}
        </div>
      )}
    </div>
  )
}
