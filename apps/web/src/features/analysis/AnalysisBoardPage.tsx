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

  if (!projectId || !songId || !chartId) return null

  const loading = songLoading || chartLoading || analysisLoading

  function jumpToEditor(timeMs: number) {
    navigate(
      `/projects/${projectId}/songs/${songId}?chart=${chartId}&t=${timeMs / 1000}`,
    )
  }

  return (
    <AppShell variant="management">
      <div className="mb-6 flex flex-col gap-4 border-b border-shell-border pb-4 md:flex-row md:items-end md:justify-between">
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
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => reanalyze.mutate()}
          loading={reanalyze.isPending}
        >
          Re-analyze
        </Button>
      </div>

      {loading || !analysis ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <StatCards analysis={analysis} noteCount={notes.length} />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-shell-border bg-shell-surface p-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-shell-muted">
                Section timeline
              </h3>
              <SectionTimeline
                segments={analysis.segments}
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
    </AppShell>
  )
}
