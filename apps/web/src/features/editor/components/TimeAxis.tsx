import { TIME_AXIS_WIDTH } from '../../../lib/constants'
import { TIME_MAX } from '@ama-midi/shared'
import { timeToBeat } from '../engine'

export interface TimeAxisProps {
  pxPerSecond:    number
  scrollTop:      number
  bpm?:           number
  timeSignature?: string
  onAddSection?:  (time: number, e: React.MouseEvent) => void
}

export function TimeAxis({
  pxPerSecond, scrollTop, bpm = 120, timeSignature = '4/4', onAddSection,
}: TimeAxisProps) {
  // Adaptive step: pick the smallest interval (in seconds) that keeps labels ≥24px apart.
  const MIN_LABEL_PX = 24
  const CANDIDATE_STEPS = [1, 2, 4, 5, 10, 15, 20, 30, 60]
  const stepSeconds = CANDIDATE_STEPS.find(s => s * pxPerSecond >= MIN_LABEL_PX) ?? 60

  const labels: { y: number; secText: string; beatText: string; isMeasureStart: boolean }[] = []
  for (let t = 0; t <= TIME_MAX; t += stepSeconds) {
    const y    = t * pxPerSecond
    const beat = timeToBeat(t, bpm, timeSignature)
    labels.push({
      y:              y - scrollTop,
      secText:        `${t}s`,
      beatText:       `${beat.measure}.${beat.beat}`,
      isMeasureStart: beat.beat === 1,
    })
  }

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
      {labels.map((label, i) => (
        <div
          key={i}
          className="absolute left-1 select-none flex flex-col leading-tight"
          style={{ top: label.y }}
        >
          {label.y > -8 && (
            <>
              <span className="text-[9px] text-canvas-muted font-mono">{label.secText}</span>
              <span className={
                'text-[8px] font-mono ' +
                (label.isMeasureStart ? 'text-canvas-text font-bold' : 'text-canvas-muted/60')
              }>
                {label.beatText}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
