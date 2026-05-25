import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { analyzeChart, SongDifficultyEnum } from '@ama-midi/shared'
import type { Note } from '@ama-midi/shared'
import { Badge } from '../../../components/ui'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { SectionTimeline } from '../../analysis/SectionTimeline'
import {
  analysisReviewStatus,
  formatChartSpeedLabel,
  mainReviewReason,
} from './analysis-summary-copy'
interface Props {
  notes: Note[]
  bpm: number
  timeSignature: string
  speedMultiplier: number
  chartId: string
  projectId: string
  songId: string
  onSeek?: (timeMs: number) => void
  embedded?: boolean
}

export function AnalysisSummaryPanel({
  notes,
  bpm,
  timeSignature,
  speedMultiplier,
  chartId,
  projectId,
  songId,
  onSeek,
  embedded = false,
}: Props) {
  const debouncedNotes = useDebouncedValue(notes, 300)

  const analysis = useMemo(
    () =>
      analyzeChart({
        notes: debouncedNotes,
        bpm,
        timeSignature,
        speedMultiplier,
      }),
    [debouncedNotes, bpm, timeSignature, speedMultiplier],
  )

  const tier = analysis.computedDifficulty
  const reviewStatus = analysisReviewStatus(analysis.warnings)
  const reviewReason = mainReviewReason(analysis.warnings, tier)

  return (
    <div
      data-tour="analysis-summary"
      className={embedded
      ? 'px-3 py-2 space-y-2.5'
      : 'space-y-2.5 rounded-lg border border-shell-border bg-shell-bg/50 p-3'
    }>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-shell-muted">Difficulty</span>
          <span className="shrink-0 text-[11px] text-shell-muted">
            {formatChartSpeedLabel(speedMultiplier)}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Badge size="sm" variant={SongDifficultyEnum.variant(tier)}>
            {SongDifficultyEnum.label(tier)}
          </Badge>
          <span className={reviewStatus === 'Blocked' ? 'truncate text-xs text-error' : reviewStatus === 'Needs review' ? 'truncate text-xs text-warning' : 'truncate text-xs text-success'}>
            {reviewStatus}
          </span>
        </div>
      </div>

      <SectionTimeline
        segments={analysis.segments}
        compact
        onSeek={onSeek}
      />

      {reviewReason && (
        <div className="rounded-md border border-shell-border bg-shell-surface/70 px-2.5 py-2">
          <p className="text-[10px] text-shell-muted">Why it needs review</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-snug text-shell-text">{reviewReason.title}</p>
          <p className="mt-0.5 text-[10px] leading-snug text-shell-muted">{reviewReason.detail}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-md bg-shell-surface/70 px-2 py-1.5">
          <p className="text-[10px] text-shell-muted">Average load</p>
          <p className="mt-0.5 font-mono text-xs text-shell-text">
            {analysis.averageDifficultyScore.toFixed(1)}
          </p>
        </div>
        <div className="rounded-md bg-shell-surface/70 px-2 py-1.5">
          <p className="text-[10px] text-shell-muted">Hardest moment</p>
          <p className="mt-0.5 font-mono text-xs text-shell-text">
            {analysis.peakDifficultyScore.toFixed(1)}
          </p>
        </div>
      </div>

      <Link
        data-tour="open-analysis-board"
        to={`/projects/${projectId}/songs/${songId}/charts/${chartId}/analysis`}
        className="inline-block text-[11px] text-primary hover:underline"
      >
        Open Analysis Board →
      </Link>
    </div>
  )
}
