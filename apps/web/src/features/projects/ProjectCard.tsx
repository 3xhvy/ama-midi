import { useNavigate } from 'react-router-dom'
import { timeAgo } from '../../lib/utils'
import type { Project } from '@ama-midi/shared'

export function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}`)}
      className="text-left rounded-lg border border-shell-border bg-shell-surface p-4 hover:bg-shell-bg transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-shell-text truncate">{project.name}</h3>
        <span className="text-[10px] uppercase tracking-wide text-shell-muted">{project.status}</span>
      </div>
      {project.description && (
        <p className="mt-2 line-clamp-2 text-xs text-shell-muted">{project.description}</p>
      )}
      <div className="mt-4 flex items-center justify-between text-xs text-shell-muted">
        <span>{project.songCount} songs</span>
        <span>{project.memberCount} members</span>
        <span>{timeAgo(project.updatedAt)}</span>
      </div>
    </button>
  )
}
