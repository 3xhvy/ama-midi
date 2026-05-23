import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SongChart } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'

export function useDuplicateChart(chartId: string, songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body?: { name?: string; speedMultiplier?: number }) =>
      apiClient(token)<SongChart>(`/charts/${chartId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charts', songId] })
      toast.success('Chart duplicated')
    },
    onError: () => toast.error('Could not duplicate chart'),
  })
}
