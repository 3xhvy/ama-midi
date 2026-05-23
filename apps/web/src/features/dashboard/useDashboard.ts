import { useQuery } from '@tanstack/react-query'
import type { DashboardFeed } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'

export function useDashboard() {
  const token = useAuthStore((s) => s.token)
  return useQuery<DashboardFeed>({
    queryKey: ['dashboard'],
    queryFn: () => apiClient(token)<DashboardFeed>('/dashboard'),
    enabled: !!token,
  })
}
