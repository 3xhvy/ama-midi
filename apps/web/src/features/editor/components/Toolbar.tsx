import { MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { useThemeStore } from '../../../store/theme.store'
import { Avatar } from '../../../components/ui'
import type { SongStatus } from '@ama-midi/shared'
import { useAuthStore } from '../../../store/auth.store'
import { EditorBreadcrumb } from '../../navigation/EditorBreadcrumb'
import { ChartSwitcher } from '../../charts/ChartSwitcher'
import { AiAssistantTrigger } from './ai-assistant/AiAssistantTrigger'
import { SessionPresenceMenu } from '../../collaboration/SessionPresenceMenu'
import type { SongChart } from '@ama-midi/shared'

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
  canEdit,
  presenceList, isConnected = false,
  onShowShortcuts,
  leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight,
}: ToolbarProps) {
  const { resolved: theme, setMode: setTheme } = useThemeStore()
  const user = useAuthStore((s) => s.user)

  const showPrimary = (canEdit && activeChartId) || user

  return (
    <div className="flex w-full flex-col">
      <div className="flex h-12 w-full items-center gap-3">

        {/* LEFT — navigation context */}
        <div className="editor-toolbar-nav">
          <div className="editor-toolbar-nav-inner">
            <EditorBreadcrumb
              projectId={projectId}
              projectName={projectName}
              songId={songId}
              songName={songName}
              songStatus={songStatus}
            />
          </div>
          <span className="editor-toolbar-vsep" aria-hidden />
          <ChartSwitcher
            songId={songId}
            charts={charts}
            activeChartId={activeChartId}
          />
        </div>

        {/* RIGHT — actions */}
        <div className="editor-toolbar-actions">
          {showPrimary && (
            <>
              <div className="editor-toolbar-primary">
                {canEdit && activeChartId && <AiAssistantTrigger />}
                {user && (
                  <SessionPresenceMenu
                    users={presenceList}
                    currentUserId={user.id}
                    compact
                  />
                )}
              </div>
              <span className="editor-toolbar-vsep" aria-hidden />
            </>
          )}

          <div className="flex items-center gap-0.5">
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
          </div>

          {user && (
            <>
              <span className="editor-toolbar-vsep" aria-hidden />
              <div className="editor-toolbar-account">
                <div
                  className={`editor-toolbar-connection ${isConnected ? 'editor-toolbar-connection--live' : 'editor-toolbar-connection--reconnecting'}`}
                  title={isConnected ? 'Connected' : 'Reconnecting...'}
                />
                <Avatar
                  src={user.avatarUrl}
                  name={user.name}
                  size="xs"
                  title={user.name}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
