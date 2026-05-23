import { Link } from 'react-router-dom'
import { SongDifficultyEnum, type SongChart } from '@ama-midi/shared'
import { Badge } from '../../components/ui'

interface Props {
  charts: SongChart[]
  activeChartId: string
  projectId: string
  songId: string
}

export function SiblingCharts({ charts, activeChartId, projectId, songId }: Props) {
  const siblings = charts.filter((c) => c.id !== activeChartId)
  if (!siblings.length) return null

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-shell-muted">
        Other charts on this song
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {siblings.map((chart) => (
          <Link
            key={chart.id}
            to={`/projects/${projectId}/songs/${songId}/charts/${chart.id}/analysis`}
            className="rounded-lg border border-shell-border bg-shell-surface p-3 hover:border-shell-muted transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-shell-text truncate">{chart.name}</span>
              <Badge size="sm" variant={SongDifficultyEnum.variant(chart.computedDifficulty)}>
                {SongDifficultyEnum.label(chart.computedDifficulty)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-shell-muted">
              Avg {chart.averageDifficultyScore.toFixed(1)} · Peak {chart.peakDifficultyScore.toFixed(1)} · {chart.speedMultiplier.toFixed(1)}×
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
