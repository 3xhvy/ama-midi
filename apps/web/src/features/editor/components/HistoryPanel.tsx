import { useCallback, useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { Avatar } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { apiClient } from '../../auth/api'
import type { CommandType, EditorCommandRow, EditorEventRow } from '@ama-midi/shared'
import { trackColor } from '@ama-midi/shared'
import { formatTime } from './conflict-formatters'

interface Props {
  chartId?: string
  onClose?: () => void
  inline?: boolean
}

const BATCH_COMMAND_TYPES = new Set<CommandType>([
  'PATTERN_PASTED',
  'NOTES_REPEATED',
  'NOTES_MOVED',
  'AI_NOTES_APPLIED',
])

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type CmdMeta = {
  dot: string
  verb: string
  detail: string
  noteState?: Record<string, unknown>
  batchDetail?: string
}

function formatNoteTime(s: Record<string, unknown>): string {
  const time = Number(s.time)
  if (Number.isNaN(time)) return ''

  const noteType = s.noteType as string | undefined
  const duration = s.duration as number | undefined

  if (noteType === 'HOLD' && duration != null && duration > 0) {
    const end = Math.round((time + duration) * 10) / 10
    return `${formatTime(time)} → ${formatTime(end)}`
  }

  return formatTime(time)
}

function NoteTrackDetail({ state, className = '' }: { state: Record<string, unknown>; className?: string }) {
  const track = state.track
  const timeLabel = formatNoteTime(state)
  if (track == null || !timeLabel) return null

  const color = trackColor(Number(track))

  return (
    <p className={`text-xs text-shell-muted flex items-center gap-1.5 min-w-0 ${className}`}>
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">
        <span className="font-medium" style={{ color }}>Track {Number(track)}</span>
        <span className="text-shell-muted"> · {timeLabel}</span>
      </span>
    </p>
  )
}

function formatNoteDetail(s: Record<string, unknown>): string {
  const track = s.track
  if (track == null) return ''
  const timeLabel = formatNoteTime(s)
  return timeLabel ? `Track ${track} · ${timeLabel}` : ''
}

function singleNoteVerb(action: 'added' | 'edited' | 'removed', s: Record<string, unknown>): string {
  const kind = s.noteType === 'HOLD' ? 'hold note' : 'note'
  if (action === 'added') return `Added ${kind}`
  if (action === 'edited') return `Edited ${kind}`
  return `Removed ${kind}`
}

function batchSummaryDetail(cmd: Pick<EditorCommandRow, 'summary'>): string {
  const s = cmd.summary as Record<string, unknown>
  const created = Number(s.createdCount ?? s.noteCount ?? 0)
  const removed = Number(s.removedCount ?? 0)
  const label = s.patternName ? String(s.patternName) : null
  const counts = [
    created > 0 ? `${created} created` : null,
    removed > 0 ? `${removed} removed` : null,
  ].filter(Boolean).join(' · ')

  if (label && counts) return `${label} · ${counts}`
  if (label) return label
  return counts
}

function getCmdMeta(cmd: Pick<EditorCommandRow, 'commandType' | 'summary'>): CmdMeta {
  const s = cmd.summary as Record<string, unknown>
  const noteState = s.track != null ? s : undefined
  switch (cmd.commandType) {
    case 'SINGLE_NOTE_CREATED': return { dot: 'bg-green-400', verb: singleNoteVerb('added', s), detail: formatNoteDetail(s), noteState }
    case 'SINGLE_NOTE_UPDATED': return { dot: 'bg-blue-400', verb: singleNoteVerb('edited', s), detail: formatNoteDetail(s), noteState }
    case 'SINGLE_NOTE_DELETED': return { dot: 'bg-red-400', verb: singleNoteVerb('removed', s), detail: formatNoteDetail(s), noteState }
    case 'PATTERN_PASTED':      return { dot: 'bg-purple-400', verb: 'Pasted pattern', detail: '', batchDetail: batchSummaryDetail(cmd) }
    case 'NOTES_REPEATED':      return { dot: 'bg-purple-400', verb: 'Repeated notes', detail: '', batchDetail: batchSummaryDetail(cmd) }
    case 'NOTES_MOVED':         return { dot: 'bg-yellow-400', verb: 'Moved notes', detail: '', batchDetail: batchSummaryDetail(cmd) }
    case 'SECTION_CREATED':     return { dot: 'bg-green-400', verb: 'Added section', detail: `"${s.label ?? ''}"` }
    case 'SECTION_UPDATED':     return { dot: 'bg-blue-400', verb: 'Updated section', detail: `"${s.label ?? ''}"` }
    case 'SECTION_DELETED':     return { dot: 'bg-red-400', verb: 'Removed section', detail: `"${s.label ?? ''}"` }
    case 'AI_NOTES_APPLIED':    return { dot: 'bg-indigo-400', verb: 'Applied AI notes', detail: '', batchDetail: batchSummaryDetail(cmd) }
    case 'CHART_SWITCHED':      return { dot: 'bg-gray-400', verb: 'Switched chart', detail: `"${s.chartName ?? ''}"` }
    case 'UNDO':                return { dot: 'bg-orange-400', verb: 'Undid', detail: '' }
    default:                    return { dot: 'bg-gray-400', verb: cmd.commandType, detail: '' }
  }
}

function resolveUndoTarget(
  summary: Record<string, unknown>,
  allCommands: EditorCommandRow[],
): { commandId?: string; meta: CmdMeta } {
  const targetCommandId = summary.targetCommandId as string | undefined
  const targetCommandType = summary.targetCommandType as CommandType | undefined
  const targetSummary = summary.targetSummary as Record<string, unknown> | undefined

  if (targetCommandId) {
    const target = allCommands.find(c => c.id === targetCommandId)
    if (target) {
      return { commandId: targetCommandId, meta: getCmdMeta(target) }
    }
  }

  if (targetCommandType) {
    return {
      commandId: targetCommandId,
      meta: getCmdMeta({
        commandType: targetCommandType,
        summary: targetSummary ?? {},
      }),
    }
  }

  return { commandId: targetCommandId, meta: { dot: 'bg-gray-400', verb: 'a previous action', detail: '' } }
}

function mutationLine(event: EditorEventRow): { dot: string; verb: string; noteState?: Record<string, unknown> } {
  const state = event.eventType === 'NOTE_CREATED' || event.eventType === 'NOTE_UPDATED'
    ? event.afterState
    : event.beforeState

  if (event.entityType !== 'NOTE' || !state) {
    return { dot: 'bg-gray-400', verb: event.eventType }
  }

  const s = state as Record<string, unknown>

  if (event.eventType === 'NOTE_CREATED') {
    return { dot: 'bg-green-400', verb: singleNoteVerb('added', s), noteState: s }
  }
  if (event.eventType === 'NOTE_DELETED') {
    return { dot: 'bg-red-400', verb: singleNoteVerb('removed', s), noteState: s }
  }
  return { dot: 'bg-blue-400', verb: singleNoteVerb('edited', s), noteState: s }
}

function ExpandChevron() {
  return (
    <span className="flex-shrink-0 mt-0.5 rounded p-0.5 text-shell-text bg-shell-border/40">
      <ChevronRightIcon className="w-4 h-4 group-open:hidden" aria-hidden />
      <ChevronDownIcon className="w-4 h-4 hidden group-open:block" aria-hidden />
    </span>
  )
}

function UndoTargetLink({
  target,
  onNavigate,
}: {
  target: { commandId?: string; meta: CmdMeta }
  onNavigate: (commandId: string) => void
}) {
  const { meta, commandId } = target

  if (!commandId) {
    return (
      <span className="text-shell-muted">
        <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle mr-0.5 ${meta.dot}`} />
        {meta.verb}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(commandId)}
      className="inline text-left text-orange-300 hover:text-orange-200 underline decoration-orange-400/50 underline-offset-2 transition-colors"
      title="Jump to original action"
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle mr-0.5 ${meta.dot}`} />
      {meta.verb}
    </button>
  )
}

function CommandMutationsList({ chartId, commandId }: { chartId: string; commandId: string }) {
  const token = useAuthStore(s => s.token)
  const { data, isLoading } = useQuery({
    queryKey: ['command-mutations', chartId, commandId],
    queryFn: () =>
      apiClient(token)<{ mutations: EditorEventRow[] }>(`/charts/${chartId}/commands/${commandId}/mutations`),
    enabled: !!token && !!chartId && !!commandId,
  })

  const mutations = data?.mutations.filter(m => m.entityType === 'NOTE') ?? []
  const created = mutations.filter(m => m.eventType === 'NOTE_CREATED').length
  const removed = mutations.filter(m => m.eventType === 'NOTE_DELETED').length

  if (isLoading) {
    return <p className="text-xs text-shell-muted mt-1.5">Loading…</p>
  }

  if (mutations.length === 0) {
    return <p className="text-xs text-shell-muted mt-1.5">No note changes recorded</p>
  }

  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-shell-muted mt-1.5 mb-1">
        {created} created · {removed} removed
      </p>
      <div className="space-y-1.5 border-l-2 border-shell-border/80 pl-2.5 ml-0.5">
        {mutations.map(m => {
          const { dot, verb, noteState } = mutationLine(m)
          return (
            <div key={m.id} className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                <span className="text-xs text-shell-text">{verb}</span>
              </div>
              {noteState && <NoteTrackDetail state={noteState} className="mt-0.5 ml-3" />}
            </div>
          )
        })}
      </div>
    </>
  )
}

function HistoryCommandRow({
  cmd,
  chartId,
  allCommands,
  highlightedId,
  onNavigateToCommand,
}: {
  cmd: EditorCommandRow
  chartId?: string
  allCommands: EditorCommandRow[]
  highlightedId: string | null
  onNavigateToCommand: (commandId: string) => void
}) {
  const meta = getCmdMeta(cmd)
  const isBatch = BATCH_COMMAND_TYPES.has(cmd.commandType)
  const isUndo = cmd.commandType === 'UNDO'
  const undoTarget = isUndo ? resolveUndoTarget(cmd.summary as Record<string, unknown>, allCommands) : null
  const isHighlighted = highlightedId === cmd.id
  const rowClass = `-mx-1 px-1 py-0.5 ${isHighlighted ? 'history-row-highlight' : ''}`

  const body = (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-shell-text leading-relaxed">
        <span className="font-semibold">{cmd.user?.name ?? 'Someone'}</span>
        {' · '}
        {isUndo && undoTarget ? (
          <>
            <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle mr-0.5 ${meta.dot}`} />
            Undid{' '}
            <UndoTargetLink target={undoTarget} onNavigate={onNavigateToCommand} />
          </>
        ) : (
          <>
            <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle mr-0.5 ${meta.dot}`} />
            {meta.verb}
            {cmd.isCompensation && !isUndo && (
              <span className="ml-1 text-orange-400 text-[10px]">(undo)</span>
            )}
          </>
        )}
      </p>
      {meta.batchDetail && (
        <p className="text-xs text-shell-muted mt-0.5">{meta.batchDetail}</p>
      )}
      {!isBatch && !isUndo && meta.noteState && (
        <NoteTrackDetail state={meta.noteState} className="mt-0.5" />
      )}
      {isUndo && undoTarget?.meta.batchDetail && (
        <p className="text-xs text-shell-muted mt-0.5">{undoTarget.meta.batchDetail}</p>
      )}
      {isUndo && undoTarget?.meta.noteState && (
        <NoteTrackDetail state={undoTarget.meta.noteState} className="mt-0.5" />
      )}
      {!isUndo && meta.detail && (
        <p className="text-xs text-shell-muted mt-0.5">{meta.detail}</p>
      )}
      {isUndo && undoTarget?.meta.detail && (
        <p className="text-xs text-shell-muted mt-0.5">{undoTarget.meta.detail}</p>
      )}
      <p className="text-xs text-shell-muted mt-0.5">{timeAgo(cmd.createdAt)}</p>
    </div>
  )

  if (isBatch && chartId) {
    return (
      <details
        key={cmd.id}
        data-command-id={cmd.id}
        className={`group ${rowClass}`}
        open={highlightedId === cmd.id ? true : undefined}
      >
        <summary className="flex gap-2.5 items-start cursor-pointer list-none select-none pr-1">
          <Avatar src={cmd.user?.avatarUrl ?? undefined} name={cmd.user?.name ?? 'Unknown'} size="sm" />
          {body}
          <ExpandChevron />
        </summary>
        <div className="ml-7 mt-1 pr-1">
          <CommandMutationsList chartId={chartId} commandId={cmd.id} />
        </div>
      </details>
    )
  }

  return (
    <div key={cmd.id} data-command-id={cmd.id} className={`flex gap-3 items-start pr-1 ${rowClass}`}>
      <Avatar src={cmd.user?.avatarUrl ?? undefined} name={cmd.user?.name ?? 'Unknown'} size="sm" />
      {body}
    </div>
  )
}

export function HistoryPanel({ chartId, onClose, inline = false }: Props) {
  const token = useAuthStore(s => s.token)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const navigateToCommand = useCallback((commandId: string) => {
    const root = scrollRef.current
    const row = root?.querySelector(`[data-command-id="${commandId}"]`)
    if (!row) return

    if (row instanceof HTMLDetailsElement) {
      row.open = true
    } else {
      const details = row.closest('details')
      if (details) details.open = true
    }

    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightedId(commandId)

    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 2400)
  }, [])

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
  }, [])

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

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
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
          {commands.map(cmd => (
            <HistoryCommandRow
              key={cmd.id}
              cmd={cmd}
              chartId={chartId}
              allCommands={commands}
              highlightedId={highlightedId}
              onNavigateToCommand={navigateToCommand}
            />
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
