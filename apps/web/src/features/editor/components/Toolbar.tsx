import { useState } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { useThemeStore }  from '../../../store/theme.store'
import { Button, IconButton, ToggleGroup, AvatarStack } from '../../../components/ui'
import { useCanEdit }    from '../../../hooks/useCanEdit'
import { useNotes }      from '../../notes/useNotes'
import { useAuthStore }  from '../../../store/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient }     from '../../auth/api'
import { formatTime }    from '../../../lib/utils'
import type { Song, NoteType } from '@ama-midi/shared'
import type { SnapMode } from '../engine/beat-calculator'

const VIEW_MODES = [
  { value: 'composer',  label: 'Composer' },
  { value: 'developer', label: 'Dev' },
  { value: 'qa',        label: 'QA' },
  { value: 'preview',   label: 'Preview' },
]

const ZOOM_MODES = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '4', label: '4x' },
  { value: '8', label: '8x' },
]

const SNAP_MODES: { value: SnapMode; label: string }[] = [
  { value: '0.1s',     label: '0.1s' },
  { value: 'beat',     label: 'Beat' },
  { value: 'halfBeat', label: '½' },
]

const TYPE_MODES: { value: NoteType; label: string }[] = [
  { value: 'TAP',   label: 'TAP' },
  { value: 'HOLD',  label: 'HOLD' },
  { value: 'SWIPE', label: 'SWIPE' },
]

interface ToolbarProps {
  songId:          string
  songName:        string
  bpm:             number
  presenceList:    { id: string; name: string; avatarUrl?: string; title?: string | null; department?: string | null }[]
  onSuggest:       () => void
  onShowShortcuts: () => void
  onBack:          () => void
}

export function Toolbar({
  songId, songName, bpm, presenceList,
  onSuggest, onShowShortcuts, onBack,
}: ToolbarProps) {
  const {
    viewMode, setViewMode,
    zoom, setZoom,
    isPlaying, setPlaying,
    playheadTime, setPlayheadTime,
    snapMode, setSnapMode,
    activeNoteType, setActiveNoteType,
    heatmapEnabled, setHeatmapEnabled,
    createMode, setCreateMode,
  } = useEditorStore()

  const { resolved: theme, setMode: setTheme } = useThemeStore()
  const canEdit     = useCanEdit()
  const { data: notes = [] } = useNotes(songId)
  const token       = useAuthStore(s => s.token)
  const queryClient = useQueryClient()

  const [editingBpm, setEditingBpm] = useState(false)
  const [bpmDraft,   setBpmDraft]   = useState(String(bpm))

  async function saveBpm() {
    setEditingBpm(false)
    const next = Math.max(40, Math.min(300, Number(bpmDraft) || 120))
    if (next === bpm) return
    await apiClient(token)<Song>(`/songs/${songId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ bpm: next }),
    })
    queryClient.invalidateQueries({ queryKey: ['song', songId] })
  }

  return (
    <div className="flex items-center w-full gap-3 h-12 px-4">

      {/* LEFT */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="text-shell-muted hover:text-shell-text text-sm transition-colors shrink-0"
        >
          ← Songs
        </button>
        <span className="text-shell-text font-medium text-sm truncate max-w-[160px]">
          {songName}
        </span>
      </div>

      {/* CENTER */}
      <div className="flex items-center gap-3 flex-1 justify-center flex-wrap">
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            onClick={() => { setPlayheadTime(0); setPlaying(false) }}
            tooltip="Jump to start"
          >
            ⏮
          </IconButton>

          <IconButton
            size="sm"
            onClick={() => setPlaying(!isPlaying)}
            tooltip={isPlaying ? 'Pause' : 'Play'}
            className="text-primary"
          >
            {isPlaying ? '⏸' : '▶'}
          </IconButton>

          <IconButton
            size="sm"
            onClick={() => { setPlayheadTime(300); setPlaying(false) }}
            tooltip="Jump to end"
          >
            ⏭
          </IconButton>
        </div>

        {/* Time display */}
        <span className="text-xs font-mono text-shell-muted w-16 tabular-nums">
          {formatTime(playheadTime)}
        </span>

        {/* BPM widget */}
        {editingBpm ? (
          <input
            autoFocus
            type="number"
            min={40}
            max={300}
            value={bpmDraft}
            onChange={(e) => setBpmDraft(e.target.value)}
            onBlur={saveBpm}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-16 px-2 py-0.5 text-xs bg-shell-bg border border-shell-border rounded text-shell-text"
          />
        ) : (
          <button
            className="text-xs font-mono text-shell-muted hover:text-shell-text px-2 py-0.5 rounded hover:bg-shell-bg"
            onClick={() => { setBpmDraft(String(bpm)); setEditingBpm(true) }}
            title="Click to edit BPM"
          >
            ♩ {bpm}
          </button>
        )}

        {/* Zoom */}
        <ToggleGroup
          items={ZOOM_MODES}
          value={String(zoom)}
          onValueChange={(v) => setZoom(Number(v) as 1 | 2 | 4 | 8)}
          variant="canvas"
        />

        {/* View mode */}
        <div data-tour="view-mode">
          <ToggleGroup
            items={VIEW_MODES}
            value={viewMode}
            onValueChange={(v) => setViewMode(v as typeof viewMode)}
            variant="canvas"
          />
        </div>

        {/* Snap mode */}
        <ToggleGroup
          items={SNAP_MODES.map(m => ({ value: m.value, label: m.label }))}
          value={snapMode}
          onValueChange={(v) => setSnapMode(v as SnapMode)}
          variant="canvas"
        />

        {/* Active note type */}
        <ToggleGroup
          items={TYPE_MODES.map(m => ({ value: m.value, label: m.label }))}
          value={activeNoteType}
          onValueChange={(v) => setActiveNoteType(v as NoteType)}
          variant="canvas"
        />

        {/* Create mode */}
        {canEdit && (
          <ToggleGroup
            items={[
              { value: 'fast',  label: '⚡ Fast' },
              { value: 'popup', label: '⊞ Popup' },
            ]}
            value={createMode}
            onValueChange={(v) => setCreateMode(v as 'fast' | 'popup')}
            variant="canvas"
          />
        )}
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2 shrink-0">
        <IconButton
          size="sm"
          tooltip={heatmapEnabled ? 'Hide difficulty heatmap' : 'Show difficulty heatmap'}
          onClick={() => setHeatmapEnabled(!heatmapEnabled)}
          className={heatmapEnabled ? 'text-warning' : ''}
        >
          {heatmapEnabled ? '🔥' : '⬛'}
        </IconButton>

        {canEdit && (
          <Button
            variant="primary"
            size="sm"
            rounded
            disabled={notes.length < 5}
            onClick={onSuggest}
            data-tour="ai-suggest"
          >
            ✨ Suggest
          </Button>
        )}

        <AvatarStack users={presenceList} max={4} size="xs" />

        <IconButton
          size="sm"
          tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </IconButton>

        <IconButton
          size="sm"
          tooltip="Keyboard shortcuts"
          onClick={onShowShortcuts}
          data-tour="shortcut-help"
        >
          ?
        </IconButton>
      </div>
    </div>
  )
}
