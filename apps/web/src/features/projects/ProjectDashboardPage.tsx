import { useState } from 'react'
import { AppShell } from '../../components/layout'
import { Button, Input, Modal } from '../../components/ui'
import { useProjects, useCreateProject } from './useProjects'
import { ProjectCard } from './ProjectCard'

export function ProjectDashboardPage() {
  const { data: projects = [], isLoading } = useProjects()
  const createProject = useCreateProject()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createProject.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      { onSuccess: () => { setOpen(false); setName(''); setDescription('') } },
    )
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-shell-muted">Production workspace</p>
          <h1 className="mt-1 text-2xl font-semibold text-shell-text">My Projects</h1>
        </div>
        <Button size="sm" rounded onClick={() => setOpen(true)}>+ New Project</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-shell-muted">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-shell-border bg-shell-surface p-6">
          <h2 className="text-sm font-semibold text-shell-text">No projects yet</h2>
          <p className="mt-2 text-sm text-shell-muted">Create a project before adding songs and members.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}

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
