import { timeToY } from '../engine'
import type { SectionMarker } from '@ama-midi/shared'

interface Props {
  sections:    SectionMarker[]
  pxPerSecond: number
}

export function SectionMarkers({ sections, pxPerSecond }: Props) {
  return (
    <>
      {sections.map(s => (
        <div
          key={s.id}
          className="absolute left-0 right-0 flex items-center px-2 pointer-events-none"
          style={{
            top:             timeToY(s.time, pxPerSecond),
            height:          20,
            backgroundColor: s.color + '22',
            borderTop:       `2px solid ${s.color}`,
            zIndex:          5,
          }}
        >
          <span className="text-[10px] font-medium" style={{ color: s.color }}>
            {s.label}
          </span>
        </div>
      ))}
    </>
  )
}
