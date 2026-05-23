import { useState } from 'react'
import { SongDifficultyEnum, type SongChart } from '@ama-midi/shared'
import { Badge } from '../../components/ui'
import { useEditorStore } from '../../store/editor.store'
import { useCreateChart } from './useCharts'
import { useDuplicateChart } from './useDuplicateChart'
import { ChartSettingsModal } from './ChartSettingsModal'

interface Props {
  songId: string
  charts: SongChart[]
  activeChartId: string | null
}

export function ChartSwitcher({ songId, charts, activeChartId }: Props) {
  const setActiveChartId = useEditorStore((s) => s.setActiveChartId)
  const createChart = useCreateChart(songId)
  const activeChart = charts.find((c) => c.id === activeChartId) ?? charts[0]
  const duplicateChart = useDuplicateChart(activeChart?.id ?? '', songId)

  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (!activeChart) return null

  function handleNewChart() {
    setOpen(false)
    const n = charts.length + 1
    createChart.mutate(
      { name: `Chart ${n}` },
      { onSuccess: (chart) => setActiveChartId(chart.id) },
    )
  }

  function handleDuplicate() {
    setOpen(false)
    duplicateChart.mutate(
      { name: `${activeChart.name} copy` },
      { onSuccess: (chart) => setActiveChartId(chart.id) },
    )
  }

  return (
    <>
      <div className="relative ml-2 inline-flex shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-[var(--toolbar-text)] hover:bg-white/10 transition-colors"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="max-w-[120px] truncate font-medium">{activeChart.name}</span>
          <Badge
            size="sm"
            variant={SongDifficultyEnum.variant(activeChart.computedDifficulty)}
            className="border-0"
          >
            {SongDifficultyEnum.label(activeChart.computedDifficulty)}
          </Badge>
          <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-50 shrink-0">
            <path
              d="M1 3l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close chart menu"
              onClick={() => setOpen(false)}
            />
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-shell-border bg-shell-surface py-1 shadow-md"
            >
              {charts.map((chart) => (
                <button
                  key={chart.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveChartId(chart.id)
                    setOpen(false)
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-shell-text hover:bg-shell-bg"
                >
                  <span className={chart.id === activeChartId ? 'font-medium' : ''}>
                    {chart.name}
                  </span>
                  <Badge size="sm" variant={SongDifficultyEnum.variant(chart.computedDifficulty)}>
                    {SongDifficultyEnum.label(chart.computedDifficulty)}
                  </Badge>
                </button>
              ))}
              <div className="my-1 border-t border-shell-border" />
              <button
                type="button"
                role="menuitem"
                disabled={createChart.isPending}
                onClick={handleNewChart}
                className="block w-full px-3 py-2 text-left text-xs text-shell-text hover:bg-shell-bg disabled:opacity-50"
              >
                New chart
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={duplicateChart.isPending}
                onClick={handleDuplicate}
                className="block w-full px-3 py-2 text-left text-xs text-shell-text hover:bg-shell-bg disabled:opacity-50"
              >
                Duplicate chart
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  setSettingsOpen(true)
                }}
                className="block w-full px-3 py-2 text-left text-xs text-shell-text hover:bg-shell-bg"
              >
                Chart settings
              </button>
            </div>
          </>
        )}
      </div>

      {settingsOpen && activeChart && (
        <ChartSettingsModal
          chart={activeChart}
          songId={songId}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
