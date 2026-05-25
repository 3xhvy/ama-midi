import { useValidation } from '../../validation/useValidation'

interface Props {
  songId: string
  onJumpTo?: (time: number, track?: number) => void
}

export function ValidationPanel({ songId, onJumpTo }: Props) {
  const { issues, summary, isLoading, refetch } = useValidation(songId)

  if (isLoading) {
    return (
      <div className="p-3 space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-md bg-shell-border" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-shell-border bg-shell-surface">
        <div className="flex items-center gap-3 text-xs">
          {summary.errors > 0 && (
            <span className="flex items-center gap-1 font-medium text-red-400">
              <span>●</span>
              <span>{summary.errors} error{summary.errors > 1 ? 's' : ''}</span>
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="flex items-center gap-1 font-medium text-yellow-400">
              <span>▲</span>
              <span>{summary.warnings} warning{summary.warnings > 1 ? 's' : ''}</span>
            </span>
          )}
          {issues.length === 0 && (
            <span className="text-shell-muted">No issues</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm text-shell-muted hover:text-shell-text transition-colors"
          title="Refresh validation"
        >
          ↻
        </button>
      </div>

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
            <span className="text-2xl text-green-400">✓</span>
            <p className="text-xs font-medium text-green-400">All clear</p>
            <p className="text-[11px] text-shell-muted">No validation issues found</p>
          </div>
        ) : (
          <div className="divide-y divide-shell-border/50">
            {issues.map((issue, i) => {
              const isError = issue.severity === 'error'
              const canJump = issue.time !== undefined
              return (
                <button
                  key={`${issue.ruleId}-${i}`}
                  type="button"
                  onClick={() => canJump && onJumpTo?.(issue.time!, issue.track)}
                  disabled={!canJump}
                  className={[
                    'w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-l-4 transition-colors',
                    isError
                      ? 'border-l-red-400 hover:bg-red-400/5'
                      : 'border-l-yellow-400 hover:bg-yellow-400/5',
                    !canJump ? 'cursor-default' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'mt-0.5 shrink-0 text-[11px] leading-none',
                      isError ? 'text-red-400' : 'text-yellow-400',
                    ].join(' ')}
                  >
                    {isError ? '●' : '▲'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-shell-text leading-snug">{issue.message}</p>
                    {canJump && (
                      <p className="mt-0.5 text-[10px] text-shell-muted">
                        Jump to {issue.time!.toFixed(1)}s →
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
