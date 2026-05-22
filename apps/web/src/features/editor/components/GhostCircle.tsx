import { trackToX, timeToY, trackWidth } from '../engine'

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
  return (
    <div
      className="absolute w-4 h-4 rounded-full border-2 border-white/50 bg-white/20 pointer-events-none"
      style={{ left: x + tw / 2 - 8, top: y - 8 }}
    />
  )
}
