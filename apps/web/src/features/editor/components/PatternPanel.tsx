import { useState } from 'react'
import {
  usePatterns,
  useDeletePattern,
  usePreviewPatternPaste,
  useApplyPatternPaste,
} from '../../patterns/usePatterns'
import { useEditorStore } from '../../../store/editor.store'
import { Button, Modal } from '../../../components/ui'
import { toast } from 'sonner'
import type { ConflictAction, NotePattern, PatternPastePreview } from '@ama-midi/shared'
import {
  formatPatternPasteTime,
  parsePatternPasteTimeDraft,
  sanitizePatternPasteTimeDraft,
  stepPatternPasteTimeDraft,
} from './pattern-placement'
import { ConflictReviewModal } from './ConflictReviewModal'
import { mergeResolutions, patternPreviewToPlacement } from './placement-preview'

interface Props { songId: string; chartId?: string }

type PasteStep = 'INPUT' | 'VALIDATING' | 'REVIEW' | 'APPLYING'
type ConflictResolutionState = Record<string, ConflictAction>

export function PatternPanel({ songId, chartId }: Props) {
  const { data: patterns = [] } = usePatterns()
  const deletePattern = useDeletePattern()
  const playheadTime  = useEditorStore(s => s.playheadTime)

  const [pasteTarget, setPasteTarget] = useState<NotePattern | null>(null)
  const [pasteTimeDraft, setPasteTimeDraft] = useState('')
  const [step, setStep] = useState<PasteStep>('INPUT')
  const [preview, setPreview] = useState<PatternPastePreview | null>(null)
  const [resolutions, setResolutions] = useState<ConflictResolutionState>({})
  const [conflictChanged, setConflictChanged] = useState(false)

  const previewPaste = usePreviewPatternPaste(pasteTarget?.id)
  const applyPaste = useApplyPatternPaste(pasteTarget?.id, chartId)

  const pasteTime = parsePatternPasteTimeDraft(pasteTimeDraft)

  function resetPasteState() {
    setPasteTarget(null)
    setPasteTimeDraft('')
    setStep('INPUT')
    setPreview(null)
    setResolutions({})
    setConflictChanged(false)
  }

  function openPastePopup(pattern: NotePattern) {
    setPasteTarget(pattern)
    setPasteTimeDraft(formatPatternPasteTime(playheadTime))
    setStep('INPUT')
    setPreview(null)
    setResolutions({})
    setConflictChanged(false)
  }

  function handlePasteTimeChange(value: string) {
    setPasteTimeDraft(sanitizePatternPasteTimeDraft(value))
  }

  function handlePasteTimeBlur() {
    if (pasteTime != null) setPasteTimeDraft(formatPatternPasteTime(pasteTime))
  }

  function handlePasteTimeStep(direction: 1 | -1) {
    setPasteTimeDraft(stepPatternPasteTimeDraft(pasteTimeDraft, direction))
  }

  function usePlayheadTime() {
    setPasteTimeDraft(formatPatternPasteTime(playheadTime))
  }

  function handleValidate() {
    if (pasteTime == null || !pasteTarget) {
      toast.error('Enter a paste time between 0.0s and 300.0s')
      return
    }
    if (!chartId) {
      toast.error('No chart selected')
      return
    }

    setStep('VALIDATING')
    previewPaste.mutate(
      { songId, chartId, startTime: pasteTime },
      {
        onSuccess: (next) => {
          setPreview(next)
          setResolutions({})
          setConflictChanged(false)
          setStep('REVIEW')
        },
        onError: () => {
          setStep('INPUT')
          toast.error('Could not preview pattern paste')
        },
      },
    )
  }

  function handleApply() {
    if (!preview || !pasteTarget || !chartId) return

    const replacedCount = Object.values(resolutions).filter((action) => action === 'REPLACE_WITH_PATTERN').length
    const skippedCount = preview.conflicts.length - replacedCount

    setStep('APPLYING')
    applyPaste.mutate(
      {
        songId,
        chartId,
        startTime: preview.startTime,
        patternVersion: preview.patternVersion,
        resolutions: preview.conflicts.map((conflict) => ({
          conflictId: conflict.conflictId,
          action: resolutions[conflict.conflictId] ?? 'KEEP_EXISTING',
        })),
      },
      {
        onSuccess: (result) => {
          toast.success(
            `Pasted ${result.createdCount} notes, replaced ${result.replacedCount}, skipped ${skippedCount}`,
          )
          resetPasteState()
        },
        onError: (err: any) => {
          setStep('REVIEW')
          const nextPreview = err?.body?.preview as PatternPastePreview | undefined
          if (err?.status === 409 && nextPreview) {
            setPreview(nextPreview)
            setResolutions(mergeResolutions(resolutions, patternPreviewToPlacement(nextPreview).conflicts))
            setConflictChanged(true)
            toast.warning('Paste changed while you were reviewing. Review the updated conflicts.')
            return
          }
          toast.error('Could not apply pattern paste')
        },
      },
    )
  }

  function handleResolve(conflictId: string, action: ConflictAction) {
    setResolutions(prev => ({ ...prev, [conflictId]: action }))
  }

  return (
    <div className="px-3 py-2 border-t border-shell-border">
      <div className="text-xs font-medium text-shell-text uppercase tracking-wide mb-2">Patterns</div>
      {patterns.length === 0 ? (
        <p className="text-[10px] text-shell-muted">No patterns yet. Select 2+ notes and save as pattern.</p>
      ) : (
        <>
          <ul className="space-y-1">
            {patterns.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-shell-text">{p.name} <span className="text-shell-muted">({p.notes.length})</span></span>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openPastePopup(p)}
                    className="px-1.5 py-0.5 text-[10px] rounded border border-shell-border text-shell-muted hover:text-shell-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Paste
                  </button>
                  <button
                    onClick={() => deletePattern.mutate(p.id)}
                    className="px-1.5 py-0.5 text-[10px] rounded text-shell-muted/60 hover:text-red-400"
                    title="Delete pattern"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {pasteTarget && (step === 'INPUT' || step === 'VALIDATING') && (
            <Modal.Root open onOpenChange={(open) => !open && resetPasteState()}>
              <Modal.Content className="max-w-[420px]">
                <Modal.Header onClose={resetPasteState}>Paste Pattern</Modal.Header>
                <Modal.Body>
                  <div className="space-y-3">
                    <div>
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--modal-text)' }}>
                        {pasteTarget.name}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--modal-muted)' }}>
                        {pasteTarget.notes.length} notes
                      </p>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="text-xs" style={{ color: 'var(--modal-muted)' }}>
                          Paste at
                        </label>
                        <button
                          type="button"
                          onClick={usePlayheadTime}
                          className="text-xs hover:opacity-80"
                          style={{ color: 'var(--modal-muted)' }}
                        >
                          Playhead {formatPatternPasteTime(playheadTime)}s
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={pasteTimeDraft}
                          onChange={(e) => handlePasteTimeChange(e.target.value)}
                          onBlur={handlePasteTimeBlur}
                          className="min-w-0 flex-1 rounded border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                          style={{
                            backgroundColor: 'var(--modal-input-bg)',
                            borderColor:     'var(--modal-input-border)',
                            color:           'var(--modal-input-text)',
                          }}
                          aria-label="Pattern paste time in seconds"
                          autoFocus
                        />
                        <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>s</span>
                        <button
                          type="button"
                          onClick={() => handlePasteTimeStep(-1)}
                          className="h-8 w-8 rounded border text-sm hover:opacity-80"
                          style={{ borderColor: 'var(--modal-input-border)', color: 'var(--modal-text)' }}
                          aria-label="Move paste time earlier"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePasteTimeStep(1)}
                          className="h-8 w-8 rounded border text-sm hover:opacity-80"
                          style={{ borderColor: 'var(--modal-input-border)', color: 'var(--modal-text)' }}
                          aria-label="Move paste time later"
                        >
                          +
                        </button>
                      </div>
                      {pasteTime == null && (
                        <p className="mt-1 text-xs text-error">Enter 0.0-300.0s</p>
                      )}
                    </div>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button size="sm" variant="ghost" onClick={resetPasteState}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={pasteTime == null}
                    loading={previewPaste.isPending || step === 'VALIDATING'}
                    onClick={handleValidate}
                  >
                    Validate
                  </Button>
                </Modal.Footer>
              </Modal.Content>
            </Modal.Root>
          )}

          {step === 'REVIEW' && preview && pasteTarget && (
            <ConflictReviewModal
              preview={patternPreviewToPlacement(preview)}
              title={`Paste Pattern — ${pasteTarget.name}`}
              incomingLabel="Pattern"
              applyLabel="Paste"
              resolutions={resolutions}
              onResolve={handleResolve}
              onApply={handleApply}
              onCancel={resetPasteState}
              hasConflictChanged={conflictChanged}
              onDismissConflictBanner={() => setConflictChanged(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
