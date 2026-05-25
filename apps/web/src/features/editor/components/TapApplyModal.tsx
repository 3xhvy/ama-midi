import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import type { ChartApplyPreview, ConflictAction, ConflictResolutionMap } from '@ama-midi/shared'
import { useAuthStore } from '../../../store/auth.store'
import {
  applyMergeWithResolutions,
  fetchMergePreview,
  mergeApplyToast,
  tapDraftsToChartNotes,
} from './chart-merge-apply'
import { draftTapNotesToPatternNotes } from '../tap-session'
import { chartApplyPreviewToPlacement, mergeResolutions, buildConflictResolutionPayload } from './placement-preview'
import { ConflictReviewModal } from './ConflictReviewModal'
import { SavePatternModal } from './SavePatternModal'
import { EditorModalOverlay, EditorModalPanel } from './EditorModal'
import type { TapModeState } from '../../../store/editor.store'

interface Props {
  tapMode:  TapModeState
  songId:   string
  chartId:  string
  onCancel: () => void
}

type PlacementMode = 'exact' | 'offset'

export function TapApplyModal({ tapMode, songId, chartId, onCancel }: Props) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  const [mode, setMode] = useState<PlacementMode>('exact')
  const [anchorInput, setAnchorInput] = useState('')
  const [applying, setApplying] = useState(false)
  const [placement, setPlacement] = useState<ChartApplyPreview | null>(null)
  const [resolutions, setResolutions] = useState<ConflictResolutionMap>({})
  const [conflictChanged, setConflictChanged] = useState(false)
  const [savePattern, setSavePattern] = useState(false)
  const [showConflicts, setShowConflicts] = useState(false)

  const offset = mode === 'exact'
    ? 0
    : Math.max(0, parseFloat(anchorInput) || 0) - tapMode.loopRange.start

  const chartNotes = tapDraftsToChartNotes(tapMode.draftNotes, offset)

  async function loadPreview(nextOffset = offset) {
    const notes = tapDraftsToChartNotes(tapMode.draftNotes, nextOffset)
    if (notes.length === 0) return null
    return fetchMergePreview(token, songId, chartId, notes)
  }

  async function handleConfirm() {
    setApplying(true)
    try {
      const next = await loadPreview()
      if (!next) {
        toast.info('No notes to apply')
        return
      }
      setPlacement(next)
      setResolutions({})
      setConflictChanged(false)
      if (next.summary.conflictCount > 0) {
        setShowConflicts(true)
      } else {
        await handleConflictApply(next, {})
      }
    } catch {
      toast.error('Could not preview tap session')
    } finally {
      setApplying(false)
    }
  }

  async function handleConflictApply(
    activePlacement = placement,
    activeResolutions: ConflictResolutionMap = resolutions,
  ) {
    if (!activePlacement) return

    try {
      buildConflictResolutionPayload(activePlacement.conflicts, activeResolutions)
    } catch {
      toast.error('Resolve all conflicts before applying')
      return
    }

    setApplying(true)
    try {
      const result = await applyMergeWithResolutions(
        token,
        songId,
        chartId,
        chartNotes,
        activePlacement,
        activeResolutions,
      )
      await qc.invalidateQueries({ queryKey: ['notes', chartId] })
      toast.success(mergeApplyToast(result))
      onCancel()
    } catch (err: unknown) {
      const nextPreview = (err as { body?: { preview?: ChartApplyPreview } })?.body?.preview
      if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 409 &&
        nextPreview
      ) {
        setPlacement(nextPreview)
        setResolutions(mergeResolutions(resolutions, nextPreview.conflicts))
        setConflictChanged(true)
        toast.warning('Chart changed while you were reviewing. Review the updated conflicts.')
        return
      }
      toast.error('Could not apply tap session')
    } finally {
      setApplying(false)
    }
  }

  function handleResolve(conflictId: string, action: ConflictAction) {
    setResolutions((prev) => ({ ...prev, [conflictId]: action }))
  }

  const noteCount = tapMode.draftNotes.length
  const patternNotes = draftTapNotesToPatternNotes(tapMode.draftNotes)
  const defaultPatternName = `Tap ${tapMode.loopRange.start}s–${tapMode.loopRange.end}s`

  if (savePattern) {
    return (
      <SavePatternModal
        songId={songId}
        patternNotes={patternNotes}
        title="Save tap session as pattern"
        defaultName={defaultPatternName}
        onClose={() => setSavePattern(false)}
        onSaved={onCancel}
      />
    )
  }

  if (showConflicts && placement) {
    return (
      <ConflictReviewModal
        preview={chartApplyPreviewToPlacement(placement)}
        title="Apply Tap Session"
        incomingLabel="Tapped note"
        applyLabel="Apply tapped notes"
        resolutions={resolutions}
        onResolve={handleResolve}
        onApply={() => void handleConflictApply()}
        onCancel={() => setShowConflicts(false)}
        hasConflictChanged={conflictChanged}
        onDismissConflictBanner={() => setConflictChanged(false)}
      />
    )
  }

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
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded border border-canvas-border hover:bg-canvas-hover"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setSavePattern(true)}
              disabled={noteCount === 0}
              className="px-4 py-2 text-sm rounded border border-violet-500/50 text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
            >
              Save as pattern
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={applying || noteCount === 0}
              className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {applying ? 'Applying…' : 'Apply to chart'}
            </button>
          </div>
        </div>
      </EditorModalPanel>
    </EditorModalOverlay>
  )
}
