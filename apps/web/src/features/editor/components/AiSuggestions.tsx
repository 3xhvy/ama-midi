import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../../../store/auth.store'
import { useEditorStore } from '../../../store/editor.store'
import { apiClient } from '../../auth/api'
import { useCreateNote } from '../../notes/useNotes'
import { trackToX, timeToY, trackWidth } from '../engine'
import { trackColor, type NoteSuggestion } from '@ama-midi/shared'

interface Props {
  songId:      string
  chartId:     string
  gridWidth:   number
  pxPerSecond: number
  scrollTop:   number
}

export function AiSuggestions({ songId, chartId, gridWidth, pxPerSecond, scrollTop }: Props) {
  const [suggestions, setSuggestions] = useState<NoteSuggestion[]>([])
  const token = useAuthStore(s => s.token)
  const createNote = useCreateNote(chartId)
  const { setTriggerAiSuggest } = useEditorStore()

  useEffect(() => {
    setTriggerAiSuggest(handleSuggest)
    return () => setTriggerAiSuggest(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId])

  async function handleSuggest() {
    try {
      const result = await apiClient(token)<{ suggestions: NoteSuggestion[] }>(
        `/songs/${songId}/suggest-notes`,
        { method: 'POST' },
      )
      setSuggestions(result.suggestions)
      if (result.suggestions.length === 0) {
        toast.info('No suggestions available — add more notes first')
      }
    } catch {
      toast.error('Failed to get suggestions')
    }
  }

  function dismiss(idx: number) {
    setSuggestions(prev => prev.filter((_, i) => i !== idx))
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
        const x  = trackToX(s.track, gridWidth)
        const y  = timeToY(s.time, pxPerSecond) - scrollTop
        const cx = x + tw / 2 - 8
        const color = trackColor(s.track)
        return (
          <div
            key={i}
            className="absolute z-20 group pointer-events-auto"
            style={{ left: cx, top: y - 8 }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 animate-ghost-pulse"
              style={{ backgroundColor: `${color}33`, borderColor: color }}
            />
            <div className="absolute left-1/2 -translate-x-1/2 top-5 hidden group-hover:flex gap-1 z-30 whitespace-nowrap">
              <button
                onClick={() => accept(s, i)}
                className="px-2 py-0.5 text-xs bg-green-500 text-white rounded-full hover:bg-green-600"
              >✓</button>
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
