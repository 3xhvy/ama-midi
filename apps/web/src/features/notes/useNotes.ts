import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CHART_READ_ONLY_MESSAGES } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { Note } from '@ama-midi/shared'

function notesKey(chartId: string, timeFrom?: number, timeTo?: number) {
  return ['notes', chartId, timeFrom, timeTo] as const
}

function invalidateNotes(qc: ReturnType<typeof useQueryClient>, chartId: string) {
  qc.invalidateQueries({ queryKey: ['notes', chartId] })
  qc.invalidateQueries({ queryKey: ['chart-analysis', chartId] })
}

export function useNotes(chartId: string | undefined, timeFrom?: number, timeTo?: number) {
  const token = useAuthStore((s) => s.token)
  const params = new URLSearchParams()
  if (timeFrom !== undefined) params.set('timeFrom', String(timeFrom))
  if (timeTo !== undefined) params.set('timeTo', String(timeTo))
  const qs = params.toString()

  return useQuery<Note[]>({
    queryKey: notesKey(chartId ?? '', timeFrom, timeTo),
    queryFn: () =>
      apiClient(token)<Note[]>(`/charts/${chartId}/notes${qs ? `?${qs}` : ''}`),
    enabled: !!token && !!chartId,
    placeholderData: (prev) => prev,
  })
}

function mutationErrorMessage(
  err: Error & { status?: number; body?: { message?: string; error?: string } },
  fallback: string,
) {
  if (err.status === 403) {
    return err.body?.message ?? CHART_READ_ONLY_MESSAGES.project_read
  }
  return fallback
}

export function useCreateNote(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: {
      track: number
      time: number
      title: string
      description?: string
      noteType?: string
      duration?: number
    }) =>
      apiClient(token)<Note>(`/charts/${chartId}/notes`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (chartId) invalidateNotes(qc, chartId)
    },
    onError: (err: Error & { status?: number; body?: { message?: string; error?: string } }) => {
      if (err.status === 409) {
        toast.error('Position already taken')
      } else {
        toast.error(mutationErrorMessage(err, 'Failed to create note'))
      }
    },
  })
}

export function useDeleteNote(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (noteId: string) =>
      apiClient(token)<void>(`/charts/${chartId}/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (chartId) invalidateNotes(qc, chartId)
    },
    onError: (err: Error & { status?: number; body?: { message?: string; error?: string } }) => {
      toast.error(mutationErrorMessage(err, 'Failed to delete note'))
    },
  })
}

export function useUpdateNote(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({
      noteId,
      ...body
    }: {
      noteId: string
      title?: string
      description?: string
      noteType?: string
      duration?: number
    }) =>
      apiClient(token)<Note>(`/charts/${chartId}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (chartId) invalidateNotes(qc, chartId)
    },
    onError: (err: Error & { status?: number; body?: { message?: string; error?: string } }) => {
      toast.error(mutationErrorMessage(err, 'Failed to update note'))
    },
  })
}

export function useUndo(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiClient(token)<{ noteId: string }>(`/charts/${chartId}/events/undo`, {
        method: 'POST',
      }),
    onSuccess: () => {
      if (chartId) invalidateNotes(qc, chartId)
    },
    onError: () => toast.error('Nothing to undo'),
  })
}
