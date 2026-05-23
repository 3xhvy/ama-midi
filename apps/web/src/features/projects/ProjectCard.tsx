import { useNavigate } from 'react-router-dom'
import { ProjectStatusEnum, type Project } from '@ama-midi/shared'
import { Badge } from '../../components/ui'
import { timeAgo } from '../../lib/utils'

export function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}`)}
      className="w-full rounded-md border border-shell-border bg-shell-surface px-4 py-3 text-left transition-colors hover:bg-shell-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-shell-text">{project.name}</h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-shell-muted">{project.description}</p>
          )}
        </div>
        <Badge variant={ProjectStatusEnum.variant(project.status)} size="sm">
          {ProjectStatusEnum.label(project.status)}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-shell-muted">
        <span>{project.songCount} songs</span>
        <span>{project.memberCount} members</span>
        <span>Updated {timeAgo(project.updatedAt)}</span>
      </div>
    </button>
  )
}
