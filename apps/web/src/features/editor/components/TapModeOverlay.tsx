import { trackColor } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { timeToY, trackToX, trackWidth } from '../engine'

interface Props {
  pxPerSecond:    number
  gridWidth:      number
  playheadTime:   number
  /** Map of track → startTime for keys currently held */
  inFlightTracks: Map<number, { startTime: number }>
}

export function TapModeOverlay({
  pxPerSecond,
  gridWidth,
  playheadTime,
  inFlightTracks,
}: Props) {
  const tapMode = useEditorStore((s) => s.tapMode)
  if (!tapMode) return null

  const tw = trackWidth(gridWidth)

  function renderNote(
    track: number,
    time: number,
    duration: number | undefined,
    key: string,
    className: string,
  ) {
    const x  = trackToX(track, gridWidth)
    const y  = timeToY(time, pxPerSecond)
    const cx = x + tw / 2
    const color = trackColor(track)

    if (duration != null && duration > 0) {
      const bodyHeight = Math.max(24, duration * pxPerSecond)
      return (
        <div
          key={key}
          className={`absolute pointer-events-none rounded-sm border-2 border-dashed ${className}`}
          style={{
            left:            cx - tw / 6,
            top:             y,
            width:           tw / 3,
            height:          bodyHeight,
            backgroundColor: `${color}44`,
            borderColor:     color,
          }}
        />
      )
    }

    return (
      <div
        key={key}
        className={`absolute w-4 h-4 rounded-full pointer-events-none border-2 border-dashed ${className}`}
        style={{
          left:            cx - 8,
          top:             y - 8,
          backgroundColor: `${color}44`,
          borderColor:     color,
        }}
      />
    )
  }

  return (
    <>
      {tapMode.draftNotes.map((note, i) =>
        renderNote(note.track, note.time, note.duration, `draft-${i}`, 'border-violet-400/80'),
      )}

      {Array.from(inFlightTracks.entries()).map(([track, { startTime }]) => {
        const growingDuration = Math.max(0, playheadTime - startTime)
        const isHold = growingDuration >= 0.15
        return renderNote(
          track,
          startTime,
          isHold ? Math.round(growingDuration * 100) / 100 : undefined,
          `inflight-${track}`,
          'border-violet-300 animate-pulse opacity-80',
        )
      })}
    </>
  )
}
