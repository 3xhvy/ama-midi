import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../auth/api'
import { useAuthStore } from '../../store/auth.store'
import type { SectionMarker } from '@ama-midi/shared'

export function useSections(songId: string) {
  const token = useAuthStore(s => s.token)
  return useQuery<SectionMarker[]>({
    queryKey: ['sections', songId],
    queryFn:  () => apiClient(token)<SectionMarker[]>(`/songs/${songId}/sections`),
    enabled:  !!token && !!songId,
  })
}

export function useCreateSection(songId: string) {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (body: { time: number; label: string; color?: string }) =>
      apiClient(token)<SectionMarker>(`/songs/${songId}/sections`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', songId] }),
  })
}

export function useUpdateSection(songId: string) {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { label?: string; color?: string } }) =>
      apiClient(token)<SectionMarker>(`/songs/${songId}/sections/${id}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', songId] }),
  })
}

export function useDeleteSection(songId: string) {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(token)<void>(`/songs/${songId}/sections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', songId] }),
  })
}
