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

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-sm text-shell-muted">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold text-shell-text">Jump back into work</h1>
      </header>

      <div className="grid gap-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-shell-text">Recent Songs</h2>
          <DashboardSongList
            songs={data?.recentSongs ?? []}
            emptyLabel={isLoading ? 'Loading…' : 'No recent songs yet.'}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-shell-text">Needs Review</h2>
          <DashboardSongList
            songs={data?.needsReview ?? []}
            emptyLabel="Nothing waiting for your review."
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-shell-text">Assigned to Me</h2>
          <DashboardSongList
            songs={data?.assignedToMe ?? []}
            emptyLabel="No assigned songs."
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
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
