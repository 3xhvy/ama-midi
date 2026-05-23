import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CHART_READ_ONLY_MESSAGES } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { Note } from '@ama-midi/shared'

export function useNotes(songId: string, timeFrom?: number, timeTo?: number) {
  const token = useAuthStore((s) => s.token)
  const params = new URLSearchParams()
  if (timeFrom !== undefined) params.set('timeFrom', String(timeFrom))
  if (timeTo !== undefined) params.set('timeTo', String(timeTo))
  const qs = params.toString()

  return useQuery<Note[]>({
    queryKey: ['notes', songId, timeFrom, timeTo],
    queryFn: () => apiClient(token)<Note[]>(`/songs/${songId}/notes${qs ? `?${qs}` : ''}`),
    enabled: !!token && !!songId,
    placeholderData: (prev) => prev,
  })
}

function mutationErrorMessage(err: Error & { status?: number; body?: { message?: string; error?: string } }, fallback: string) {
  if (err.status === 403) {
    return err.body?.message ?? CHART_READ_ONLY_MESSAGES.project_read
  }
  return fallback
}

export function useCreateNote(songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: { track: number; time: number; title: string; description?: string; noteType?: string; duration?: number }) =>
      apiClient(token)<Note>(`/songs/${songId}/notes`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', songId] })
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

export function useDeleteNote(songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (noteId: string) =>
      apiClient(token)<void>(`/songs/${songId}/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', songId] }),
    onError: (err: Error & { status?: number; body?: { message?: string; error?: string } }) => {
      toast.error(mutationErrorMessage(err, 'Failed to delete note'))
    },
  })
}

export function useUpdateNote(songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ noteId, ...body }: { noteId: string; title?: string; description?: string; noteType?: string; duration?: number }) =>
      apiClient(token)<Note>(`/songs/${songId}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes', songId] })
    },
    onError: (err: Error & { status?: number; body?: { message?: string; error?: string } }) => {
      toast.error(mutationErrorMessage(err, 'Failed to update note'))
    },
  })
}

export function useUndo(songId: string) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiClient(token)<{ noteId: string }>(`/songs/${songId}/events/undo`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', songId] }),
    onError: () => toast.error('Nothing to undo'),
  })
}
