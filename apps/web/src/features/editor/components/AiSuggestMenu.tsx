import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { trackColor, type Song, type SuggestNotesRequest } from '@ama-midi/shared'
import { useEditorStore } from '../../../store/editor.store'
import { AiGenerateChartModal } from './AiGenerateChartModal'
import { AiScaleChartModal } from './AiScaleChartModal'

interface Props {
  disabled: boolean
  songId: string
  song: Song | undefined
  noteCount: number
}

export function AiSuggestMenu({ disabled, songId, song, noteCount }: Props) {
  const [open, setOpen] = useState(false)
  const [fillOpen, setFillOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [scaleOpen, setScaleOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { playheadTime, snapMode, triggerAiSuggest, activeChartId } = useEditorStore()

  useEffect(() => {
    if (!open && !fillOpen) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFillOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, fillOpen])

  async function run(request: SuggestNotesRequest) {
    if (!triggerAiSuggest || loading) return
    setOpen(false)
    setFillOpen(false)
    setLoading(true)
    const toastId = toast.loading('Getting AI suggestions…')
    try {
      await triggerAiSuggest(request)
    } finally {
      setLoading(false)
      toast.dismiss(toastId)
    }
  }

  function fillTrack(track: number) {
    if (!activeChartId) return
    void run({
      chartId: activeChartId,
      mode: 'fill_track',
      targetTrack: track,
      playheadTime,
      snapMode,
    })
  }

  return (
    <>
      <div ref={rootRef} className="relative mr-1">
        <button
          type="button"
          disabled={loading}
          onClick={() => { setOpen((v) => !v); setFillOpen(false) }}
          data-tour="ai-suggest"
          className="editor-toolbar-suggest flex items-center gap-1"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span>AI</span>
          <span className="text-[10px] opacity-70">▾</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg border border-shell-border bg-shell-surface py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-xs text-shell-text hover:bg-white/5"
              onClick={() => { setGenerateOpen(true); setOpen(false) }}
            >
              Generate chart…
              <span className="mt-0.5 block text-[10px] text-shell-muted">
                Describe your song — AI builds a full chart
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-xs text-shell-text hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => { setScaleOpen(true); setOpen(false) }}
            >
              Scale difficulty…
              <span className="mt-0.5 block text-[10px] text-shell-muted">
                Make the current chart easier or harder
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-xs text-shell-text hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => { setFillOpen(true); setOpen(false) }}
            >
              Fill track…
              <span className="mt-0.5 block text-[10px] text-shell-muted">
                Add notes on one lane
              </span>
            </button>
          </div>
        )}

        {fillOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-shell-border bg-shell-surface p-3 shadow-lg">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-shell-muted">
              Pick track to fill
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => {
                const color = trackColor(track)
                return (
                  <button
                    key={track}
                    type="button"
                    title={`Track ${track}`}
                    onClick={() => fillTrack(track)}
                    className="flex h-8 items-center justify-center rounded-md border text-xs font-medium text-shell-text hover:opacity-90"
                    style={{ borderColor: color, backgroundColor: `${color}22` }}
                  >
                    {track}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setFillOpen(false)}
              className="mt-2 w-full text-center text-[10px] text-shell-muted hover:text-shell-text"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <AiGenerateChartModal
        songId={songId}
        song={song}
        noteCount={noteCount}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
      />
      <AiScaleChartModal
        songId={songId}
        song={song}
        chartId={activeChartId}
        noteCount={noteCount}
        open={scaleOpen}
        onOpenChange={setScaleOpen}
      />
    </>
  )
}
