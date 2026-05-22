import { useEditorStore } from '../../../store/editor.store'
import { useThemeStore }  from '../../../store/theme.store'
import { Button, IconButton, ToggleGroup, AvatarStack } from '../../../components/ui'
import { useCanEdit }  from '../../../hooks/useCanEdit'
import { useNotes }    from '../../notes/useNotes'
import { formatTime }  from '../../../lib/utils'

const VIEW_MODES = [
  { value: 'composer',  label: 'Composer' },
  { value: 'developer', label: 'Dev' },
  { value: 'qa',        label: 'QA' },
]

const ZOOM_MODES = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '4', label: '4x' },
]

interface ToolbarProps {
  songId:          string
  songName:        string
  presenceList:    { id: string; name: string; avatarUrl?: string; title?: string | null; department?: string | null }[]
  onSuggest:       () => void
  onShowShortcuts: () => void
  onBack:          () => void
}

export function Toolbar({
  songId, songName, presenceList,
  onSuggest, onShowShortcuts, onBack,
}: ToolbarProps) {
  const {
    viewMode, setViewMode,
    zoom, setZoom,
    isPlaying, setPlaying,
    playheadTime, setPlayheadTime,
  } = useEditorStore()

  const { resolved: theme, setMode: setTheme } = useThemeStore()
  const canEdit = useCanEdit()
  const { data: notes = [] } = useNotes(songId)

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
      <div className="flex items-center gap-3 flex-1 justify-center">
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

        {/* Zoom */}
        <ToggleGroup
          items={ZOOM_MODES}
          value={String(zoom)}
          onValueChange={(v) => setZoom(Number(v) as 1 | 2 | 4)}
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
