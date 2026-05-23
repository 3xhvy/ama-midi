import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { analyzeChart, SongDifficultyEnum } from '@ama-midi/shared'
import type { Note } from '@ama-midi/shared'
import { Badge } from '../../../components/ui'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { SectionTimeline } from '../../analysis/SectionTimeline'

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

  const warnCount = analysis.warnings.filter((w) => w.severity === 'WARN').length
  const errCount = analysis.warnings.filter((w) => w.severity === 'ERROR').length
  const infoCount = analysis.warnings.filter((w) => w.severity === 'INFO').length
  const topWarnings = analysis.warnings.slice(0, 3)

  const tier = analysis.computedDifficulty

  return (
    <div className={embedded
      ? 'px-3 py-2 space-y-3'
      : 'space-y-3 rounded-lg border border-shell-border bg-shell-bg/50 p-3'
    }>
      <div className="flex flex-wrap items-center gap-2">
        <Badge size="sm" variant={SongDifficultyEnum.variant(tier)}>
          {SongDifficultyEnum.label(tier)}
        </Badge>
        <span className="text-xs text-shell-muted">
          Avg <span className="font-mono text-shell-text">{analysis.averageDifficultyScore.toFixed(1)}</span>
        </span>
        <span className="text-xs text-shell-muted">
          Peak <span className="font-mono text-shell-text">{analysis.peakDifficultyScore.toFixed(1)}</span>
        </span>
        <span className="text-xs text-shell-muted">
          {speedMultiplier.toFixed(1)}×
        </span>
      </div>

      <SectionTimeline
        segments={analysis.segments}
        compact
        onSeek={onSeek}
      />

      {(warnCount > 0 || errCount > 0 || infoCount > 0) && (
        <div className="space-y-1">
          <p className="text-[10px] text-shell-muted">
            {errCount > 0 && <span className="text-error">{errCount} error{errCount !== 1 ? 's' : ''} </span>}
            {warnCount > 0 && <span className="text-warning">{warnCount} warn{warnCount !== 1 ? 's' : ''} </span>}
            {infoCount > 0 && <span>{infoCount} info</span>}
          </p>
          {topWarnings.map((w, i) => (
            <p key={i} className="text-[10px] leading-snug text-shell-muted truncate" title={w.message}>
              {w.severity === 'ERROR' ? '⛔' : w.severity === 'WARN' ? '⚠' : 'ℹ'} {w.message}
            </p>
          ))}
        </div>
      )}

      <Link
        to={`/projects/${projectId}/songs/${songId}/charts/${chartId}/analysis`}
        className="block text-center text-xs text-primary hover:underline"
      >
        Open Analysis Board →
      </Link>
    </div>
  )
}
