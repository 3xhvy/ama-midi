import { useEffect, useRef, useState } from 'react'
import { SpeakerLoudIcon, SpeakerOffIcon } from '@radix-ui/react-icons'
import { cn } from '../../../lib/utils'

interface Props {
  muted: boolean
  volume: number
  onMutedChange: (muted: boolean) => void
  onVolumeChange: (volume: number) => void
  title?: string
  className?: string
}

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value))
}

function VerticalVolumeSlider({
  value,
  onChange,
  onDragChange,
}: {
  value: number
  onChange: (value: number) => void
  onDragChange: (dragging: boolean) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  function updateFromClientY(clientY: number) {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const ratio = 1 - (clientY - rect.top) / rect.height
    onChangeRef.current(clampVolume(ratio))
  }

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current) return
      updateFromClientY(e.clientY)
    }

    function onPointerUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      onDragChange(false)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [onDragChange])

  const pct = Math.round(value * 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] font-mono tabular-nums text-shell-muted">{pct}%</span>
      <div
        ref={trackRef}
        className="relative h-24 w-7 cursor-pointer touch-none"
        onPointerDown={(e) => {
          draggingRef.current = true
          onDragChange(true)
          trackRef.current?.setPointerCapture(e.pointerId)
          updateFromClientY(e.clientY)
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Volume"
      >
        <div className="absolute inset-x-[11px] top-0 bottom-0 rounded-full bg-shell-border/80" />
        <div
          className="absolute inset-x-[11px] bottom-0 rounded-full bg-primary/80"
          style={{ height: `${pct}%` }}
        />
        <div
          className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-white shadow-sm"
          style={{ bottom: `calc(${pct}% - 6px)` }}
        />
      </div>
    </div>
  )
}

export function VolumeHoverControl({
  muted,
  volume,
  onMutedChange,
  onVolumeChange,
  title = 'Volume',
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const hideTimerRef = useRef<number | null>(null)
  const draggingRef = useRef(false)

  const displayVolume = muted ? 0 : volume

  function clearHideTimer() {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  function showPanel() {
    clearHideTimer()
    setOpen(true)
  }

  function scheduleHide() {
    if (draggingRef.current) return
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => setOpen(false), 180)
  }

  function applyVolume(next: number) {
    const clamped = clampVolume(next)
    onVolumeChange(clamped)
    if (clamped > 0 && muted) onMutedChange(false)
    if (clamped === 0) onMutedChange(true)
  }

  function toggleMute() {
    if (muted && volume === 0) onVolumeChange(0.75)
    onMutedChange(!muted)
  }

  return (
    <div
      className={cn('relative flex items-center', className)}
      onMouseEnter={showPanel}
      onMouseLeave={scheduleHide}
    >
      <button
        type="button"
        onClick={toggleMute}
        title={muted ? `${title} muted — click to unmute` : `${title} — hover to adjust`}
        aria-label={title}
        className="editor-toolbar-transport-btn"
      >
        {muted || displayVolume === 0 ? <SpeakerOffIcon /> : <SpeakerLoudIcon />}
      </button>

      {open && (
        <div
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-lg border border-shell-border bg-shell-surface px-2.5 py-2 shadow-lg"
          onMouseEnter={showPanel}
          onMouseLeave={scheduleHide}
        >
          <VerticalVolumeSlider
            value={displayVolume}
            onChange={applyVolume}
            onDragChange={(dragging) => {
              draggingRef.current = dragging
              if (dragging) showPanel()
            }}
          />
        </div>
      )}
    </div>
  )
}
