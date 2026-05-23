import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ChartAnalysisResult } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'

export function useChartAnalysis(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)

  return useQuery<ChartAnalysisResult>({
    queryKey: ['chart-analysis', chartId],
    queryFn: () => apiClient(token)<ChartAnalysisResult>(`/charts/${chartId}/analysis`),
    enabled: !!token && !!chartId,
  })
}

export function useRunChartAnalysis(chartId: string, songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiClient(token)<ChartAnalysisResult>(`/charts/${chartId}/analyze`, {
        method: 'POST',
      }),
    onSuccess: (result) => {
      qc.setQueryData(['chart-analysis', chartId], result)
      qc.invalidateQueries({ queryKey: ['charts', songId] })
      qc.invalidateQueries({ queryKey: ['chart', chartId] })
    },
    onError: () => toast.error('Analysis failed'),
  })
}
