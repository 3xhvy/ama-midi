import {
  MoonIcon,
  PauseIcon,
  PlayIcon,
  SunIcon,
  TrackNextIcon,
  TrackPreviousIcon,
} from '@radix-ui/react-icons'
import { useState } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { useThemeStore } from '../../../store/theme.store'
import { Avatar } from '../../../components/ui'
import type { SongStatus } from '@ama-midi/shared'
import { useNotes } from '../../notes/useNotes'
import { useAuthStore } from '../../../store/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../auth/api'
import { formatTime } from '../../../lib/utils'
import { EditorBreadcrumb } from '../../navigation/EditorBreadcrumb'
import { ChartSwitcher } from '../../charts/ChartSwitcher'
import { AiSuggestMenu } from './AiSuggestMenu'
import { PresenceBar } from '../../collaboration/PresenceBar'
import type { Song, SongChart } from '@ama-midi/shared'

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
  projectId:       string
  projectName:     string
  songId:          string
  songName:        string
  songStatus:      SongStatus
  charts:          SongChart[]
  activeChartId:   string | null
  canEdit:         boolean
  bpm:             number
  song?:           Song
  presenceList:    { id: string; name: string; avatarUrl?: string; title?: string | null; department?: string | null }[]
  isConnected?:    boolean
  onShowShortcuts: () => void
  leftCollapsed:   boolean
  rightCollapsed:  boolean
  onToggleLeft:    () => void
  onToggleRight:   () => void
}

export function Toolbar({
  projectId, projectName, songId, songName, songStatus,
  charts, activeChartId,
  canEdit, bpm, song,
  presenceList, isConnected = false,
  onShowShortcuts,
  leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight,
}: ToolbarProps) {
  const {
    isPlaying, setPlaying,
    playheadTime, setPlayheadTime,
  } = useEditorStore()

  const { resolved: theme, setMode: setTheme } = useThemeStore()
  const { data: notes = [] } = useNotes(activeChartId ?? undefined)
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
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
    <div className="flex w-full flex-col">
      <div className="flex h-12 w-full items-center gap-3">

      {/* LEFT — flat breadcrumb trail */}
      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        <EditorBreadcrumb
          projectId={projectId}
          projectName={projectName}
          songId={songId}
          songName={songName}
          songStatus={songStatus}
        />
        <ChartSwitcher
          songId={songId}
          charts={charts}
          activeChartId={activeChartId}
        />
      </div>

      {/* CENTER — transport (no chrome box) */}
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
            className="h-7 w-14 rounded-md border border-white/12 bg-white/5 px-2 text-center font-mono text-xs text-[var(--toolbar-text)] outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25"
          />
        ) : (
          <button
            type="button"
            className="editor-toolbar-bpm"
            onClick={() => { setBpmDraft(String(bpm)); setEditingBpm(true) }}
            title="Click to edit BPM"
          >
            <span className="opacity-60">♩</span>
            {bpm}
          </button>
        )}
      </div>

      {/* RIGHT — ghost actions */}
      <div className="flex shrink-0 items-center gap-0.5">
        {canEdit && activeChartId && (
          <AiSuggestMenu
            disabled={notes.length < 5}
            songId={songId}
            song={song}
            noteCount={notes.length}
          />
        )}

        <button
          type="button"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="editor-toolbar-icon"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <button
          type="button"
          title="Keyboard shortcuts"
          onClick={onShowShortcuts}
          data-tour="shortcut-help"
          className="editor-toolbar-icon text-sm font-medium"
        >
          ?
        </button>

        <button
          type="button"
          title={leftCollapsed ? 'Open left panel [' : 'Close left panel ['}
          onClick={onToggleLeft}
          className="editor-toolbar-icon hidden lg:inline-flex"
        >
          <PanelLeftIcon open={!leftCollapsed} />
        </button>

        <button
          type="button"
          title={rightCollapsed ? 'Open right panel ]' : 'Close right panel ]'}
          onClick={onToggleRight}
          className="editor-toolbar-icon"
        >
          <PanelRightIcon open={!rightCollapsed} />
        </button>

        <PresenceBar users={presenceList} />

        <div
          className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`}
          title={isConnected ? 'Connected' : 'Reconnecting...'}
        />

        {user && (
          <div className="ml-1 pl-1">
            <Avatar
              src={user.avatarUrl}
              name={user.name}
              size="xs"
              title={user.name}
            />
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
