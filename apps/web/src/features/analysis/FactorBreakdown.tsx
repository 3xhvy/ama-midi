import { SongDifficultyEnum, TIER_LIMITS, type ChartFactorBreakdown, type SongDifficulty } from '@ama-midi/shared'

const FACTORS: {
  key: keyof ChartFactorBreakdown
  label: string
  hint: string
  limitKey?: keyof typeof TIER_LIMITS.EASY
}[] = [
  {
    key: 'densityScore',
    label: 'Density',
    hint: 'How many notes appear over time. To lower: space notes further apart or reduce bursts.',
    limitKey: 'maxNpsWarn',
  },
  {
    key: 'speedScore',
    label: 'Speed',
    hint: 'Scroll speed multiplier for this chart. Adjust in chart settings.',
  },
  {
    key: 'laneJumpScore',
    label: 'Lane jumps',
    hint: 'How far notes jump between lanes. To lower: keep adjacent notes on nearby lanes.',
  },
  {
    key: 'syncopationScore',
    label: 'Syncopation',
    hint: 'Notes placed off the main beat grid. To lower: snap more notes to beats.',
    limitKey: 'maxOffbeatRatio',
  },
  {
    key: 'holdNoteScore',
    label: 'Hold notes',
    hint: 'Long holds and overlapping taps during holds. To lower: shorten holds or reduce overlap.',
  },
  {
    key: 'simultaneousNoteScore',
    label: 'Simultaneous',
    hint: 'Double and triple taps at the same time. To lower: stagger notes slightly.',
  },
  {
    key: 'patternComplexityScore',
    label: 'Pattern complexity',
    hint: 'How unpredictably lanes change. To lower: repeat familiar lane patterns in sections.',
  },
  {
    key: 'repetitionScore',
    label: 'Repetition',
    hint: 'How much the chart repeats the same patterns. Higher = more repetitive (easier to memorize).',
  },
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
    <div data-tour="analysis-factor-breakdown" className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-shell-muted">
        Factor breakdown
      </h3>
      <div className="space-y-2.5">
        {FACTORS.map(({ key, label, hint }) => {
          const value = factors[key]
          const pct = Math.min(100, value * 100)
          const limit = barLimit(key, tier)
          const limitPct = limit !== undefined ? Math.min(100, limit * 100) : undefined
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-shell-muted cursor-help" title={hint}>
                  {label}
                </span>
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
        Tier: {SongDifficultyEnum.label(tier)} · hover a factor for guidance · amber marker = tier threshold
      </p>
    </div>
  )
}
