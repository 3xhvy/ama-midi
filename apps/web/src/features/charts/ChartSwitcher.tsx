import { useEffect, useRef, useState } from 'react'
import { SongDifficultyEnum, type SongChart } from '@ama-midi/shared'
import { Badge } from '../../components/ui'
import { useEditorStore } from '../../store/editor.store'
import { useCreateChart } from './useCharts'
import { useDuplicateChart } from './useDuplicateChart'
import { ChartSettingsModal } from './ChartSettingsModal'

const DROPDOWN_ID = 'chart-switcher-dropdown'

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
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        !btnRef.current?.contains(target)
        && !document.getElementById(DROPDOWN_ID)?.contains(target)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  if (!activeChart) return null

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      setDropPos({ top: rect.bottom + 6, left: rect.left })
    }
    setOpen(true)
  }

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
      <div className="relative shrink-0">
        <button
          ref={btnRef}
          type="button"
          data-tour="chart-difficulty"
          onClick={() => (open ? setOpen(false) : openDropdown())}
          className="editor-toolbar-chip"
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
          <div
            id={DROPDOWN_ID}
            role="menu"
            style={{
              position: 'fixed',
              top: dropPos.top,
              left: dropPos.left,
              zIndex: 9999,
            }}
            className="editor-toolbar-dropdown min-w-[200px] py-1"
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
