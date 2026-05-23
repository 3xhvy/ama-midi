import { useState } from 'react'
import { Pencil1Icon } from '@radix-ui/react-icons'
import { useNavigate } from 'react-router-dom'
import { ProjectStatusEnum, type Project } from '@ama-midi/shared'
import { Badge, IconButton } from '../../components/ui'
import { cn, timeAgo } from '../../lib/utils'
import { EditProjectModal } from './EditProjectModal'

export function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)

  function openProject() {
    navigate(`/projects/${project.id}`)
  }

  return (
    <>
      <div
        className={cn(
          'w-full rounded-lg border border-shell-border bg-shell-surface px-4 py-3',
          'transition-all duration-150',
          'hover:bg-primary/[0.04] hover:ring-2 hover:ring-primary/30 dark:hover:bg-primary/[0.08]',
        )}
      >
        <button
          type="button"
          onClick={openProject}
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-shell-surface"
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
        </button>

        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={openProject}
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-shell-muted transition-colors hover:text-shell-text"
          >
            <span>{project.songCount} songs</span>
            <span>{project.memberCount} members</span>
            <span>Updated {timeAgo(project.updatedAt)}</span>
          </button>
          <IconButton
            size="sm"
            tooltip="Edit project"
            aria-label="Edit project"
            onClick={(e) => {
              e.stopPropagation()
              setEditOpen(true)
            }}
            className={cn(
              'shrink-0 rounded-full text-shell-muted',
              'hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/15',
            )}
          >
            <Pencil1Icon className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <EditProjectModal
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  )
}
