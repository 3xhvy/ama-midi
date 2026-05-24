import { trackToX, timeToY, trackWidth } from '../engine'
import { trackColor } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'

interface Props {
  gridWidth: number
  pxPerSecond: number
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
        const cx = x + tw / 2 - 8
        const color = trackColor(note.track)
        const isConflictSlot =
          !chartPreview.replaceExisting && conflictKeys.has(`${note.track}:${note.time}`)
        return (
          <div
            key={`${note.track}-${note.time}-${i}`}
            className="absolute z-[19] pointer-events-none"
            style={{ left: cx, top: y - 8 }}
          >
            <div
              className={
                isConflictSlot
                  ? 'w-4 h-4 rounded-full border-2 border-solid animate-ghost-pulse opacity-90'
                  : 'w-4 h-4 rounded-full border-2 border-dashed animate-ghost-pulse opacity-80'
              }
              style={
                isConflictSlot
                  ? {
                      backgroundColor: `${color}44`,
                      borderColor: 'var(--conflict-warning, #fbbf24)',
                    }
                  : { backgroundColor: `${color}44`, borderColor: color }
              }
              title={note.title ?? note.noteType ?? 'TAP'}
            />
          </div>
        )
      })}
    </>
  )
}
