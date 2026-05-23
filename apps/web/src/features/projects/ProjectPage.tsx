import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ProjectStatusEnum } from '@ama-midi/shared'
import { AppShell } from '../../components/layout'
import { Badge, Button, Tabs } from '../../components/ui'
import { BackNavLink } from '../navigation/BackNavLink'
import { timeAgo } from '../../lib/utils'
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
    <AppShell variant="management">
      <div className="mb-5 flex flex-col gap-4 border-b border-shell-border pb-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <BackNavLink to="/projects" label="Projects" className="mb-2" />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold text-shell-text">{project?.name ?? 'Project'}</h1>
            {project && (
              <Badge variant={ProjectStatusEnum.variant(project.status)} size="sm">
                {ProjectStatusEnum.label(project.status)}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-shell-muted">
            <span>{songs.length} songs</span>
            {project && <span>{project.memberCount} members</span>}
            {project && <span>Updated {timeAgo(project.updatedAt)}</span>}
          </div>
        </div>
        <Button size="sm" rounded onClick={() => setWizardOpen(true)}>
          + New Song
        </Button>
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
