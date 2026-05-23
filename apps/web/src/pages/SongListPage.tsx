import { Navigate } from 'react-router-dom'
import { AppShell } from '../components/layout'

export function SongListPage() {
  return (
    <AppShell>
      <Navigate to="/projects" replace />
    </AppShell>
  )
}
