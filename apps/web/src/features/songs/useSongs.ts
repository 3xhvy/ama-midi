import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { Song } from '@ama-midi/shared'

export function useSongs() {
  const token = useAuthStore((s) => s.token)
  const client = apiClient(token)

  return useQuery<Song[]>({
    queryKey: ['songs'],
    queryFn: () => client<Song[]>('/songs'),
    enabled: !!token,
  })
}

export function useCreateSong() {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      apiClient(token)<Song>('/songs', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['songs'] }),
  })
}
