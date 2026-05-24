import { useEffect, useState } from 'react'
import { Pencil1Icon, PlusIcon } from '@radix-ui/react-icons'
import { useParams } from 'react-router-dom'
import { ProjectStatusEnum } from '@ama-midi/shared'
import { AppShell } from '../../components/layout'
import { Badge, Button, Tabs } from '../../components/ui'
import { BackNavLink } from '../navigation/BackNavLink'
import { timeAgo } from '../../lib/utils'
import { useProject } from './useProjects'
import { useProjectSongs } from '../songs/useSongs'
import { SongTable } from '../songs/SongTable'
import { CreateSongWizard } from '../songs/create-wizard/CreateSongWizard'
import { QuickCreateSongButton } from '../songs/QuickCreateSongButton'
import { EditProjectModal } from './EditProjectModal'
import { MemberTable } from '../project-members/MemberTable'
import { useProductTourStore } from '../onboarding/product-tour.store'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: project } = useProject(projectId)
  const { data: songs = [] } = useProjectSongs(projectId)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [tab, setTab] = useState('songs')
  const tourProjectTab = useProductTourStore((s) => s.projectTab)

  useEffect(() => {
    if (tourProjectTab) setTab(tourProjectTab)
  }, [tourProjectTab])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (wizardOpen) return
      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (target.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        document.getElementById('quick-create-trigger')?.click()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [wizardOpen])

  if (!projectId) return null

  return (
    <AppShell variant="management">
      <div
        data-tour="project-header"
        className="mb-5 flex flex-col gap-4 border-b border-shell-border pb-4 md:flex-row md:items-end md:justify-between"
      >
        <div className="min-w-0">
          <BackNavLink to="/projects" label="Projects" className="mb-2" />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-semibold text-shell-text">{project?.name ?? 'Project'}</h1>
            {project && (
              <Badge
                variant={ProjectStatusEnum.variant(project.status)}
                size="lg"
                className="ring-1 ring-inset ring-current/15"
              >
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
        <div className="flex shrink-0 gap-2">
          {project && (
            <Button
              size="sm"
              variant="secondary"
              rounded
              icon={<Pencil1Icon className="h-3.5 w-3.5" />}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          )}
          <QuickCreateSongButton projectId={projectId} disabled={wizardOpen} />
          <Button
            size="sm"
            variant="primary"
            rounded
            icon={<PlusIcon className="h-3.5 w-3.5" />}
            onClick={() => setWizardOpen(true)}
          >
            New Song
          </Button>
        </div>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List variant="management">
          <Tabs.Trigger value="songs">Songs</Tabs.Trigger>
          <Tabs.Trigger value="members" data-tour="project-members-tab">Members</Tabs.Trigger>
          <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
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

      {wizardOpen && <CreateSongWizard projectId={projectId} onClose={() => setWizardOpen(false)} />}
      <EditProjectModal project={project ?? null} open={editOpen} onOpenChange={setEditOpen} />
    </AppShell>
  )
}
