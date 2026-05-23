import { TIME_AXIS_WIDTH } from '../../../lib/constants'
import { TIME_MAX } from '@ama-midi/shared'
import { getTimeAxisLabels } from '../engine'

export interface TimeAxisProps {
  pxPerSecond:    number
  scrollTop:      number
  bpm?:           number
  timeSignature?: string
  onAddSection?:  (time: number, e: React.MouseEvent) => void
}

export function TimeAxis({
  pxPerSecond, scrollTop, onAddSection,
}: TimeAxisProps) {
  const labels = getTimeAxisLabels(pxPerSecond, scrollTop, TIME_MAX)

  return (
    <div
      className="shrink-0 relative overflow-hidden bg-canvas-surface border-r border-canvas-border cursor-pointer"
      style={{ width: TIME_AXIS_WIDTH }}
      onClick={(e) => {
        if (!onAddSection) return
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
        const y    = e.clientY - rect.top + scrollTop
        const time = Math.max(0, Math.min(300, Math.round((y / pxPerSecond) * 10) / 10))
        onAddSection(time, e)
      }}
    >
      {labels.map(({ y, label, isWholeSecond }, i) => (
        y > -8 && (
          <span
            key={i}
            className={`absolute left-1 font-mono select-none ${isWholeSecond ? 'text-[9px] text-canvas-text' : 'text-[8px] text-canvas-muted'}`}
            style={{ top: y }}
          >
            {label}
          </span>
        )
      ))}
    </div>
  )
}
