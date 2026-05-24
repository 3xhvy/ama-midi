import { useState } from 'react'
import type { Note, NoteCopyPreview, NoteCopyPreviewRequest } from '@ama-midi/shared'
import { measureDuration } from '@ama-midi/shared'
import { Button, Modal } from '../../../components/ui'
import { toast } from 'sonner'
import { usePreviewNoteCopy } from '../hooks/useNoteCopy'
import {
  formatRepeatInterval,
  getRepeatDefaults,
  getSelectionLengthInterval,
  parseRepeatCountDraft,
  parseRepeatIntervalDraft,
  sanitizeRepeatCountDraft,
  sanitizeRepeatIntervalDraft,
  validateRepeatRequest,
} from './repeat-transform'

interface Props {
  chartId: string
  selectedNotes: Note[]
  bpm: number
  timeSignature: string
  onCancel: () => void
  onPreviewReady: (preview: NoteCopyPreview, request: NoteCopyPreviewRequest) => void
}

export function RepeatModal({
  chartId,
  selectedNotes,
  bpm,
  timeSignature,
  onCancel,
  onPreviewReady,
}: Props) {
  const previewCopy = usePreviewNoteCopy(chartId)
  const defaults = getRepeatDefaults(selectedNotes, bpm, timeSignature)
  const [repeatCountDraft, setRepeatCountDraft] = useState(defaults.repeatCountDraft)
  const [repeatIntervalDraft, setRepeatIntervalDraft] = useState(defaults.repeatIntervalDraft)
  const [validating, setValidating] = useState(false)

  const repeatCount = parseRepeatCountDraft(repeatCountDraft)
  const repeatInterval = parseRepeatIntervalDraft(repeatIntervalDraft)
  const validationError = validateRepeatRequest(selectedNotes, repeatCount, repeatInterval)
  const generatedCount = repeatCount == null ? 0 : selectedNotes.length * repeatCount

  function setOneBeat() {
    setRepeatIntervalDraft(formatRepeatInterval(60 / bpm))
  }

  function setOneMeasure() {
    setRepeatIntervalDraft(formatRepeatInterval(measureDuration(bpm, timeSignature)))
  }

  function setSelectionLength() {
    setRepeatIntervalDraft(formatRepeatInterval(getSelectionLengthInterval(selectedNotes)))
  }

  function buildRequest(): NoteCopyPreviewRequest {
    return {
      noteIds: selectedNotes.map((note) => note.id),
      operation: 'COPY',
      mode: 'REPEAT_INTERVAL',
      repeatCount: repeatCount!,
      repeatInterval: repeatInterval!,
    }
  }

  function handleValidate() {
    if (validationError) {
      toast.error(validationError)
      return
    }

    const request = buildRequest()
    setValidating(true)
    previewCopy.mutate(request, {
      onSuccess: (preview) => {
        setValidating(false)
        onPreviewReady(preview, request)
      },
      onError: () => {
        setValidating(false)
        toast.error('Could not preview repeat')
      },
    })
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onCancel()}>
      <Modal.Content className="max-w-[420px]">
        <Modal.Header onClose={onCancel}>Repeat Notes</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--modal-muted)' }}>
              {selectedNotes.length} selected notes. Creates {generatedCount} repeated notes.
            </p>

            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--modal-muted)' }}>
                Copies
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={repeatCountDraft}
                onChange={(event) => setRepeatCountDraft(sanitizeRepeatCountDraft(event.target.value))}
                className="w-full rounded border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                style={{
                  backgroundColor: 'var(--modal-input-bg)',
                  borderColor: 'var(--modal-input-border)',
                  color: 'var(--modal-input-text)',
                }}
                aria-label="Repeat copy count"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-xs" style={{ color: 'var(--modal-muted)' }}>
                Interval
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={repeatIntervalDraft}
                  onChange={(event) => setRepeatIntervalDraft(sanitizeRepeatIntervalDraft(event.target.value))}
                  onBlur={() => {
                    if (repeatInterval != null) setRepeatIntervalDraft(formatRepeatInterval(repeatInterval))
                  }}
                  className="min-w-0 flex-1 rounded border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                  style={{
                    backgroundColor: 'var(--modal-input-bg)',
                    borderColor: 'var(--modal-input-border)',
                    color: 'var(--modal-input-text)',
                  }}
                  aria-label="Repeat interval in seconds"
                />
                <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>s</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={setOneBeat} className="rounded border border-shell-border px-2 py-1 text-xs text-shell-muted hover:text-shell-text">
                  1 beat
                </button>
                <button type="button" onClick={setOneMeasure} className="rounded border border-shell-border px-2 py-1 text-xs text-shell-muted hover:text-shell-text">
                  1 measure
                </button>
                <button type="button" onClick={setSelectionLength} className="rounded border border-shell-border px-2 py-1 text-xs text-shell-muted hover:text-shell-text">
                  Selection length
                </button>
              </div>
            </div>

            {validationError && <p className="text-xs text-error">{validationError}</p>}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={validationError != null}
            loading={validating || previewCopy.isPending}
            onClick={handleValidate}
          >
            Validate
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
