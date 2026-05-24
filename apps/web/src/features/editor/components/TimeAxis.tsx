import { useCallback, useRef } from 'react'
import { TIME_AXIS_WIDTH } from '../../../lib/constants'
import { TIME_MAX } from '@ama-midi/shared'
import { getTimeAxisLabels, timeToY, yToTime } from '../engine'
import type { SnapMode } from '../engine/beat-calculator'

export interface TimeAxisProps {
  pxPerSecond:    number
  scrollTop:      number
  playheadTime:   number
  snapMode:       SnapMode
  bpm:            number
  onSeek:         (time: number) => void
  onAddSection?:  (time: number, e: React.MouseEvent | MouseEvent) => void
}

const DRAG_THRESHOLD_PX = 4

export function TimeAxis({
  pxPerSecond,
  scrollTop,
  playheadTime,
  snapMode,
  bpm,
  onSeek,
  onAddSection,
}: TimeAxisProps) {
  const labels = getTimeAxisLabels(pxPerSecond, scrollTop, TIME_MAX)
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ active: boolean; moved: boolean; startY: number; altIntent: boolean } | null>(null)

  const timeAtClientY = useCallback((clientY: number) => {
    const root = rootRef.current
    if (!root) return playheadTime
    const rect = root.getBoundingClientRect()
    const y = clientY - rect.top + scrollTop
    return yToTime(y, pxPerSecond, snapMode, bpm)
  }, [bpm, pxPerSecond, scrollTop, snapMode])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      active: true,
      moved: false,
      startY: e.clientY,
      altIntent: e.altKey,
    }
    if (!e.altKey) onSeek(timeAtClientY(e.clientY))
  }, [onSeek, timeAtClientY])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag?.active || drag.altIntent) return
    if (Math.abs(e.clientY - drag.startY) >= DRAG_THRESHOLD_PX) drag.moved = true
    onSeek(timeAtClientY(e.clientY))
  }, [onSeek, timeAtClientY])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.active) return
    e.currentTarget.releasePointerCapture(e.pointerId)

    if (drag.altIntent && onAddSection) {
      const time = timeAtClientY(e.clientY)
      onAddSection(time, e.nativeEvent)
      return
    }

    if (!drag.moved) onSeek(timeAtClientY(e.clientY))
  }, [onAddSection, onSeek, timeAtClientY])

  const playheadY = timeToY(playheadTime, pxPerSecond) - scrollTop

  return (
    <div
      ref={rootRef}
      className="shrink-0 relative overflow-hidden bg-canvas-surface border-r border-canvas-border cursor-ns-resize touch-none"
      style={{ width: TIME_AXIS_WIDTH }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title="Click or drag to move playhead · Alt+click to add section"
    >
      {labels.map(({ y, label, isWholeSecond }, i) => (
        y > -8 && (
          <span
            key={i}
            className={`absolute left-1 font-mono select-none pointer-events-none ${isWholeSecond ? 'text-[9px] text-canvas-text' : 'text-[8px] text-canvas-muted'}`}
            style={{ top: y }}
          >
            {label}
          </span>
        )
      ))}

      <div
        className="absolute left-0 right-0 top-0 flex items-center pointer-events-none z-10"
        style={{ transform: `translateY(${playheadY}px) translateY(-50%)` }}
      >
        <div className="h-[2px] min-w-0 flex-1 bg-primary opacity-90" />
        <div
          className="h-0 w-0 shrink-0"
          style={{
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderLeft: '6px solid #6C63FF',
          }}
        />
      </div>
    </div>
  )
}
