import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { UserSearchResult } from '@ama-midi/shared'

export function useUserSearch(query: string) {
  const token = useAuthStore((s) => s.token)
  return useQuery<UserSearchResult[]>({
    queryKey: ['users-search', query],
    queryFn: () => apiClient(token)<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}`),
    enabled: !!token,
    staleTime: 30_000,
  })
}
