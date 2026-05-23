import type { SongChart, SongDifficulty } from '@ama-midi/shared'

const TIER_RANK: Record<SongDifficulty, number> = {
  EASY: 0,
  NORMAL: 1,
  HARD: 2,
  EXPERT: 3,
  MASTER: 4,
}

export function peakTier(
  charts: Pick<SongChart, 'computedDifficulty'>[],
): SongDifficulty {
  if (!charts.length) return 'EASY'
  return charts.reduce(
    (best, c) =>
      TIER_RANK[c.computedDifficulty] > TIER_RANK[best]
        ? c.computedDifficulty
        : best,
    charts[0].computedDifficulty,
  )
}

export function formatChartSummary(charts: SongChart[]): string | undefined {
  if (!charts.length) return undefined
  if (charts.length === 1) {
    const c = charts[0]
    return `${c.name} · ${c.computedDifficulty}`
  }
  return `${charts.length} charts · peak ${peakTier(charts)}`
}
