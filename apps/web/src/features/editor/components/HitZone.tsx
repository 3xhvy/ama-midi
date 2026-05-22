import { timeToY } from '../engine'

interface Props {
  pxPerSecond: number
  playheadTime: number
  width:        number
  windowSeconds?: number
}

export function HitZone({ pxPerSecond, playheadTime, width, windowSeconds = 0.1 }: Props) {
  const halfPx = windowSeconds * pxPerSecond * 0.5
  const cy     = timeToY(playheadTime, pxPerSecond)
  return (
    <div
      className="absolute left-0 pointer-events-none"
      style={{
        top:       cy - halfPx,
        height:    halfPx * 2,
        width:     width,
        background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.2), transparent)',
        zIndex:    6,
      }}
    />
  )
}
