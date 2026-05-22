import { useInfiniteQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '../../../store/auth.store'
import { apiClient } from '../../auth/api'
import { useUndo } from '../../notes/useNotes'

interface NoteEventRow {
  id: string
  eventType: 'NOTE_CREATED' | 'NOTE_UPDATED' | 'NOTE_DELETED'
  userId: string
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string }
}

interface Props {
  songId: string
  onClose?: () => void
  inline?: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function eventLabel(event: NoteEventRow): string {
  const state = event.eventType === 'NOTE_CREATED' ? event.afterState : event.beforeState
  const track = state?.track ?? '?'
  const time = state?.time ?? '?'
  const name = event.user?.name ?? 'Someone'
  if (event.eventType === 'NOTE_CREATED') return `${name} added a note at Track ${track}, ${time}s`
  if (event.eventType === 'NOTE_UPDATED') return `${name} edited the note at Track ${track}, ${time}s`
  return `${name} removed the note at Track ${track}, ${time}s`
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function HistoryPanel({ songId, onClose, inline = false }: Props) {
  const token = useAuthStore(s => s.token)
  const undo = useUndo(songId)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['events', songId],
    queryFn: async ({ pageParam }) => {
      const url = `/songs/${songId}/events${pageParam ? `?cursor=${pageParam}` : ''}`
      return apiClient(token)<{ events: NoteEventRow[]; nextCursor: string | null }>(url)
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  })

  const events = data?.pages.flatMap(p => p.events) ?? []

  function handleUndo() {
    undo.mutateAsync()
      .then(() => toast.success('Undo successful'))
      .catch(() => {/* useUndo already shows the error toast */})
  }

  return (
    <div
      className={
        inline
          ? 'flex flex-col flex-1 min-h-0'
          : 'panel-right fixed top-0 right-0 h-full w-80 bg-shell-surface border-l border-shell-border flex flex-col z-40 shadow-lg'
      }
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-shell-border">
        <span className="text-sm font-medium text-shell-text">History</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={undo.isPending}
            className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            Undo
          </button>
          {!inline && onClose && (
            <button onClick={onClose} className="text-shell-muted hover:text-shell-text text-lg leading-none">
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-shell-border flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-shell-border rounded w-3/4" />
                  <div className="h-2 bg-shell-border rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {events.length === 0 && !isLoading && (
          <p className="p-4 text-sm text-shell-muted text-center">No history yet</p>
        )}

        <div className="p-3 space-y-2">
          {events.map(event => (
            <div key={event.id} className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs text-white flex-shrink-0 font-medium">
                {event.user ? getInitials(event.user.name) : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-shell-text leading-relaxed">{eventLabel(event)}</p>
                <p className="text-xs text-shell-muted mt-0.5">{timeAgo(event.createdAt)}</p>
              </div>
              <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                event.eventType === 'NOTE_CREATED' ? 'bg-green-400' :
                event.eventType === 'NOTE_DELETED' ? 'bg-red-400' : 'bg-blue-400'
              }`} />
            </div>
          ))}
        </div>

        {hasNextPage && (
          <div className="p-3 border-t border-shell-border">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full text-xs text-shell-muted hover:text-shell-text py-1"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
