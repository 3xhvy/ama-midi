import { trackToX, timeToY, trackWidth } from '../engine'
import { trackColor } from '@ama-midi/shared'

export interface GhostCircleProps {
  track:       number
  time:        number
  gridWidth:   number
  pxPerSecond: number
}

export function GhostCircle({ track, time, gridWidth, pxPerSecond }: GhostCircleProps) {
  const x  = trackToX(track, gridWidth)
  const y  = timeToY(time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const color = trackColor(track)
  const stemWidth = Math.max(4, tw / 6)

  return (
    <>
      <div
        className="absolute w-4 h-4 rounded-full border-2 pointer-events-none"
        style={{
          left: x + tw / 2 - 8,
          top: y - 8,
          backgroundColor: `${color}33`,
          borderColor: color,
        }}
      />
      <div
        className="absolute rounded-sm pointer-events-none"
        style={{
          left: x + tw / 2 - stemWidth / 2,
          top: y + 6,
          width: stemWidth,
          height: 12,
          backgroundColor: `${color}40`,
        }}
      />
    </>
  )
}
