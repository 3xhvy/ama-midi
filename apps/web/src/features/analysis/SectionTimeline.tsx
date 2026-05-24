import type { AnalyzedSegment } from '@ama-midi/shared'
import { SongDifficultyEnum } from '@ama-midi/shared'
import { segmentTierToColor } from '../editor/engine/difficulty-calculator'

interface Props {
  segments: AnalyzedSegment[]
  compact?: boolean
  maxDurationMs?: number
  onSeek?: (timeMs: number) => void
}

export function SectionTimeline({
  segments,
  compact = false,
  maxDurationMs = 300_000,
  onSeek,
}: Props) {
  if (!segments.length) {
    return (
      <div
        className={`rounded-md bg-shell-bg ${compact ? 'h-2' : 'h-6'}`}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={`flex w-full overflow-hidden rounded-md ${compact ? 'h-2 gap-px' : 'h-6 gap-0.5'}`}
      role={onSeek ? 'listbox' : undefined}
      aria-label="Section difficulty timeline"
    >
      {segments.map((seg) => {
        const widthPct = Math.max(
          0.5,
          ((seg.endTimeMs - seg.startTimeMs) / maxDurationMs) * 100,
        )
        const tierLabel = SongDifficultyEnum.label(seg.difficultyLevel)
        return (
          <button
            key={`${seg.startTimeMs}-${seg.endTimeMs}`}
            type="button"
            title={`${(seg.startTimeMs / 1000).toFixed(0)}s – ${(seg.endTimeMs / 1000).toFixed(0)}s · ${tierLabel} (${seg.difficultyScore.toFixed(1)})`}
            onClick={() => onSeek?.(seg.startTimeMs)}
            disabled={!onSeek}
            className={`min-w-0 shrink-0 transition-opacity ${onSeek ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
            style={{
              width: `${widthPct}%`,
              backgroundColor: segmentTierToColor(seg.difficultyLevel),
            }}
          />
        )
      })}
    </div>
  )
}
