import { SongDifficultyEnum, TIER_LIMITS, type ChartFactorBreakdown, type SongDifficulty } from '@ama-midi/shared'

const FACTORS: { key: keyof ChartFactorBreakdown; label: string; limitKey?: keyof typeof TIER_LIMITS.EASY }[] = [
  { key: 'densityScore', label: 'Density', limitKey: 'maxNpsWarn' },
  { key: 'speedScore', label: 'Speed' },
  { key: 'laneJumpScore', label: 'Lane jumps' },
  { key: 'syncopationScore', label: 'Syncopation', limitKey: 'maxOffbeatRatio' },
  { key: 'holdNoteScore', label: 'Hold notes' },
  { key: 'simultaneousNoteScore', label: 'Simultaneous' },
  { key: 'patternComplexityScore', label: 'Pattern complexity' },
  { key: 'repetitionScore', label: 'Repetition' },
]

interface Props {
  factors: ChartFactorBreakdown
  tier: SongDifficulty
}

function barLimit(key: keyof ChartFactorBreakdown, tier: SongDifficulty): number | undefined {
  if (key === 'densityScore') return TIER_LIMITS[tier].maxNpsWarn / 12
  if (key === 'syncopationScore') return TIER_LIMITS[tier].maxOffbeatRatio
  return undefined
}

export function FactorBreakdown({ factors, tier }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-shell-muted">
        Factor breakdown
      </h3>
      <div className="space-y-2.5">
        {FACTORS.map(({ key, label }) => {
          const value = factors[key]
          const pct = Math.min(100, value * 100)
          const limit = barLimit(key, tier)
          const limitPct = limit !== undefined ? Math.min(100, limit * 100) : undefined
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-shell-muted">{label}</span>
                <span className="font-mono text-shell-text">{value.toFixed(2)}</span>
              </div>
              <div className="relative h-2 rounded-full bg-shell-border">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
                  style={{ width: `${pct}%` }}
                />
                {limitPct !== undefined && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-warning/80"
                    style={{ left: `${limitPct}%` }}
                    title="Tier limit"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-shell-muted">
        Tier: {SongDifficultyEnum.label(tier)} · amber marker = tier threshold
      </p>
    </div>
  )
}
