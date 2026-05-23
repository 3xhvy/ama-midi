import { SongStatusEnum } from '@ama-midi/shared'
import type { DashboardSongRow } from '@ama-midi/shared'
import { countSongsByStatus } from './dashboard-status-breakdown'

export function DashboardStatusBreakdown({ songs }: { songs: DashboardSongRow[] }) {
  const breakdown = countSongsByStatus(songs)
  const total = breakdown.reduce((sum, entry) => sum + entry.count, 0)

  if (!total) {
    return (
      <div className="rounded-lg border border-dashed border-shell-border bg-shell-surface px-3 py-4 text-sm text-shell-muted">
        No active songs in your queues yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-shell-border bg-shell-surface p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-shell-text">Workflow snapshot</h2>
        <span className="text-xs text-shell-muted">{total} songs across queues</span>
      </div>

      <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-shell-bg">
        {breakdown.map((entry) => (
          <div
            key={entry.status}
            className="h-full transition-[width] duration-300"
            style={{
              width: `${(entry.count / total) * 100}%`,
              backgroundColor: SongStatusEnum.color(entry.status),
            }}
            title={`${SongStatusEnum.label(entry.status)}: ${entry.count}`}
          />
        ))}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {breakdown.map((entry) => (
          <li key={entry.status} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SongStatusEnum.color(entry.status) }}
            />
            <span className="min-w-0 flex-1 truncate text-shell-text">{SongStatusEnum.label(entry.status)}</span>
            <span className="font-medium tabular-nums text-shell-muted">{entry.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
