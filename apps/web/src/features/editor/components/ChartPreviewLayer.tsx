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

  return (
    <>
      {chartPreview.notes.map((note, i) => {
        const x = trackToX(note.track, gridWidth)
        const y = timeToY(note.time, pxPerSecond)
        const cx = x + tw / 2 - 8
        const color = trackColor(note.track)
        return (
          <div
            key={`${note.track}-${note.time}-${i}`}
            className="absolute z-[19] pointer-events-none"
            style={{ left: cx, top: y - 8 }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-dashed animate-ghost-pulse opacity-80"
              style={{ backgroundColor: `${color}44`, borderColor: color }}
              title={note.title ?? note.noteType ?? 'TAP'}
            />
          </div>
        )
      })}
    </>
  )
}
