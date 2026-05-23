import { useNavigate } from 'react-router-dom'
import { ProjectSwitcher } from './ProjectSwitcher'
import { SongSwitcher } from '../editor/components/SongSwitcher'
import { projectPath } from './song-editor-path'

export function EditorBreadcrumb({
  projectId,
  projectName,
  songId,
  songName,
}: {
  projectId: string
  projectName: string
  songId: string
  songName: string
}) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <button
        type="button"
        onClick={() => navigate(projectPath(projectId))}
        className="text-shell-muted hover:text-shell-text text-sm transition-colors shrink-0"
      >
        ← Project
      </button>
      <ProjectSwitcher currentProjectId={projectId} currentProjectName={projectName} />
      <span className="text-shell-muted text-sm shrink-0">/</span>
      <SongSwitcher
        projectId={projectId}
        projectName={projectName}
        currentSongId={songId}
        currentSongName={songName}
      />
    </div>
  )
}
