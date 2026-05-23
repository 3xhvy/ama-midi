import type { Project } from '@ama-midi/shared'
import { Button } from '../../components/ui'
import { ProjectCard } from './ProjectCard'

export function ProjectListSection({
  projects,
  isLoading,
  compact = false,
  onCreateProject,
}: {
  projects: Project[]
  isLoading: boolean
  compact?: boolean
  onCreateProject?: () => void
}) {
  if (isLoading) return <p className="text-sm text-shell-muted">Loading projects…</p>

  if (!projects.length) {
    return (
      <div className="rounded-md border border-dashed border-shell-border bg-shell-surface p-5">
        <h2 className="text-sm font-semibold text-shell-text">No projects yet</h2>
        <p className="mt-1 text-sm text-shell-muted">Projects contain songs and members. Create one to start.</p>
        {onCreateProject && (
          <Button size="sm" className="mt-4" onClick={onCreateProject}>
            New Project
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
      {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
    </div>
  )
}
