import { useState } from 'react'
import { ProjectStatusEnum } from '@ama-midi/shared'
import { AppShell } from '../../components/layout'
import { Button, Input, Modal } from '../../components/ui'
import { useProjects, useCreateProject } from './useProjects'
import { ProjectListSection } from './ProjectListSection'
import { filterProjects, type ProjectDirectoryStatusFilter } from './project-directory-filters'

export function ProjectDashboardPage() {
  const { data: projects = [], isLoading } = useProjects()
  const createProject = useCreateProject()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ProjectDirectoryStatusFilter>('ALL')
  const filteredProjects = filterProjects(projects, { query, status })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createProject.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      { onSuccess: () => { setOpen(false); setName(''); setDescription('') } },
    )
  }

  return (
    <AppShell variant="management">
      <div className="mb-6 flex items-end justify-between gap-4" data-tour="projects-header">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-shell-muted">Management</p>
          <h1 className="mt-1 text-2xl font-semibold text-shell-text">Projects</h1>
          <p className="mt-1 text-sm text-shell-muted">Browse and enter production workspaces.</p>
        </div>
        <Button size="sm" rounded onClick={() => setOpen(true)}>+ New Project</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects..."
          className="max-w-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as ProjectDirectoryStatusFilter)}
          className="rounded-md border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="ALL">All statuses</option>
          {ProjectStatusEnum.entries.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.labelFallback}
            </option>
          ))}
        </select>
      </div>

      <ProjectListSection projects={filteredProjects} isLoading={isLoading} onCreateProject={() => setOpen(true)} />

      {open && (
        <Modal.Root open onOpenChange={setOpen}>
          <Modal.Content>
            <Modal.Header onClose={() => setOpen(false)}>New Project</Modal.Header>
            <Modal.Body>
              <form id="project-form" onSubmit={submit} className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" autoFocus />
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button type="submit" form="project-form" disabled={!name.trim()} loading={createProject.isPending}>Create</Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      )}
    </AppShell>
  )
}
