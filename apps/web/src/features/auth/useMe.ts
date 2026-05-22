import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from './api'
import type { AuthUser } from '@ama-midi/shared'

export function useMe() {
  const token = useAuthStore((s) => s.token)
  return useQuery<AuthUser>({
    queryKey: ['me', token],
    queryFn: () => apiClient(token)<AuthUser>('/auth/me'),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
}
