import { MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { useState } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { useThemeStore }  from '../../../store/theme.store'
import { Button, IconButton, AvatarStack } from '../../../components/ui'
import { useCanEdit }    from '../../../hooks/useCanEdit'
import { useNotes }      from '../../notes/useNotes'
import { useAuthStore }  from '../../../store/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient }     from '../../auth/api'
import { formatTime }    from '../../../lib/utils'
import { SongSwitcher }  from './SongSwitcher'
import type { Song } from '@ama-midi/shared'

function PanelLeftIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="1" width="12" height="12" rx="1.5" />
      <line x1="5" y1="1.5" x2="5" y2="12.5" />
      {open
        ? <path d="M2.5 5.5L1 7l1.5 1.5" />
        : <path d="M2 5.5L3.5 7 2 8.5" />}
    </svg>
  )
}

function PanelRightIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="1" width="12" height="12" rx="1.5" />
      <line x1="9" y1="1.5" x2="9" y2="12.5" />
      {open
        ? <path d="M11.5 5.5L13 7l-1.5 1.5" />
        : <path d="M12 5.5L10.5 7 12 8.5" />}
    </svg>
  )
}

interface ToolbarProps {
  songId:          string
  songName:        string
  bpm:             number
  presenceList:    { id: string; name: string; avatarUrl?: string; title?: string | null; department?: string | null }[]
  onSuggest:       () => void
  onShowShortcuts: () => void
  onBack:          () => void
  leftCollapsed:   boolean
  rightCollapsed:  boolean
  onToggleLeft:    () => void
  onToggleRight:   () => void
}

export function Toolbar({
  songId, songName, bpm, presenceList,
  onSuggest, onShowShortcuts, onBack,
  leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight,
}: ToolbarProps) {
  const {
    isPlaying, setPlaying,
    playheadTime, setPlayheadTime,
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
    <div className="flex items-center w-full gap-3 h-12 px-4 overflow-hidden">

      {/* LEFT */}
      <div className="flex items-center gap-2 min-w-0">
        <IconButton
          size="sm"
          tooltip={leftCollapsed ? 'Open left panel [' : 'Close left panel ['}
          onClick={onToggleLeft}
        >
          <PanelLeftIcon open={!leftCollapsed} />
        </IconButton>
        <button
          onClick={onBack}
          className="text-shell-muted hover:text-shell-text text-sm transition-colors shrink-0"
        >
          ← Songs
        </button>
        <SongSwitcher currentSongId={songId} currentSongName={songName} />
      </div>

      {/* CENTER */}
      <div className="flex items-center gap-3 flex-1 justify-center min-w-0 overflow-hidden">
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

      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2 shrink-0">
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

        <IconButton
          size="sm"
          tooltip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </IconButton>

        <IconButton
          size="sm"
          tooltip="Keyboard shortcuts"
          onClick={onShowShortcuts}
          data-tour="shortcut-help"
        >
          ?
        </IconButton>

        <AvatarStack users={presenceList} max={4} size="xs" />

        <IconButton
          size="sm"
          tooltip={rightCollapsed ? 'Open right panel ]' : 'Close right panel ]'}
          onClick={onToggleRight}
        >
          <PanelRightIcon open={!rightCollapsed} />
        </IconButton>
      </div>
    </div>
  )
}
