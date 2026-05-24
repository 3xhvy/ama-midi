import {
  PauseIcon,
  PlayIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from '@radix-ui/react-icons'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Song } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { useAuthStore } from '../../../store/auth.store'
import { formatTime } from '../../../lib/utils'
import { apiClient } from '../../auth/api'

interface TransportBarProps {
  songId: string
  bpm: number
  canEdit: boolean
}

export function TransportBar({ songId, bpm, canEdit }: TransportBarProps) {
  const { isPlaying, setPlaying, playheadTime, setPlayheadTime } = useEditorStore()
  const token = useAuthStore((s) => s.token)
  const queryClient = useQueryClient()

  const [editingBpm, setEditingBpm] = useState(false)
  const [bpmDraft, setBpmDraft] = useState(String(bpm))

  async function saveBpm() {
    setEditingBpm(false)
    const next = Math.max(40, Math.min(300, Number(bpmDraft) || 120))
    if (next === bpm) return
    await apiClient(token)<Song>(`/songs/${songId}`, {
      method: 'PATCH',
      body: JSON.stringify({ bpm: next }),
    })
    queryClient.invalidateQueries({ queryKey: ['song', songId] })
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => { setPlayheadTime(0); setPlaying(false) }}
        title="Jump to start"
        aria-label="Jump to start"
        className="editor-toolbar-transport-btn"
      >
        <TrackPreviousIcon />
      </button>

      <button
        type="button"
        onClick={() => setPlaying(!isPlaying)}
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="editor-toolbar-play"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        onClick={() => { setPlayheadTime(300); setPlaying(false) }}
        title="Jump to end"
        aria-label="Jump to end"
        className="editor-toolbar-transport-btn"
      >
        <TrackNextIcon />
      </button>

      <span className="editor-toolbar-time mx-1">
        {formatTime(playheadTime)}
      </span>

      {editingBpm && canEdit ? (
        <input
          autoFocus
          type="number"
          min={40}
          max={300}
          value={bpmDraft}
          onChange={(e) => setBpmDraft(e.target.value)}
          onBlur={saveBpm}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-7 w-14 rounded-md border border-white/12 bg-white/5 px-2 text-center font-mono text-xs text-[var(--toolbar-text)] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
        />
      ) : (
        <button
          type="button"
          className="editor-toolbar-bpm"
          onClick={() => {
            if (!canEdit) return
            setBpmDraft(String(bpm))
            setEditingBpm(true)
          }}
          title={canEdit ? 'Click to edit BPM' : `BPM: ${bpm}`}
          disabled={!canEdit}
        >
          <span className="opacity-60">♩</span>
          {bpm}
        </button>
      )}
    </div>
  )
}
