import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { UserSearchResult } from '@ama-midi/shared'

export function useUserSearch(projectId: string, query: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<UserSearchResult[]>({
    queryKey: ['users-search', projectId, query],
    queryFn: () => apiClient(token)<UserSearchResult[]>(
      `/users/search?projectId=${encodeURIComponent(projectId)}&q=${encodeURIComponent(query)}`,
    ),
    enabled: !!token && !!projectId,
    staleTime: 30_000,
  })
}
