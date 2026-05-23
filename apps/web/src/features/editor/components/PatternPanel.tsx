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

interface Props { songId: string }

type PasteStep = 'INPUT' | 'VALIDATING' | 'REVIEW' | 'CONFIRM_REPLACE_ALL' | 'APPLYING'
type ConflictResolutionState = Record<string, ConflictAction>

export function PatternPanel({ songId }: Props) {
  const { data: patterns = [] } = usePatterns()
  const deletePattern = useDeletePattern()
  const playheadTime  = useEditorStore(s => s.playheadTime)

  const [pasteTarget, setPasteTarget] = useState<NotePattern | null>(null)
  const [pasteTimeDraft, setPasteTimeDraft] = useState('')
  const [step, setStep] = useState<PasteStep>('INPUT')
  const [preview, setPreview] = useState<PatternPastePreview | null>(null)
  const [resolutions, setResolutions] = useState<ConflictResolutionState>({})

  const previewPaste = usePreviewPatternPaste(pasteTarget?.id)
  const applyPaste = useApplyPatternPaste(pasteTarget?.id)

  const pasteTime = parsePatternPasteTimeDraft(pasteTimeDraft)

  function resetPasteState() {
    setPasteTarget(null)
    setPasteTimeDraft('')
    setStep('INPUT')
    setPreview(null)
    setResolutions({})
  }

  function openPastePopup(pattern: NotePattern) {
    setPasteTarget(pattern)
    setPasteTimeDraft(formatPatternPasteTime(playheadTime))
    setStep('INPUT')
    setPreview(null)
    setResolutions({})
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

    setStep('VALIDATING')
    previewPaste.mutate(
      { songId, startTime: pasteTime },
      {
        onSuccess: (next) => {
          setPreview(next)
          setResolutions(Object.fromEntries(
            next.conflicts.map((conflict) => [conflict.conflictId, 'KEEP_EXISTING']),
          ))
          setStep('REVIEW')
        },
        onError: () => {
          setStep('INPUT')
          toast.error('Could not preview pattern paste')
        },
      },
    )
  }

  function handleReplaceAllConfirm() {
    if (!preview) return
    setResolutions(Object.fromEntries(
      preview.conflicts.map((conflict) => [conflict.conflictId, 'REPLACE_WITH_PATTERN']),
    ))
    setStep('REVIEW')
  }

  function handleApply() {
    if (!preview || !pasteTarget) return

    const replacedCount = Object.values(resolutions).filter((action) => action === 'REPLACE_WITH_PATTERN').length
    const skippedCount = preview.conflicts.length - replacedCount

    setStep('APPLYING')
    applyPaste.mutate(
      {
        songId,
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
            setResolutions(Object.fromEntries(
              nextPreview.conflicts.map((conflict) => [conflict.conflictId, 'KEEP_EXISTING']),
            ))
            toast.warning('Paste changed while you were reviewing. Review the updated conflicts.')
            return
          }
          toast.error('Could not apply pattern paste')
        },
      },
    )
  }

  const affectedCreators = preview?.conflicts.reduce<Record<string, number>>((acc, conflict) => {
    const name = conflict.existingNote.creatorName || 'Unknown'
    acc[name] = (acc[name] ?? 0) + 1
    return acc
  }, {}) ?? {}

  const replacedCount = preview
    ? Object.values(resolutions).filter((action) => action === 'REPLACE_WITH_PATTERN').length
    : 0
  const createCount = preview ? preview.creatable.length + replacedCount : 0

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

          {pasteTarget && (
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

                    {(step === 'INPUT' || step === 'VALIDATING') && (
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
                    )}

                    {step === 'CONFIRM_REPLACE_ALL' && preview && (
                      <div className="space-y-2 text-xs" style={{ color: 'var(--modal-text)' }}>
                        <p className="font-medium">
                          Replace {preview.summary.conflictCount} existing notes?
                        </p>
                        <p style={{ color: 'var(--modal-muted)' }}>This will remove notes created by:</p>
                        <ul className="space-y-1">
                          {Object.entries(affectedCreators).map(([name, count]) => (
                            <li key={name}>{name}: {count} notes</li>
                          ))}
                        </ul>
                        <p style={{ color: 'var(--modal-muted)' }}>This action will be recorded in history.</p>
                      </div>
                    )}

                    {step === 'REVIEW' && preview && (
                      <div className="space-y-3 text-xs" style={{ color: 'var(--modal-text)' }}>
                        <div className="space-y-1" style={{ color: 'var(--modal-muted)' }}>
                          <p>{preview.summary.totalPatternNotes} pattern notes</p>
                          <p>{preview.summary.creatableNotes} will be created</p>
                          <p>{preview.summary.conflictCount} conflicts found</p>
                          <p>{preview.summary.affectedExistingNotes} existing notes affected</p>
                        </div>

                        {preview.conflicts.length > 0 && (
                          <>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setResolutions(Object.fromEntries(
                                  preview.conflicts.map((c) => [c.conflictId, 'KEEP_EXISTING']),
                                ))}
                              >
                                Keep all existing
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setStep('CONFIRM_REPLACE_ALL')}
                              >
                                Replace all conflicts
                              </Button>
                            </div>

                            <ul className="max-h-48 space-y-2 overflow-y-auto">
                              {preview.conflicts.map((conflict) => (
                                <li
                                  key={conflict.conflictId}
                                  className="rounded border p-2"
                                  style={{ borderColor: 'var(--modal-input-border)' }}
                                >
                                  <p className="font-medium">
                                    Track {conflict.track} · {formatPatternPasteTime(conflict.time)}s
                                  </p>
                                  <p style={{ color: 'var(--modal-muted)' }}>
                                    Existing: &quot;{conflict.existingNote.title}&quot; · {conflict.existingNote.noteType} · {conflict.existingNote.creatorName}
                                  </p>
                                  <p style={{ color: 'var(--modal-muted)' }}>
                                    Pattern: {conflict.patternNote.noteType} · offset +{conflict.patternNote.timeOffset}s
                                  </p>
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      className="rounded border px-2 py-1 text-[10px]"
                                      style={{
                                        borderColor: 'var(--modal-input-border)',
                                        backgroundColor: resolutions[conflict.conflictId] === 'KEEP_EXISTING'
                                          ? 'var(--modal-input-bg)'
                                          : 'transparent',
                                      }}
                                      onClick={() => setResolutions((prev) => ({
                                        ...prev,
                                        [conflict.conflictId]: 'KEEP_EXISTING',
                                      }))}
                                    >
                                      Keep Existing
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded border px-2 py-1 text-[10px]"
                                      style={{
                                        borderColor: 'var(--modal-input-border)',
                                        backgroundColor: resolutions[conflict.conflictId] === 'REPLACE_WITH_PATTERN'
                                          ? 'var(--modal-input-bg)'
                                          : 'transparent',
                                      }}
                                      onClick={() => setResolutions((prev) => ({
                                        ...prev,
                                        [conflict.conflictId]: 'REPLACE_WITH_PATTERN',
                                      }))}
                                    >
                                      Replace With Pattern
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Button size="sm" variant="ghost" onClick={resetPasteState}>
                    Cancel
                  </Button>

                  {step === 'INPUT' && (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={pasteTime == null}
                      loading={previewPaste.isPending}
                      onClick={handleValidate}
                    >
                      Validate
                    </Button>
                  )}

                  {step === 'CONFIRM_REPLACE_ALL' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setStep('REVIEW')}>
                        Back
                      </Button>
                      <Button size="sm" variant="primary" onClick={handleReplaceAllConfirm}>
                        Confirm Replace All
                      </Button>
                    </>
                  )}

                  {step === 'REVIEW' && preview && (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={applyPaste.isPending}
                      onClick={handleApply}
                    >
                      {preview.conflicts.length === 0
                        ? 'Paste'
                        : `Paste ${createCount} notes`}
                    </Button>
                  )}
                </Modal.Footer>
              </Modal.Content>
            </Modal.Root>
          )}
        </>
      )}
    </div>
  )
}
