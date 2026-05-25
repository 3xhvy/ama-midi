import { useState } from 'react'
import { toast } from 'sonner'
import type { Note } from '@ama-midi/shared'
import type { ConflictResolutionMap, PlacementPreview } from '@ama-midi/shared'
import { buildTapPlacementPreview } from '../engine/tap-placement-preview'
import { ConflictReviewModal } from './ConflictReviewModal'
import { EditorModalOverlay, EditorModalPanel } from './EditorModal'
import type { TapModeState } from '../../../store/editor.store'

interface Props {
  tapMode:       TapModeState
  existingNotes: Note[]
  songId:        string
  onApply:       (notes: Array<{ track: number; time: number; duration?: number }>) => Promise<void>
  onCancel:      () => void
}

type PlacementMode = 'exact' | 'offset'

export function TapApplyModal({ tapMode, existingNotes, songId, onApply, onCancel }: Props) {
  const [mode,        setMode]        = useState<PlacementMode>('exact')
  const [anchorInput, setAnchorInput] = useState('')
  const [applying,    setApplying]    = useState(false)
  const [preview,     setPreview]     = useState<PlacementPreview | null>(null)
  const [resolutions, setResolutions] = useState<ConflictResolutionMap>({})

  const offset = mode === 'exact'
    ? 0
    : Math.max(0, parseFloat(anchorInput) || 0) - tapMode.loopRange.start

  function buildPreview() {
    return buildTapPlacementPreview({
      songId,
      draftNotes:    tapMode.draftNotes,
      existingNotes,
      offset,
    })
  }

  async function handleConfirm() {
    const p = buildPreview()
    if (p.conflicts.length > 0) {
      setPreview(p)
      return
    }
    await commitNotes(p, {})
  }

  async function handleConflictApply() {
    if (!preview) return
    await commitNotes(preview, resolutions)
    setPreview(null)
  }

  async function commitNotes(p: PlacementPreview, res: ConflictResolutionMap) {
    setApplying(true)
    try {
      const toCreate = [
        ...p.creatable.map((c) => ({ track: c.track, time: c.time, duration: c.duration })),
        ...p.conflicts
          .filter((c) => res[c.conflictId] === 'REPLACE_WITH_PATTERN')
          .map((c) => ({ track: c.track, time: c.time, duration: c.incomingNote.duration })),
      ]
      if (toCreate.length === 0) {
        toast.info('No notes to apply')
        onCancel()
        return
      }
      await onApply(toCreate)
      toast.success(`${toCreate.length} note${toCreate.length === 1 ? '' : 's'} applied`)
      onCancel()
    } catch {
      toast.error('Failed to apply notes')
    } finally {
      setApplying(false)
    }
  }

  if (preview) {
    return (
      <ConflictReviewModal
        preview={preview}
        title="Tap Session Conflicts"
        incomingLabel="Tapped note"
        applyLabel="Apply tapped notes"
        resolutions={resolutions}
        onResolve={(id, action) => setResolutions((r) => ({ ...r, [id]: action }))}
        onApply={handleConflictApply}
        onCancel={() => setPreview(null)}
      />
    )
  }

  const noteCount = tapMode.draftNotes.length

  return (
    <EditorModalOverlay onClick={onCancel}>
      <EditorModalPanel onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-1">Apply Tap Session</h2>
          <p className="text-sm text-canvas-muted mb-6">
            {noteCount} note{noteCount === 1 ? '' : 's'} recorded. Choose where to place them.
          </p>

          <div className="flex flex-col gap-3 mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tap-placement"
                value="exact"
                checked={mode === 'exact'}
                onChange={() => setMode('exact')}
              />
              <span className="text-sm font-medium">Exact time</span>
              <span className="text-xs text-canvas-muted ml-1">(keep recorded timestamps)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tap-placement"
                value="offset"
                checked={mode === 'offset'}
                onChange={() => setMode('offset')}
              />
              <span className="text-sm font-medium">Other time</span>
            </label>

            {mode === 'offset' && (
              <div className="ml-6 flex items-center gap-2">
                <label className="text-xs text-canvas-muted">New start (seconds):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={anchorInput}
                  onChange={(e) => setAnchorInput(e.target.value)}
                  className="w-24 text-sm border border-canvas-border rounded px-2 py-1 bg-canvas-surface"
                  placeholder={String(tapMode.loopRange.start)}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded border border-canvas-border hover:bg-canvas-hover"
            >
              Discard
            </button>
            <button
              onClick={handleConfirm}
              disabled={applying || noteCount === 0}
              className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
        </div>
      </EditorModalPanel>
    </EditorModalOverlay>
  )
}
