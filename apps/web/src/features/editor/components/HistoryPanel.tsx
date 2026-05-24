import { useInfiniteQuery } from '@tanstack/react-query'
import { Avatar } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { apiClient } from '../../auth/api'
import type { EditorCommandRow } from '@ama-midi/shared'

interface Props {
  chartId?: string
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

type CmdMeta = { dot: string; verb: string; detail: string }

function getCmdMeta(cmd: EditorCommandRow): CmdMeta {
  const s = cmd.summary as Record<string, unknown>
  switch (cmd.commandType) {
    case 'SINGLE_NOTE_CREATED': return { dot: 'bg-green-400', verb: 'Added note', detail: `Track ${s.track} · ${s.time}s` }
    case 'SINGLE_NOTE_UPDATED': return { dot: 'bg-blue-400', verb: 'Edited note', detail: `Track ${s.track} · ${s.time}s` }
    case 'SINGLE_NOTE_DELETED': return { dot: 'bg-red-400', verb: 'Removed note', detail: `Track ${s.track} · ${s.time}s` }
    case 'PATTERN_PASTED':      return { dot: 'bg-purple-400', verb: 'Pasted pattern', detail: `${s.noteCount ?? '?'} notes` }
    case 'NOTES_REPEATED':      return { dot: 'bg-purple-400', verb: 'Repeated notes', detail: `${s.noteCount ?? '?'} notes` }
    case 'NOTES_MOVED':         return { dot: 'bg-yellow-400', verb: 'Moved notes', detail: `${s.noteCount ?? '?'} notes` }
    case 'SECTION_CREATED':     return { dot: 'bg-green-400', verb: 'Added section', detail: `"${s.label ?? ''}"` }
    case 'SECTION_UPDATED':     return { dot: 'bg-blue-400', verb: 'Updated section', detail: `"${s.label ?? ''}"` }
    case 'SECTION_DELETED':     return { dot: 'bg-red-400', verb: 'Removed section', detail: `"${s.label ?? ''}"` }
    case 'AI_NOTES_APPLIED':    return { dot: 'bg-indigo-400', verb: 'Applied AI notes', detail: '' }
    case 'CHART_SWITCHED':      return { dot: 'bg-gray-400', verb: 'Switched chart', detail: `"${s.chartName ?? ''}"` }
    case 'UNDO':                return { dot: 'bg-orange-400', verb: 'Undid action', detail: `${s.targetCommandType ?? ''}` }
    default:                    return { dot: 'bg-gray-400', verb: cmd.commandType, detail: '' }
  }
}

export function HistoryPanel({ chartId, onClose, inline = false }: Props) {
  const token = useAuthStore(s => s.token)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['events', chartId],
    queryFn: async ({ pageParam }) => {
      const url = `/charts/${chartId}/events${pageParam ? `?cursor=${pageParam}` : ''}`
      return apiClient(token)<{ events: EditorCommandRow[]; nextCursor: string | null }>(url)
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!token && !!chartId,
  })

  const commands = data?.pages.flatMap(p => p.events) ?? []

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
        {!inline && onClose && (
          <button onClick={onClose} className="text-shell-muted hover:text-shell-text text-lg leading-none">×</button>
        )}
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

        {commands.length === 0 && !isLoading && (
          <p className="p-4 text-sm text-shell-muted text-center">No history yet</p>
        )}

        <div className="p-3 space-y-2">
          {commands.map(cmd => {
            const { dot, verb, detail } = getCmdMeta(cmd)
            return (
              <div key={cmd.id} className="flex gap-3 items-start">
                <Avatar src={cmd.user?.avatarUrl ?? undefined} name={cmd.user?.name ?? 'Unknown'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-shell-text leading-relaxed">
                    <span className="font-semibold">{cmd.user?.name ?? 'Someone'}</span>
                    {' · '}
                    <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle mr-0.5 ${dot}`} />
                    {verb}
                    {detail && <span className="text-shell-muted"> · {detail}</span>}
                    {cmd.isCompensation && <span className="ml-1 text-orange-400 text-[10px]">(undo)</span>}
                  </p>
                  <p className="text-xs text-shell-muted mt-0.5">{timeAgo(cmd.createdAt)}</p>
                </div>
              </div>
            )
          })}
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
