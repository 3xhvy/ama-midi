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
import { BackingTrackMenu } from './BackingTrackMenu'
import { VolumeHoverControl } from './VolumeHoverControl'
import { unlockChartAudio } from '../audio/chart-audio'

interface TransportBarProps {
  songId: string
  song?: Song
  bpm: number
  canEdit: boolean
  chartSoundMuted: boolean
  chartSoundVolume: number
  onChartSoundMutedChange: (muted: boolean) => void
  onChartSoundVolumeChange: (volume: number) => void
  backingMuted: boolean
  backingVolume: number
  onBackingMutedChange: (muted: boolean) => void
  onBackingVolumeChange: (volume: number) => void
  hasBackingTrack: boolean
}

export function TransportBar({
  songId,
  song,
  bpm,
  canEdit,
  chartSoundMuted,
  chartSoundVolume,
  onChartSoundMutedChange,
  onChartSoundVolumeChange,
  backingMuted,
  backingVolume,
  onBackingMutedChange,
  onBackingVolumeChange,
  hasBackingTrack,
}: TransportBarProps) {
  const { isPlaying, setPlaying, playheadTime, setPlayheadTime, tapMode, setTapMode } = useEditorStore()
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
    <div data-tour="transport-bar" className="flex shrink-0 items-center gap-1.5">
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
        onClick={() => {
          if (!isPlaying) unlockChartAudio()
          setPlaying(!isPlaying)
        }}
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

      {tapMode && (
        <button
          type="button"
          onClick={() => setTapMode(null)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse hover:bg-red-500/30"
          title="Tap mode active — click to end session"
        >
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          TAP
        </button>
      )}

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

      <VolumeHoverControl
        muted={chartSoundMuted}
        volume={chartSoundVolume}
        onMutedChange={onChartSoundMutedChange}
        onVolumeChange={onChartSoundVolumeChange}
        title="Chart sounds"
        className="ml-1"
      />

      <BackingTrackMenu
        songId={songId}
        song={song}
        canEdit={canEdit}
        backingMuted={backingMuted}
        backingVolume={backingVolume}
        onBackingMutedChange={onBackingMutedChange}
        onBackingVolumeChange={onBackingVolumeChange}
        hasBackingTrack={hasBackingTrack}
      />
    </div>
  )
}
