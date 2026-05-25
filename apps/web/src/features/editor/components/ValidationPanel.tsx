import { trackColor } from '@ama-midi/shared'
import { useValidation } from '../../validation/useValidation'
import type { ValidationIssue, ValidationHoverIssue } from '../../validation/validation-summary'
import { formatTime } from './conflict-formatters'

export type { ValidationHoverIssue } from '../../validation/validation-summary'

interface Props {
  songId: string
  onJumpTo?: (time: number, track?: number) => void
  onHoverIssue?: (issue: ValidationHoverIssue | null) => void
}

function IssueTrackDetail({ track, time }: { track: number; time: number }) {
  const color = trackColor(track)
  return (
    <p className="text-xs text-shell-muted flex items-center gap-1.5 min-w-0 mt-0.5">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="truncate">
        <span className="font-medium" style={{ color }}>Track {track}</span>
        <span className="text-shell-muted"> · {formatTime(time)}</span>
      </span>
    </p>
  )
}

function IssueRow({
  issue,
  onJumpTo,
  onHoverIssue,
}: {
  issue: ValidationIssue
  onJumpTo?: (time: number, track?: number) => void
  onHoverIssue?: (issue: ValidationHoverIssue | null) => void
}) {
  const isError = issue.severity === 'error'
  const canJump = issue.time !== undefined
  const dot = isError ? 'bg-red-400' : 'bg-yellow-400'

  return (
    <div
      className="-mx-1 px-1 py-0.5 rounded-md hover:bg-white/[0.03] transition-colors"
      onMouseEnter={() => {
        if (canJump) {
          onHoverIssue?.({ time: issue.time!, track: issue.track, severity: issue.severity })
        }
      }}
      onMouseLeave={() => onHoverIssue?.(null)}
    >
      <button
        type="button"
        onClick={() => canJump && onJumpTo?.(issue.time!, issue.track)}
        disabled={!canJump}
        className={`w-full text-left pr-1 ${canJump ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${dot}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-shell-text leading-relaxed">{issue.message}</p>
            {issue.track != null && issue.time != null && (
              <IssueTrackDetail track={issue.track} time={issue.time} />
            )}
            {canJump && (
              <p className="text-xs text-shell-muted mt-0.5">
                Jump to {formatTime(issue.time!)} →
              </p>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}

export function ValidationPanel({ songId, onJumpTo, onHoverIssue }: Props) {
  const { issues, summary, isLoading, refetch } = useValidation(songId)

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2.5 animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-shell-border flex-shrink-0 mt-1.5" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-shell-border rounded w-3/4" />
              <div className="h-2 bg-shell-border rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-shell-border">
        <div className="flex items-center gap-3 text-xs">
          {summary.errors > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>{summary.errors} error{summary.errors > 1 ? 's' : ''}</span>
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span>{summary.warnings} warning{summary.warnings > 1 ? 's' : ''}</span>
            </span>
          )}
          {issues.length === 0 && (
            <span className="text-sm text-shell-muted">No issues</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-shell-muted hover:text-shell-text transition-colors"
          title="Refresh validation"
        >
          ↻
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <p className="p-4 text-sm text-green-400 text-center">All clear ✓</p>
        ) : (
          <div className="p-3 space-y-2">
            {issues.map((issue, i) => (
              <IssueRow
                key={`${issue.ruleId}-${i}`}
                issue={issue}
                onJumpTo={onJumpTo}
                onHoverIssue={onHoverIssue}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
