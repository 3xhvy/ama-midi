import { toast } from 'sonner'
import { useEditorStore } from '../../../store/editor.store'
import { useCreateNote } from '../../notes/useNotes'
import { trackToX, timeToY, trackWidth } from '../engine'
import {
  trackColor,
  type Note,
  type NoteSuggestion,
} from '@ama-midi/shared'

interface Props {
  songId:      string
  chartId:     string
  gridWidth:   number
  pxPerSecond: number
  notes:       Note[]
}

export function AiSuggestions({ chartId, gridWidth, pxPerSecond, notes }: Props) {
  const suggestions = useEditorStore((s) => s.aiSuggestions)
  const setAiSuggestions = useEditorStore((s) => s.setAiSuggestions)
  const createNote = useCreateNote(chartId)

  const occupiedKeys = new Set(
    notes.map((n) => `${n.track}:${Math.round(n.time * 10) / 10}`),
  )

  function dismiss(idx: number) {
    setAiSuggestions(suggestions.filter((_, i) => i !== idx))
  }

  async function accept(s: NoteSuggestion, idx: number) {
    dismiss(idx)
    createNote.mutate(
      { track: s.track, time: s.time, title: 'AI Suggestion' },
      {
        onError: (err: Error & { status?: number }) => {
          if (err.status === 409) toast.error('That spot was just taken — try another suggestion')
        },
      },
    )
  }

  const tw = trackWidth(gridWidth)

  return (
    <>
      {suggestions.map((s, i) => {
        const key = `${s.track}:${Math.round(s.time * 10) / 10}`
        const isConflict = occupiedKeys.has(key)
        const x  = trackToX(s.track, gridWidth)
        const y  = timeToY(s.time, pxPerSecond)
        const cx = x + tw / 2 - 8
        const color = trackColor(s.track)
        return (
          <div
            key={`${s.track}-${s.time}-${i}`}
            className="absolute z-20 group pointer-events-auto"
            style={{ left: cx, top: y - 8 }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 animate-ghost-pulse"
              style={{
                backgroundColor: isConflict ? 'rgba(239,68,68,0.2)' : `${color}33`,
                borderColor: isConflict ? 'rgb(239,68,68)' : color,
              }}
              title={isConflict ? 'Conflict — a note already exists here' : undefined}
            />
            <div className="absolute left-1/2 -translate-x-1/2 top-5 hidden group-hover:flex gap-1 z-30 whitespace-nowrap">
              {!isConflict && (
                <button
                  onClick={() => accept(s, i)}
                  className="px-2 py-0.5 text-xs bg-green-500 text-white rounded-full hover:bg-green-600"
                >✓</button>
              )}
              <button
                onClick={() => dismiss(i)}
                className="px-2 py-0.5 text-xs bg-gray-500 text-white rounded-full hover:bg-gray-600"
              >✕</button>
            </div>
          </div>
        )
      })}
    </>
  )
}
