import { trackToX, timeToY, trackWidth } from '../engine'
import { trackColor } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'

interface Props {
  gridWidth: number
  pxPerSecond: number
}

function isHoldPreview(note: { noteType?: string; duration?: number }) {
  return note.noteType === 'HOLD' || (note.duration != null && note.duration > 0)
}

export function ChartPreviewLayer({ gridWidth, pxPerSecond }: Props) {
  const chartPreview = useEditorStore((s) => s.chartPreview)
  if (!chartPreview) return null

  const tw = trackWidth(gridWidth)

  const conflictKeys = new Set(
    (chartPreview.placement?.conflicts ?? []).map((c) => `${c.track}:${c.time}`),
  )

  return (
    <>
      {chartPreview.notes.map((note, i) => {
        const x = trackToX(note.track, gridWidth)
        const y = timeToY(note.time, pxPerSecond)
        const cx = x + tw / 2
        const color = trackColor(note.track)
        const isConflictSlot =
          !chartPreview.replaceExisting && conflictKeys.has(`${note.track}:${note.time}`)
        const borderStyle = isConflictSlot ? 'border-solid' : 'border-dashed'
        const borderColor = isConflictSlot ? 'var(--conflict-warning, #fbbf24)' : color
        const className = `pointer-events-none animate-ghost-pulse ${
          isConflictSlot ? 'opacity-90' : 'opacity-80'
        }`

        if (isHoldPreview(note)) {
          const duration = note.duration ?? 0.15
          const bodyHeight = Math.max(24, duration * pxPerSecond)
          return (
            <div
              key={`${note.track}-${note.time}-${i}`}
              className={`absolute z-[19] rounded-sm border-2 ${borderStyle} ${className}`}
              style={{
                left:            cx - tw / 6,
                top:             y,
                width:           tw / 3,
                height:          bodyHeight,
                backgroundColor: `${color}44`,
                borderColor,
              }}
              title={`HOLD · ${duration}s`}
            />
          )
        }

        return (
          <div
            key={`${note.track}-${note.time}-${i}`}
            className="absolute z-[19] pointer-events-none"
            style={{ left: cx - 8, top: y - 8 }}
          >
            <div
              className={`w-4 h-4 rounded-full border-2 ${borderStyle} ${className}`}
              style={{
                backgroundColor: `${color}44`,
                borderColor,
              }}
              title={note.title ?? note.noteType ?? 'TAP'}
            />
          </div>
        )
      })}
    </>
  )
}
