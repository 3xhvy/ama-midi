import { getColorFromName } from '@ama-midi/shared'
import { trackToX, timeToY, trackWidth } from '../editor/engine'
import type { CursorData } from './useSocket'

interface Props {
  cursors:         Map<string, CursorData>
  gridWidth:       number
  pxPerSecond:     number
  scrollTop:       number
  viewportHeight:  number
  currentUserId?:  string
}

export function CollaboratorCursors({ cursors, gridWidth, pxPerSecond, scrollTop, viewportHeight, currentUserId }: Props) {
  const tw = trackWidth(gridWidth)

  return (
    <>
      {Array.from(cursors.values()).map((cursor) => {
        if (currentUserId && cursor.userId === currentUserId) return null

        const x = trackToX(cursor.track, gridWidth) + tw / 2
        const y = timeToY(cursor.time, pxPerSecond)

        const viewTop    = scrollTop
        const viewBottom = scrollTop + viewportHeight
        if (y < viewTop - 20 || y > viewBottom + 20) return null

        const color = getColorFromName(cursor.userId)

        return (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none z-20 flex items-center gap-1"
            style={{ left: x - 6, top: y - 6 }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shrink-0"
              style={{ backgroundColor: color }}
            />
            <span
              className="text-[9px] text-white px-1 py-0.5 rounded whitespace-nowrap leading-none"
              style={{ backgroundColor: color + 'DD' }}
            >
              {cursor.name}{cursor.title ? ` · ${cursor.title}` : ''}
            </span>
          </div>
        )
      })}
    </>
  )
}
