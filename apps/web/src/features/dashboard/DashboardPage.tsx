import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout'
import { Button } from '../../components/ui'
import { useDashboard } from './useDashboard'
import { DashboardSongList } from './DashboardSongList'
import { useProjects } from '../projects/useProjects'
import { ProjectListSection } from '../projects/ProjectListSection'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useDashboard()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()

  const recentSongs = data?.recentSongs ?? []
  const assignedToMe = data?.assignedToMe ?? []
  const needsReview = data?.needsReview ?? []
  const activeProjects = projects.filter((project) => project.status === 'ACTIVE')

  return (
    <AppShell variant="management">
      <header className="mb-5 flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-shell-muted">Management</p>
        <h1 className="text-2xl font-semibold text-shell-text">Dashboard</h1>
        <p className="text-sm text-shell-muted">Cross-project production work, reviews, and recent activity.</p>
      </header>

      <section className="mb-5 grid gap-2 md:grid-cols-4" aria-label="Production summary">
        {[
          { label: 'Needs review', value: needsReview.length },
          { label: 'Assigned to me', value: assignedToMe.length },
          { label: 'Recent songs', value: recentSongs.length },
          { label: 'Active projects', value: activeProjects.length },
        ].map((item) => (
          <div key={item.label} className="rounded-md border border-shell-border bg-shell-surface px-3 py-2">
            <p className="text-xs text-shell-muted">{item.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-shell-text">{item.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-shell-text">Needs Review</h2>
            <DashboardSongList songs={needsReview} emptyLabel={isLoading ? 'Loading review queue...' : 'No songs need review.'} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-shell-text">Assigned to Me</h2>
            <DashboardSongList songs={assignedToMe} emptyLabel={isLoading ? 'Loading assignments...' : 'No assigned songs.'} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-shell-text">Recent Songs</h2>
            <DashboardSongList songs={recentSongs} emptyLabel={isLoading ? 'Loading recent songs...' : 'No recent songs yet.'} />
          </section>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-shell-text">My Projects</h2>
            <Button size="sm" variant="secondary" onClick={() => navigate('/projects')}>
              View all
            </Button>
          </div>
          <ProjectListSection projects={projects.slice(0, 6)} isLoading={projectsLoading} compact />
        </section>
      </div>
    </AppShell>
  )
}
