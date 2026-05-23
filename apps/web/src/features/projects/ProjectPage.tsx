import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../../components/layout'
import { Button, Tabs } from '../../components/ui'
import { useProject } from './useProjects'
import { useProjectSongs } from '../songs/useSongs'
import { SongTable } from '../songs/SongTable'
import { CreateSongWizard } from '../songs/CreateSongWizard'
import { MemberTable } from '../project-members/MemberTable'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: project } = useProject(projectId)
  const { data: songs = [] } = useProjectSongs(projectId)
  const [wizardOpen, setWizardOpen] = useState(false)

  if (!projectId) return null

  return (
    <AppShell>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-shell-muted">{project?.status ?? 'ACTIVE'}</p>
          <h1 className="mt-1 text-2xl font-semibold text-shell-text">{project?.name ?? 'Project'}</h1>
        </div>
        <Button size="sm" rounded onClick={() => setWizardOpen(true)}>+ New Song</Button>
      </div>

      <Tabs.Root defaultValue="songs">
        <Tabs.List>
          <Tabs.Trigger value="songs">songs</Tabs.Trigger>
          <Tabs.Trigger value="members">members</Tabs.Trigger>
          <Tabs.Trigger value="settings">settings</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="songs" className="pt-4">
          <SongTable projectId={projectId} songs={songs} />
        </Tabs.Content>
        <Tabs.Content value="members" className="pt-4">
          <MemberTable projectId={projectId} songs={songs} />
        </Tabs.Content>
        <Tabs.Content value="settings" className="pt-4">
          <div className="rounded-lg border border-shell-border bg-shell-surface p-4 text-sm text-shell-muted">
            Project settings are managed by project admins.
          </div>
        </Tabs.Content>
      </Tabs.Root>

      {wizardOpen && <CreateSongWizard projectId={projectId} songs={songs} onClose={() => setWizardOpen(false)} />}
    </AppShell>
  )
}
