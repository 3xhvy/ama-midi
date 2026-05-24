import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SongChart } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'

export function useCharts(songId: string) {
  const token = useAuthStore((s) => s.token)

  return useQuery<SongChart[]>({
    queryKey: ['charts', songId],
    queryFn: () => apiClient(token)<SongChart[]>(`/songs/${songId}/charts`),
    enabled: !!token && !!songId,
  })
}

export function useChart(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)

  return useQuery<SongChart>({
    queryKey: ['chart', chartId],
    queryFn: () => apiClient(token)<SongChart>(`/charts/${chartId}`),
    enabled: !!token && !!chartId,
  })
}

export function useCreateChart(songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: { name: string; speedMultiplier?: number }) =>
      apiClient(token)<SongChart>(`/songs/${songId}/charts`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charts', songId] })
      qc.invalidateQueries({ queryKey: ['project-songs', songId] })
    },
    onError: () => toast.error('Could not create chart'),
  })
}

export function useUpdateChart(chartId: string, songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: { name?: string; speedMultiplier?: number }) =>
      apiClient(token)<SongChart>(`/charts/${chartId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (chart) => {
      qc.setQueryData(['chart', chartId], chart)
      qc.invalidateQueries({ queryKey: ['charts', songId] })
    },
    onError: () => toast.error('Could not update chart settings'),
  })
}
