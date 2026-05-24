import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CHART_READ_ONLY_MESSAGES } from '@ama-midi/shared'
import { useAuthStore } from '../../store/auth.store'
import { apiClient, extractApiErrorMessage } from '../auth/api'
import type { Note, UndoPreview } from '@ama-midi/shared'
import type { UndoResolution } from '../undo/undo.types'

function undoErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: number }).status
    if (status === 404) return 'Nothing to undo'
  }
  return extractApiErrorMessage(err, 'Undo failed')
}

function notesKey(chartId: string, timeFrom?: number, timeTo?: number) {
  return ['notes', chartId, timeFrom, timeTo] as const
}

function invalidateNotes(qc: ReturnType<typeof useQueryClient>, chartId: string) {
  qc.invalidateQueries({ queryKey: ['notes', chartId] })
  qc.invalidateQueries({ queryKey: ['chart-analysis', chartId] })
}

/** Predicate matching all active note queries for a chart (full + all viewport buckets). */
function notesPredicate(chartId: string) {
  return {
    predicate: (q: { queryKey: unknown }) =>
      Array.isArray(q.queryKey) &&
      q.queryKey[0] === 'notes' &&
      q.queryKey[1] === chartId,
  }
}

/** Patch all cached note lists without triggering a refetch. */
function patchNotesCache(
  qc: ReturnType<typeof useQueryClient>,
  chartId: string,
  updater: (old: Note[]) => Note[],
) {
  qc.setQueriesData<Note[]>(notesPredicate(chartId), (old) => (old ? updater(old) : old))
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
    onSuccess: (note: Note) => {
      if (!chartId) return
      patchNotesCache(qc, chartId, (old) =>
        old.find((n) => n.id === note.id) ? old : [...old, note],
      )
      qc.invalidateQueries({ queryKey: ['chart-analysis', chartId] })
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
    onSuccess: (_: void, noteId: string) => {
      if (!chartId) return
      patchNotesCache(qc, chartId, (old) => old.filter((n) => n.id !== noteId))
      qc.invalidateQueries({ queryKey: ['chart-analysis', chartId] })
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
    onSuccess: (note: Note) => {
      if (!chartId) return
      patchNotesCache(qc, chartId, (old) => old.map((n) => (n.id === note.id ? note : n)))
      qc.invalidateQueries({ queryKey: ['chart-analysis', chartId] })
    },
    onError: (err: Error & { status?: number; body?: { message?: string; error?: string } }) => {
      toast.error(mutationErrorMessage(err, 'Failed to update note'))
    },
  })
}

/** @deprecated — kept for any callers; new undo uses useUndoPreview + useApplyUndo */
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
    onError: (err) => toast.error(undoErrorMessage(err)),
  })
}

export function useUndoPreview(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)

  return useMutation({
    mutationFn: () =>
      apiClient(token)<UndoPreview>(`/charts/${chartId}/commands/undo-preview`, {
        method: 'POST',
      }),
  })
}

export function useApplyUndo(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ commandId, resolutions }: { commandId: string; resolutions: UndoResolution[] }) =>
      apiClient(token)<{ id: string; commandType: string }>(`/charts/${chartId}/commands/undo`, {
        method: 'POST',
        body: JSON.stringify({ commandId, resolutions }),
      }),
    onSuccess: () => {
      if (chartId) {
        invalidateNotes(qc, chartId)
        qc.invalidateQueries({ queryKey: ['events', chartId] })
      }
    },
  })
}
