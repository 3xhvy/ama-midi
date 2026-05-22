import { useMemo } from 'react'
import { timeToY } from '../engine'
import { computeNpsOverTime, npsToColor } from '../engine/difficulty-calculator'
import type { Note } from '@ama-midi/shared'

interface Props {
  notes:       Note[]
  pxPerSecond: number
  width:       number
}

export function DifficultyOverlay({ notes, pxPerSecond, width }: Props) {
  const bands = useMemo(() => computeNpsOverTime(notes, 2, 0.5), [notes])

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height="100%"
      style={{ zIndex: 1 }}
    >
      {bands.map(({ time, nps }) => (
        <rect
          key={time}
          x={0}
          y={timeToY(time, pxPerSecond)}
          width={width}
          height={pxPerSecond * 0.5}
          fill={npsToColor(nps)}
        />
      ))}
    </svg>
  )
}
