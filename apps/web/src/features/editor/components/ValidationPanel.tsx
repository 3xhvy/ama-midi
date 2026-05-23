import { useValidation } from '../../validation/useValidation'

interface Props {
  songId: string
  onJumpTo?: (time: number, track?: number) => void
}

export function ValidationPanel({ songId, onJumpTo }: Props) {
  const { issues, summary, isLoading, refetch } = useValidation(songId)

  if (isLoading) {
    return (
      <div className="p-4 space-y-2 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-shell-border rounded" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-shell-border">
        <div className="flex gap-3 text-xs">
          {summary.errors > 0 && (
            <span className="text-red-400">{summary.errors} error{summary.errors > 1 ? 's' : ''}</span>
          )}
          {summary.warnings > 0 && (
            <span className="text-yellow-400">{summary.warnings} warning{summary.warnings > 1 ? 's' : ''}</span>
          )}
          {issues.length === 0 && <span className="text-green-400">All clear ✓</span>}
        </div>
        <button onClick={() => refetch()} className="text-xs text-shell-muted hover:text-shell-text">↻</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <p className="p-4 text-xs text-shell-muted text-center">No validation issues found</p>
        ) : (
          <div className="p-2 space-y-1">
            {issues.map((issue, i) => (
              <button
                key={i}
                onClick={() => issue.time !== undefined && onJumpTo?.(issue.time, issue.track)}
                className="w-full text-left p-2 rounded text-xs hover:bg-shell-border transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 flex-shrink-0 ${issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {issue.severity === 'error' ? '●' : '▲'}
                  </span>
                  <span className="text-shell-text leading-relaxed">{issue.message}</span>
                </div>
                {issue.time !== undefined && (
                  <span className="ml-5 text-shell-muted">Jump to {issue.time}s →</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
