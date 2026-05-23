import { ChevronLeftIcon } from '@radix-ui/react-icons'
import { useNavigate } from 'react-router-dom'
import type { SongStatus } from '@ama-midi/shared'
import { ProjectSwitcher } from './ProjectSwitcher'
import { SongSwitcher } from '../editor/components/SongSwitcher'
import { SongStatusMenu } from '../songs/SongStatusMenu'
import { projectPath } from './song-editor-path'

export function EditorBreadcrumb({
  projectId,
  projectName,
  songId,
  songName,
  songStatus,
}: {
  projectId: string
  projectName: string
  songId: string
  songName: string
  songStatus: SongStatus
}) {
  const navigate = useNavigate()

  return (
    <nav aria-label="Editor location" className="flex min-w-0 items-center gap-0.5 text-sm">
      <button
        type="button"
        onClick={() => navigate(projectPath(projectId))}
        title={`Back to ${projectName}`}
        aria-label={`Back to ${projectName}`}
        className="inline-flex shrink-0 items-center rounded px-1 py-0.5 text-[var(--toolbar-muted)] transition-colors hover:text-[var(--toolbar-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
      </button>

      <span aria-hidden className="editor-toolbar-sep">/</span>

      <ProjectSwitcher
        variant="toolbar"
        accent="project"
        currentProjectId={projectId}
        currentProjectName={projectName}
      />

      <span aria-hidden className="editor-toolbar-sep">/</span>

      <SongSwitcher
        variant="toolbar"
        accent="song"
        projectId={projectId}
        projectName={projectName}
        currentSongId={songId}
        currentSongName={songName}
      />

      <SongStatusMenu
        songId={songId}
        projectId={projectId}
        status={songStatus}
        compact
        toolbar
      />
    </nav>
  )
}
