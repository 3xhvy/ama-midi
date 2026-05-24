import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../auth/api'
import { useAuthStore } from '../../store/auth.store'
import type {
  NotePattern,
  PatternNote,
  PatternPasteApplyRequest,
  PatternPasteApplyResult,
  PatternPastePreview,
  PatternPastePreviewRequest,
} from '@ama-midi/shared'

export function usePatterns() {
  const token = useAuthStore(s => s.token)
  return useQuery<NotePattern[]>({
    queryKey: ['patterns'],
    queryFn:  () => apiClient(token)<NotePattern[]>('/patterns'),
    enabled:  !!token,
  })
}

export function useCreatePattern() {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; notes: PatternNote[]; songId?: string }) =>
      apiClient(token)<NotePattern>('/patterns', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  })
}

export function useDeletePattern() {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(token)<void>(`/patterns/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  })
}

export function usePreviewPatternPaste(patternId?: string) {
  const token = useAuthStore(s => s.token)
  return useMutation({
    mutationFn: (body: PatternPastePreviewRequest) =>
      apiClient(token)<PatternPastePreview>(`/patterns/${patternId}/preview-paste`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })
}

export function useApplyPatternPaste(patternId?: string, chartId?: string) {
  const token = useAuthStore(s => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PatternPasteApplyRequest) =>
      apiClient(token)<PatternPasteApplyResult>(`/patterns/${patternId}/apply-paste`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (chartId) {
        qc.invalidateQueries({ queryKey: ['notes', chartId], exact: false })
      }
    },
  })
}
