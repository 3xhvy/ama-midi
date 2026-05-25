import { useEffect, useState } from 'react'
import type { Note } from '@ama-midi/shared'
import { EditorModalOverlay, EditorModalPanel } from './EditorModal'
import type { LoopRange } from '../../../store/editor.store'
import { seedDraftFromNotes } from '../tap-session'
import { TRACK_TO_TAP_KEY } from '../tap-keymap'

export type TapSeedMode = 'fresh' | 'existing'

export interface TapSetupResult {
  loopRange: LoopRange
  seedMode:  TapSeedMode
  draftNotes: ReturnType<typeof seedDraftFromNotes>
}

interface Props {
  open:              boolean
  initialRange:      LoopRange
  existingNotes:     Note[]
  onPickOnTimeline:  () => void
  onStart:           (result: TapSetupResult) => void
  onCancel:          () => void
}

export function TapSetupModal({
  open,
  initialRange,
  existingNotes,
  onPickOnTimeline,
  onStart,
  onCancel,
}: Props) {
  const [startInput, setStartInput] = useState(String(initialRange.start))
  const [endInput,   setEndInput]   = useState(String(initialRange.end))
  const [seedMode,   setSeedMode]   = useState<TapSeedMode>('fresh')

  useEffect(() => {
    if (!open) return
    setStartInput(String(initialRange.start))
    setEndInput(String(initialRange.end))
    setSeedMode('fresh')
  }, [open, initialRange.start, initialRange.end])

  if (!open) return null

  const start = parseFloat(startInput)
  const end   = parseFloat(endInput)
  const valid = !Number.isNaN(start) && !Number.isNaN(end) && end > start + 0.09

  const notesInRange = valid
    ? existingNotes.filter((n) => n.time >= start && n.time < end).length
    : 0

  function handleStart() {
    if (!valid) return
    const loopRange = {
      start: Math.max(0, Math.round(start * 100) / 100),
      end:   Math.round(end * 100) / 100,
    }
    const draftNotes = seedMode === 'existing'
      ? seedDraftFromNotes(existingNotes, loopRange)
      : []
    onStart({ loopRange, seedMode, draftNotes })
  }

  return (
    <EditorModalOverlay onClick={onCancel}>
      <EditorModalPanel onClick={(e) => e.stopPropagation()}>
        <div className="p-6 max-w-md">
          <h2 className="text-lg font-semibold mb-1">Tap to Rhythm</h2>
          <p className="text-sm text-canvas-muted mb-5">
            Set a loop range, then tap along while the chart plays.
          </p>

          <div className="space-y-4 mb-5">
            <div className="flex items-end gap-3">
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-canvas-muted">Start (s)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="w-full text-sm border border-canvas-border rounded px-2 py-1.5 bg-canvas-surface"
                />
              </label>
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-xs text-canvas-muted">End (s)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  className="w-full text-sm border border-canvas-border rounded px-2 py-1.5 bg-canvas-surface"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={onPickOnTimeline}
              className="w-full px-3 py-2 text-sm rounded border border-canvas-border hover:bg-canvas-hover text-left"
            >
              Pick on timeline…
              <span className="block text-xs text-canvas-muted mt-0.5">
                Shift+drag on the time axis to draw the loop range
              </span>
            </button>

            <div className="space-y-2">
              <span className="text-xs text-canvas-muted">Draft contents</span>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tap-seed"
                  checked={seedMode === 'fresh'}
                  onChange={() => setSeedMode('fresh')}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Start fresh
                  <span className="block text-xs text-canvas-muted">Hides existing notes in the loop while you record new taps</span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="tap-seed"
                  checked={seedMode === 'existing'}
                  onChange={() => setSeedMode('existing')}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Include existing notes in range
                  {valid && (
                    <span className="block text-xs text-canvas-muted">
                      {notesInRange} note{notesInRange === 1 ? '' : 's'} in range — shown as draft; conflicts resolved on apply
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 mb-5 text-xs text-canvas-muted space-y-1">
            <p className="font-medium text-canvas-text">Keys while playing</p>
            <p className="font-mono text-[11px]">
              {Object.entries(TRACK_TO_TAP_KEY).map(([t, k]) => (
                <span key={t} className="mr-2">T{t}:{k}</span>
              ))}
            </p>
            <p>Short press = tap · hold ≥0.15s = hold note · loop repeats automatically</p>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded border border-canvas-border hover:bg-canvas-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={!valid}
              className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Start session
            </button>
          </div>
        </div>
      </EditorModalPanel>
    </EditorModalOverlay>
  )
}
