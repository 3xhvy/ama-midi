import { useEditorStore } from '../../../store/editor.store'
import { timeToY, trackToX, trackWidth } from '../engine'

interface Props {
  pxPerSecond:    number
  gridWidth:      number
  scrollTop:      number
  playheadTime:   number
  /** Map of track → startTime for keys currently held */
  inFlightTracks: Map<number, { startTime: number }>
}

export function TapModeOverlay({
  pxPerSecond,
  gridWidth,
  scrollTop,
  playheadTime,
  inFlightTracks,
}: Props) {
  const tapMode = useEditorStore((s) => s.tapMode)
  if (!tapMode) return null

  const tw = trackWidth(gridWidth)

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Finalized draft notes — semi-transparent with dashed border */}
      {tapMode.draftNotes.map((note, i) => {
        const y = timeToY(note.time, pxPerSecond) - scrollTop
        const x = trackToX(note.track, gridWidth)
        const h = note.duration
          ? Math.max(8, note.duration * pxPerSecond)
          : 20
        return (
          <div
            key={i}
            className="absolute rounded-full border-2 border-dashed border-violet-400 bg-violet-400/30"
            style={{ top: y - h / 2, left: x + 2, width: tw - 4, height: h }}
          />
        )
      })}

      {/* Growing ghost notes for held keys */}
      {Array.from(inFlightTracks.entries()).map(([track, { startTime }]) => {
        const growingDuration = Math.max(0, playheadTime - startTime)
        const y = timeToY(startTime, pxPerSecond) - scrollTop
        const x = trackToX(track, gridWidth)
        const h = Math.max(8, growingDuration * pxPerSecond)
        return (
          <div
            key={`inflight-${track}`}
            className="absolute rounded-full bg-violet-500/50 animate-pulse"
            style={{ top: y - h / 2, left: x + 2, width: tw - 4, height: h }}
          />
        )
      })}
    </div>
  )
}
