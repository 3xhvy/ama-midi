import { useMemo } from 'react'
import { analyzeChart, segmentScoreToColor } from '../engine/difficulty-calculator'
import { timeToY } from '../engine'
import type { Note } from '@ama-midi/shared'

interface Props {
  notes:       Note[]
  bpm:         number
  timeSignature: string
  speedMultiplier: number
  pxPerSecond: number
  width:       number
}

export function DifficultyOverlay({
  notes,
  bpm,
  timeSignature,
  speedMultiplier,
  pxPerSecond,
  width,
}: Props) {
  const segments = useMemo(
    () =>
      analyzeChart({
        notes,
        bpm,
        timeSignature,
        speedMultiplier,
      }).segments,
    [notes, bpm, timeSignature, speedMultiplier],
  )

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height="100%"
      style={{ zIndex: 1 }}
    >
      {segments.map((seg) => {
        const startSec = seg.startTimeMs / 1000
        const endSec = seg.endTimeMs / 1000
        return (
          <rect
            key={`${seg.startTimeMs}-${seg.endTimeMs}`}
            x={0}
            y={timeToY(startSec, pxPerSecond)}
            width={width}
            height={Math.max(1, (endSec - startSec) * pxPerSecond)}
            fill={segmentScoreToColor(seg.difficultyScore)}
          />
        )
      })}
    </svg>
  )
}
