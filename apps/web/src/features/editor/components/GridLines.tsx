import type { VirtualItem } from '@tanstack/react-virtual'
import type { BeatLine } from '../engine/beat-grid'

export interface GridLinesProps {
  virtualItems: VirtualItem[]
  gridWidth:    number
  trackCount?:  number
  beatLines?:   BeatLine[]
}

export function GridLines({
  virtualItems, gridWidth, trackCount = 8, beatLines = [],
}: GridLinesProps) {
  const tw = gridWidth / trackCount
  return (
    <>
      {virtualItems.map((row) => {
        const isBold = row.index % 10 === 0
        return (
          <div
            key={`s${row.index}`}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top:        row.start,
              height:     1,
              background: isBold ? 'var(--canvas-grid-bold)' : 'var(--canvas-grid)',
            }}
          />
        )
      })}
      {beatLines.map((line, i) => (
        <div
          key={`b${i}`}
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top:        line.y,
            height:     1,
            background: line.weight === 'measure'
              ? 'var(--canvas-grid-bar)'
              : 'var(--canvas-grid-bold)',
          }}
        />
      ))}
      {Array.from({ length: trackCount - 1 }, (_, t) => (
        <div
          key={`v${t}`}
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: (t + 1) * tw, width: 1, background: 'var(--canvas-grid)' }}
        />
      ))}
    </>
  )
}
