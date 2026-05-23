import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../auth/api'
import { useAuthStore } from '../../../store/auth.store'
import type {
  NoteCopyApplyRequest,
  NoteCopyApplyResult,
  NoteCopyPreview,
  NoteCopyPreviewRequest,
} from '@ama-midi/shared'

export function usePreviewNoteCopy(songId: string) {
  const token = useAuthStore((s) => s.token)
  return useMutation({
    mutationFn: (body: NoteCopyPreviewRequest) =>
      apiClient(token)<NoteCopyPreview>(`/songs/${songId}/notes/copy-preview`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })
}

export function useApplyNoteCopy(songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NoteCopyApplyRequest) =>
      apiClient(token)<NoteCopyApplyResult>(`/songs/${songId}/notes/copy-apply`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', songId], exact: false })
      qc.invalidateQueries({ queryKey: ['validation', songId] })
    },
  })
}
