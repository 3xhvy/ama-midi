import type { ChartAnalysisResult } from '@ama-midi/shared'

interface Props {
  analysis: ChartAnalysisResult
  noteCount: number
}

export function StatCards({ analysis, noteCount }: Props) {
  const warnCount = analysis.warnings.filter((w) => w.severity === 'WARN').length
  const errCount = analysis.warnings.filter((w) => w.severity === 'ERROR').length
  const infoCount = analysis.warnings.filter((w) => w.severity === 'INFO').length

  const cards = [
    { label: 'Avg score', value: analysis.averageDifficultyScore.toFixed(1) },
    { label: 'Peak score', value: analysis.peakDifficultyScore.toFixed(1) },
    { label: 'Notes', value: String(noteCount) },
    {
      label: 'Warnings',
      value: [
        errCount ? `${errCount} err` : null,
        warnCount ? `${warnCount} warn` : null,
        infoCount ? `${infoCount} info` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'None',
    },
    { label: 'Segments', value: String(analysis.segments.length) },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-shell-border bg-shell-surface px-3 py-2.5"
        >
          <p className="text-[10px] uppercase tracking-wide text-shell-muted">{card.label}</p>
          <p className="mt-0.5 text-lg font-semibold text-shell-text">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
