import type { Project } from '@ama-midi/shared'
import { ProjectCard } from './ProjectCard'

export function ProjectListSection({
  projects,
  isLoading,
  compact = false,
}: {
  projects: Project[]
  isLoading: boolean
  compact?: boolean
}) {
  if (isLoading) return <p className="text-sm text-shell-muted">Loading projects…</p>

  if (!projects.length) {
    return (
      <div className="rounded-lg border border-shell-border bg-shell-surface p-6">
        <h2 className="text-sm font-semibold text-shell-text">No projects yet</h2>
        <p className="mt-2 text-sm text-shell-muted">Create a project before adding songs and members.</p>
      </div>
    )
  }

  return (
    <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
      {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
    </div>
  )
}
