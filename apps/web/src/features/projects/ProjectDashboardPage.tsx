import { useState } from 'react'
import { AppShell } from '../../components/layout'
import { Button, Input, Modal } from '../../components/ui'
import { useProjects, useCreateProject } from './useProjects'
import { ProjectListSection } from './ProjectListSection'

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

      <ProjectListSection projects={projects} isLoading={isLoading} />

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
