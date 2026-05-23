import { useMemo, useState } from 'react'
import type { AnalysisWarningDraft, ValidationSeverity } from '@ama-midi/shared'
import { Badge } from '../../components/ui'

type Filter = 'ALL' | ValidationSeverity

interface Props {
  warnings: AnalysisWarningDraft[]
  onJumpTo?: (startTimeMs: number) => void
}

function formatRange(startMs?: number | null, endMs?: number | null): string {
  if (startMs == null) return '—'
  const s = (startMs / 1000).toFixed(1)
  if (endMs == null || endMs === startMs) return `${s}s`
  return `${s}s – ${(endMs / 1000).toFixed(1)}s`
}

const SEVERITY_VARIANT = {
  ERROR: 'error',
  WARN: 'warning',
  INFO: 'info',
} as const

export function WarningsTable({ warnings, onJumpTo }: Props) {
  const [filter, setFilter] = useState<Filter>('ALL')

  const filtered = useMemo(
    () => (filter === 'ALL' ? warnings : warnings.filter((w) => w.severity === filter)),
    [warnings, filter],
  )

  const hasBlocking = warnings.some((w) => w.severity === 'ERROR')

  const tabs: { id: Filter; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'ERROR', label: 'Error' },
    { id: 'WARN', label: 'Warn' },
    { id: 'INFO', label: 'Info' },
  ]

  return (
    <div className="space-y-3">
      {hasBlocking && (
        <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          This chart blocks publish approval.
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-shell-muted">
          Warnings
        </h3>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-2 py-0.5 text-[10px] ${
                filter === tab.id
                  ? 'bg-shell-bg text-shell-text'
                  : 'text-shell-muted hover:text-shell-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-shell-border">
        <table className="w-full text-xs">
          <thead className="bg-shell-bg text-shell-muted uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Message</th>
              <th className="px-3 py-2 text-left">Severity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-shell-muted">
                  No warnings
                </td>
              </tr>
            ) : (
              filtered.map((w, i) => (
                <tr
                  key={`${w.code}-${w.startTimeMs ?? i}`}
                  className="border-t border-shell-border hover:bg-shell-bg/50 cursor-pointer"
                  onClick={() => w.startTimeMs != null && onJumpTo?.(w.startTimeMs)}
                >
                  <td className="px-3 py-2 font-mono text-shell-muted whitespace-nowrap">
                    {formatRange(w.startTimeMs, w.endTimeMs)}
                  </td>
                  <td className="px-3 py-2 text-shell-muted">{w.code}</td>
                  <td className="px-3 py-2 text-shell-text">{w.message}</td>
                  <td className="px-3 py-2">
                    <Badge size="sm" variant={SEVERITY_VARIANT[w.severity]}>
                      {w.severity}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
