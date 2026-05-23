import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../auth/api'
import { useAuthStore } from '../../../store/auth.store'
import type {
  NoteCopyApplyRequest,
  NoteCopyApplyResult,
  NoteCopyPreview,
  NoteCopyPreviewRequest,
} from '@ama-midi/shared'

function requireChartId(chartId: string | undefined): asserts chartId is string {
  if (!chartId) throw new Error('No chart selected')
}

export function usePreviewNoteCopy(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  return useMutation({
    mutationFn: (body: NoteCopyPreviewRequest) => {
      requireChartId(chartId)
      return apiClient(token)<NoteCopyPreview>(`/charts/${chartId}/notes/copy-preview`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
  })
}

export function useApplyNoteCopy(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NoteCopyApplyRequest) => {
      requireChartId(chartId)
      return apiClient(token)<NoteCopyApplyResult>(`/charts/${chartId}/notes/copy-apply`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      if (!chartId) return
      qc.invalidateQueries({ queryKey: ['notes', chartId], exact: false })
      qc.invalidateQueries({ queryKey: ['chart-analysis', chartId] })
    },
  })
}
