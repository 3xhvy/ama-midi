export interface GridLinesProps {
  timeGridLines: Array<{ time: number; y: number; weight: 'measure' | 'subdivision' }>
  gridWidth:     number
  trackCount?:   number
}

export function GridLines({
  timeGridLines, gridWidth, trackCount = 8,
}: GridLinesProps) {
  const tw = gridWidth / trackCount
  return (
    <>
      {timeGridLines.map((line, i) => (
        <div
          key={`t${i}`}
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top:        line.y,
            height:     1,
            background: line.weight === 'measure'
              ? 'var(--canvas-grid-bar)'
              : 'var(--canvas-grid)',
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
