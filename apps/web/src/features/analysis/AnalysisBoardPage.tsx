import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SongDifficultyEnum } from '@ama-midi/shared'
import type { Song } from '@ama-midi/shared'
import { AppShell } from '../../components/layout'
import { BackNavLink } from '../navigation/BackNavLink'
import { Badge, Button, Skeleton } from '../../components/ui'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import { useChart, useCharts } from '../charts/useCharts'
import { useChartAnalysis, useRunChartAnalysis } from '../charts/useChartAnalysis'
import { useNotes } from '../notes/useNotes'
import { FactorBreakdown } from './FactorBreakdown'
import { SectionTimeline } from './SectionTimeline'
import { SiblingCharts } from './SiblingCharts'
import { StatCards } from './StatCards'
import { WarningsTable } from './WarningsTable'
import { DifficultyHelpModal } from './DifficultyHelpModal'

export function AnalysisBoardPage() {
  const { projectId, songId, chartId } = useParams<{
    projectId: string
    songId: string
    chartId: string
  }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const { data: song, isLoading: songLoading } = useQuery<Song>({
    queryKey: ['song', songId],
    queryFn: () => apiClient(token)<Song>(`/songs/${songId}`),
    enabled: !!token && !!songId,
  })

  const { data: chart, isLoading: chartLoading } = useChart(chartId)
  const { data: charts = [] } = useCharts(songId ?? '')
  const { data: analysis, isLoading: analysisLoading } = useChartAnalysis(chartId)
  const { data: notes = [] } = useNotes(chartId)
  const reanalyze = useRunChartAnalysis(chartId ?? '', songId ?? '')

  const timelineEndMs = useMemo(() => {
    if (!notes.length) return 30_000
    const lastEnd = Math.max(...notes.map((n) => (n.time + (n.duration ?? 0)) * 1000))
    return Math.min(300_000, lastEnd + 5_000)
  }, [notes])

  const visibleSegments = useMemo(
    () => analysis?.segments.filter((s) => s.startTimeMs < timelineEndMs) ?? [],
    [analysis, timelineEndMs],
  )

  if (!projectId || !songId || !chartId) return null

  const [helpOpen, setHelpOpen] = useState(false)

  const loading = songLoading || chartLoading || analysisLoading

  function jumpToEditor(timeMs: number) {
    navigate(
      `/projects/${projectId}/songs/${songId}?chart=${chartId}&t=${timeMs / 1000}`,
    )
  }

  return (
    <AppShell variant="management">
      <div
        data-tour="analysis-board-header"
        className="mb-6 flex flex-col gap-4 border-b border-shell-border pb-4 md:flex-row md:items-end md:justify-between"
      >
        <div className="min-w-0">
          <BackNavLink
            to={`/projects/${projectId}/songs/${songId}?chart=${chartId}`}
            label="Back to editor"
            className="mb-2"
          />
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-shell-text">
              {song?.name ?? '…'} / {chart?.name ?? '…'}
            </h1>
            {chart && (
              <>
                <Badge size="sm" variant={SongDifficultyEnum.variant(chart.computedDifficulty)}>
                  {SongDifficultyEnum.label(chart.computedDifficulty)}
                </Badge>
                <span className="text-sm text-shell-muted">{chart.speedMultiplier.toFixed(1)}×</span>
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="rounded-full px-1.5 py-0.5 text-[11px] text-shell-muted hover:text-primary hover:bg-shell-bg"
                  title="How difficulty works"
                >
                  ?
                </button>
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          data-tour="analysis-reanalyze"
          onClick={() => reanalyze.mutate()}
          loading={reanalyze.isPending}
        >
          Re-analyze
        </Button>
      </div>

      {loading || !analysis ? (
        <div className="space-y-6">
          <div data-tour="analysis-stat-cards">
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div
              data-tour="analysis-section-timeline"
              className="space-y-2 rounded-lg border border-shell-border bg-shell-surface p-4"
            >
              <Skeleton className="h-48 w-full" />
            </div>
            <div
              data-tour="analysis-factor-breakdown"
              className="rounded-lg border border-shell-border bg-shell-surface p-4"
            >
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
          <div data-tour="analysis-warnings" className="rounded-lg border border-shell-border p-4">
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <StatCards analysis={analysis} noteCount={notes.length} />

          <div className="grid gap-6 lg:grid-cols-2">
            <div
              data-tour="analysis-section-timeline"
              className="space-y-2 rounded-lg border border-shell-border bg-shell-surface p-4"
            >
              <h3 className="text-xs font-medium uppercase tracking-wide text-shell-muted">
                Section timeline
              </h3>
              <SectionTimeline
                segments={visibleSegments}
                maxDurationMs={timelineEndMs}
                onSeek={jumpToEditor}
              />
              <p className="text-[10px] text-shell-muted">Click a band to jump to that section in the editor.</p>
            </div>

            <div className="rounded-lg border border-shell-border bg-shell-surface p-4">
              <FactorBreakdown factors={analysis.factors} tier={analysis.computedDifficulty} />
            </div>
          </div>

          <WarningsTable
            warnings={analysis.warnings}
            onJumpTo={jumpToEditor}
          />

          <SiblingCharts
            charts={charts}
            activeChartId={chartId}
            projectId={projectId}
            songId={songId}
          />
        </div>
      )}
      <DifficultyHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </AppShell>
  )
}
