import { useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../../../store/auth.store'
import { apiClient } from '../../auth/api'
import { useCreateNote } from '../../notes/useNotes'
import { trackToX, timeToY } from '../engine/coordinate-mapper'
import type { Note } from '@ama-midi/shared'

interface NoteSuggestion {
  track: number
  time: number
  color: string
}

interface Props {
  songId: string
  notes: Note[]
  gridWidth: number
  pxPerSecond: number
  scrollTop: number
}

export function AiSuggestions({ songId, notes, gridWidth, pxPerSecond, scrollTop }: Props) {
  const [suggestions, setSuggestions] = useState<NoteSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const token = useAuthStore(s => s.token)
  const createNote = useCreateNote(songId)

  const canSuggest = notes.length >= 5

  async function handleSuggest() {
    setLoading(true)
    try {
      const result = await apiClient(token)<{ suggestions: NoteSuggestion[] }>(`/songs/${songId}/suggest-notes`, { method: 'POST' })
      setSuggestions(result.suggestions)
      if (result.suggestions.length === 0) toast.info('No suggestions available — add more notes first')
    } catch {
      toast.error('Failed to get suggestions')
    } finally {
      setLoading(false)
    }
  }

  function dismiss(idx: number) {
    setSuggestions(prev => prev.filter((_, i) => i !== idx))
  }

  async function accept(s: NoteSuggestion, idx: number) {
    dismiss(idx)
    createNote.mutate({
      track: s.track, time: s.time, color: s.color, title: 'AI Suggestion',
    }, {
      onError: (err: Error & { status?: number }) => {
        if (err.status === 409) toast.error('That spot was just taken — try another suggestion')
      },
    })
  }

  const colW = gridWidth / 8

  return (
    <>
      {/* Floating suggest button in top-right of the piano roll */}
      <div className="absolute top-2 right-2 z-30 pointer-events-auto">
        <button
          onClick={handleSuggest}
          disabled={!canSuggest || loading}
          title={!canSuggest ? 'Place at least 5 notes to get AI suggestions' : 'Get AI note suggestions'}
          className="px-3 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded-md hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '…' : '✦ Suggest'}
        </button>
      </div>

      {/* Ghost notes overlaid on the grid */}
      {suggestions.map((s, i) => {
        const x = trackToX(s.track, gridWidth)
        const y = timeToY(s.time, pxPerSecond) - scrollTop
        return (
          <div
            key={i}
            className="absolute z-20 group pointer-events-auto"
            style={{ left: x - colW / 2, top: y - 8, width: colW, height: 16 }}
          >
            <div
              className="w-4 h-4 rounded-full mx-auto note-ghost"
              style={{
                backgroundColor: s.color,
                opacity: 0.4,
                border: `2px dashed ${s.color}`,
              }}
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
