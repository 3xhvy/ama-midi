import type { VirtualItem } from '@tanstack/react-virtual'

export interface GridLinesProps {
  virtualItems: VirtualItem[]
  gridWidth:    number
  trackCount?:  number
}

export function GridLines({ virtualItems, gridWidth, trackCount = 8 }: GridLinesProps) {
  const tw = gridWidth / trackCount
  return (
    <>
      {virtualItems.map((row) => {
        const isBold = row.index % 10 === 0
        return (
          <div
            key={row.index}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top:        row.start,
              height:     1,
              background: isBold ? 'var(--canvas-grid-bold)' : 'var(--canvas-grid)',
            }}
          />
        )
      })}
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
