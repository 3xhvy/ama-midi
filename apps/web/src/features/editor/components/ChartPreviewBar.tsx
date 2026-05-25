import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import type { ApplyChartResponse, ChartApplyPreview, ConflictAction, GeneratedChartNote } from '@ama-midi/shared'
import { Button } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { useEditorStore } from '../../../store/editor.store'
import { apiClient } from '../../auth/api'
import { ConflictReviewModal } from './ConflictReviewModal'
import { applyMergeWithResolutions, mergeApplyToast } from './chart-merge-apply'
import { confirmReplaceEntireChart } from './chart-replace-warning'
import { chartApplyPreviewToPlacement, buildConflictResolutionPayload, mergeResolutions } from './placement-preview'

interface Props {
  songId: string
  chartId: string | undefined
}

type ConflictResolutionState = Record<string, ConflictAction>

export function ChartPreviewBar({ songId, chartId }: Props) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  const { chartPreview, setChartPreview, clearChartPreview } = useEditorStore()
  const [applying, setApplying] = useState(false)
  const [showConflicts, setShowConflicts] = useState(false)
  const [resolutions, setResolutions] = useState<ConflictResolutionState>({})
  const [conflictChanged, setConflictChanged] = useState(false)

  if (!chartPreview || !chartId) return null

  const { notes, sections, replaceExisting, placement } = chartPreview
  const createCount = placement?.summary.creatableNotes ?? notes.length
  const conflictCount = placement?.summary.conflictCount ?? 0

  function resetConflictState() {
    setShowConflicts(false)
    setResolutions({})
    setConflictChanged(false)
  }

  function handleDismiss() {
    clearChartPreview()
    resetConflictState()
  }

  function openConflictReview() {
    if (!placement) return
    setResolutions({})
    setConflictChanged(false)
    setShowConflicts(true)
  }

  async function handleApplySuccess(result: ApplyChartResponse) {
    clearChartPreview()
    resetConflictState()
    await qc.invalidateQueries({ queryKey: ['notes', chartId] })
    await qc.invalidateQueries({ queryKey: ['sections', songId] })
    toast.success(mergeApplyToast(result))
  }

  function handle409(err: { body?: unknown }, currentResolutions: ConflictResolutionState) {
    const nextPreview = (err.body as { preview?: ChartApplyPreview } | undefined)?.preview
    if (!nextPreview) return false

    const current = useEditorStore.getState().chartPreview
    if (current) {
      setChartPreview({ ...current, placement: nextPreview })
    }
    setResolutions(mergeResolutions(currentResolutions, nextPreview.conflicts))
    setConflictChanged(true)
    toast.warning('Chart changed while you were reviewing. Review the updated conflicts.')
    return true
  }

  async function acceptReplace() {
    if (!confirmReplaceEntireChart()) return

    setApplying(true)
    const toastId = toast.loading('Applying chart…')
    try {
      const result = await apiClient(token)<ApplyChartResponse>(
        `/songs/${songId}/apply-chart`,
        {
          method: 'POST',
          body: JSON.stringify({
            chartId,
            notes,
            sections,
            replaceExisting: true,
          }),
        },
      )
      await handleApplySuccess(result)
    } catch {
      toast.error('Failed to apply chart')
    } finally {
      setApplying(false)
      toast.dismiss(toastId)
    }
  }

  async function acceptMerge() {
    setApplying(true)
    const toastId = toast.loading('Applying chart…')
    try {
      const result = await apiClient(token)<ApplyChartResponse>(
        `/songs/${songId}/apply-chart`,
        {
          method: 'POST',
          body: JSON.stringify({
            chartId,
            notes,
            sections,
            replaceExisting: false,
            ...(placement ? { previewVersion: placement.previewVersion } : {}),
          }),
        },
      )
      await handleApplySuccess(result)
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 409 &&
        handle409(err as { body?: unknown }, resolutions)
      ) {
        return
      }
      toast.error('Failed to apply chart')
    } finally {
      setApplying(false)
      toast.dismiss(toastId)
    }
  }

  async function applyWithResolutions() {
    if (!placement) return

    try {
      buildConflictResolutionPayload(placement.conflicts, resolutions)
    } catch {
      toast.error('Resolve all conflicts before applying')
      return
    }

    setApplying(true)
    const toastId = toast.loading('Applying chart…')
    const currentResolutions = resolutions
    try {
      const result = await applyMergeWithResolutions(
        token,
        songId,
        chartId!,
        notes as GeneratedChartNote[],
        placement,
        currentResolutions,
      )
      await handleApplySuccess(result)
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        (err as { status?: number }).status === 409 &&
        handle409(err as { body?: unknown }, currentResolutions)
      ) {
        return
      }
      toast.error('Failed to apply chart')
    } finally {
      setApplying(false)
      toast.dismiss(toastId)
    }
  }

  function handleResolve(conflictId: string, action: ConflictAction) {
    setResolutions((prev) => ({ ...prev, [conflictId]: action }))
  }

  const primaryLabel = applying
    ? 'Applying…'
    : replaceExisting
      ? 'Replace chart →'
      : `Apply ${createCount} notes →`

  function handlePrimaryClick() {
    if (replaceExisting) {
      void acceptReplace()
    } else if (placement && conflictCount > 0) {
      openConflictReview()
    } else {
      void acceptMerge()
    }
  }

  return (
    <>
      <div className="editor-chrome-bar -mx-4 flex w-auto items-center justify-between gap-3 border-t px-4 py-2">
        <div className="min-w-0 text-xs text-chrome-text">
          <span className="font-medium">AI chart preview</span>
          <span className="ml-2 text-chrome-muted">
            {notes.length} notes
            {(sections?.length ?? 0) > 0 ? ` · ${sections?.length} sections` : ''}
            {replaceExisting
              ? ' · will replace existing'
              : placement
                ? ` · ${placement.summary.creatableNotes} creatable · ${placement.summary.conflictCount} conflicts`
                : ''}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={applying}>
            Dismiss
          </Button>
          <Button size="sm" variant="primary" onClick={handlePrimaryClick} disabled={applying}>
            {primaryLabel}
          </Button>
        </div>
      </div>

      {showConflicts && placement && (
        <ConflictReviewModal
          preview={chartApplyPreviewToPlacement(placement)}
          title="Apply AI Chart"
          incomingLabel="AI Chart"
          applyLabel="Apply chart"
          resolutions={resolutions}
          onResolve={handleResolve}
          onApply={() => void applyWithResolutions()}
          onCancel={() => setShowConflicts(false)}
          hasConflictChanged={conflictChanged}
          onDismissConflictBanner={() => setConflictChanged(false)}
        />
      )}
    </>
  )
}
