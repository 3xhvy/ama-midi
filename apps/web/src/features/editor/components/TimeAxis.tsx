import { TIME_AXIS_WIDTH } from '../../../lib/constants'
import { TIME_MAX } from '@ama-midi/shared'

export interface TimeAxisProps {
  pxPerSecond: number
  scrollTop:   number
}

export function TimeAxis({ pxPerSecond, scrollTop }: TimeAxisProps) {
  const totalHeight = TIME_MAX * pxPerSecond
  const labels: { y: number; text: string }[] = []
  const step = pxPerSecond * 10
  for (let y = 0; y <= totalHeight; y += step) {
    const time = Math.round(y / pxPerSecond)
    labels.push({ y: y - scrollTop, text: `${time}s` })
  }

  return (
    <div
      className="shrink-0 relative overflow-hidden bg-canvas-surface border-r border-canvas-border"
      style={{ width: TIME_AXIS_WIDTH }}
    >
      {labels.map((label) => (
        <span
          key={label.text}
          className="absolute left-1 text-[9px] text-canvas-muted font-mono select-none"
          style={{ top: label.y }}
        >
          {label.text}
        </span>
      ))}
    </div>
  )
}
