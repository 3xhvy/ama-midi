import { useEffect, useState } from 'react'
import { ProjectStatusEnum, type Project, type ProjectStatus } from '@ama-midi/shared'
import { Button, Input, Modal } from '../../components/ui'
import { useUpdateProject } from './useUpdateProject'

export function EditProjectModal({
  project,
  open,
  onOpenChange,
}: {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateProject = useUpdateProject(project?.id)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE')

  useEffect(() => {
    if (!project) return
    setName(project.name)
    setDescription(project.description ?? '')
    setStatus(project.status)
  }, [project])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!project || !name.trim()) return

    updateProject.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        status,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  if (!project) return null

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content>
        <Modal.Header onClose={() => onOpenChange(false)}>Edit project</Modal.Header>
        <Modal.Body>
          <form id="edit-project-form" onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-shell-muted">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>

            <div>
              <label className="mb-1 block text-xs text-shell-muted">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-shell-muted">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ProjectStatusEnum.entries.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.labelFallback}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-project-form"
            size="sm"
            disabled={!name.trim()}
            loading={updateProject.isPending}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
