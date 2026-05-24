import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout'
import { Badge, Button } from '../../components/ui'
import { cn } from '../../lib/utils'
import { useDashboard } from './useDashboard'
import { DashboardSongList } from './DashboardSongList'
import { DashboardStatCard } from './DashboardStatCard'
import { DashboardStatusBreakdown } from './DashboardStatusBreakdown'
import { uniqueDashboardSongs } from './dashboard-status-breakdown'
import { useProjects } from '../projects/useProjects'
import { ProjectListSection } from '../projects/ProjectListSection'

const QUEUE_SECTIONS = [
  {
    key: 'needsReview',
    title: 'Needs Review',
    accent: 'border-l-amber-500',
    badge: 'warning' as const,
    emptyLoading: 'Loading review queue...',
    emptyDefault: 'No songs need review.',
  },
  {
    key: 'assignedToMe',
    title: 'Assigned to Me',
    accent: 'border-l-blue-500',
    badge: 'info' as const,
    emptyLoading: 'Loading assignments...',
    emptyDefault: 'No assigned songs.',
  },
  {
    key: 'recentSongs',
    title: 'Recent Songs',
    accent: 'border-l-primary',
    badge: 'muted' as const,
    emptyLoading: 'Loading recent songs...',
    emptyDefault: 'No recent songs yet.',
  },
] as const

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useDashboard()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()

  const recentSongs = data?.recentSongs ?? []
  const assignedToMe = data?.assignedToMe ?? []
  const needsReview = data?.needsReview ?? []
  const activeProjects = projects.filter((project) => project.status === 'ACTIVE')
  const allQueueSongs = uniqueDashboardSongs(needsReview, assignedToMe, recentSongs)

  const queues = {
    needsReview,
    assignedToMe,
    recentSongs,
  }

  return (
    <AppShell variant="management">
      <header className="relative mb-5 overflow-hidden rounded-lg border border-shell-border bg-shell-surface px-4 py-4">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-amber-500/5 to-emerald-500/10"
          aria-hidden
        />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Management</p>
          <h1 className="mt-1 text-2xl font-semibold text-shell-text">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-shell-muted">
            Cross-project production work, reviews, and recent activity at a glance.
          </p>
        </div>
      </header>

      <section className="mb-5 grid gap-2 md:grid-cols-4" aria-label="Production summary">
        <DashboardStatCard label="Needs review" value={needsReview.length} accent="amber" icon="!" />
        <DashboardStatCard label="Assigned to me" value={assignedToMe.length} accent="blue" icon="◎" />
        <DashboardStatCard label="Recent songs" value={recentSongs.length} accent="purple" icon="♪" />
        <DashboardStatCard label="Active projects" value={activeProjects.length} accent="green" icon="▣" />
      </section>

      <div className="mb-5">
        <DashboardStatusBreakdown songs={allQueueSongs} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {QUEUE_SECTIONS.map((section) => {
          const songs = queues[section.key]
          return (
            <section
              key={section.key}
              className={cn(
                'rounded-lg border border-shell-border border-l-4 bg-shell-surface/50 pl-1',
                section.accent,
                section.key === 'recentSongs' && 'md:col-span-2',
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-shell-text">{section.title}</h2>
                  <Badge variant={section.badge} size="sm">
                    {songs.length}
                  </Badge>
                </div>
              </div>
              <div className="px-3 pb-3">
                <DashboardSongList
                  songs={songs}
                  emptyLabel={isLoading ? section.emptyLoading : section.emptyDefault}
                />
              </div>
            </section>
          )
        })}
      </div>

      <section data-tour="my-projects" className="mt-5 rounded-lg border border-shell-border bg-gradient-to-b from-primary/5 to-shell-surface p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-shell-text">My Projects</h2>
            <p className="text-xs text-shell-muted">{projects.length} total</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/projects')}>
            View all
          </Button>
        </div>
        <ProjectListSection projects={projects.slice(0, 6)} isLoading={projectsLoading} layout="full" />
      </section>
    </AppShell>
  )
}
