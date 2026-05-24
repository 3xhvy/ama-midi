import { useState } from 'react'
import type {
  Note,
  NoteCopyOperation,
  NoteCopyPreview,
  NoteCopyPreviewRequest,
  NoteCopyTransformMode,
} from '@ama-midi/shared'
import { trackColor } from '@ama-midi/shared'
import { Button, Modal, ToggleGroup } from '../../../components/ui'
import { EditorModalContent } from './EditorModal'
import { toast } from 'sonner'
import { usePreviewNoteCopy } from '../hooks/useNoteCopy'
import {
  formatTimeDelta,
  parseTimeDeltaDraft,
  sanitizeTimeDeltaDraft,
  stepTimeDeltaDraft,
  validateTrackTarget,
} from './copy-to-transform'
import {
  formatPatternPasteTime,
  parsePatternPasteTimeDraft,
  sanitizePatternPasteTimeDraft,
  stepPatternPasteTimeDraft,
} from './pattern-placement'

interface Props {
  chartId:        string
  selectedNotes:  Note[]
  onCancel:       () => void
  onPreviewReady: (preview: NoteCopyPreview, request: NoteCopyPreviewRequest) => void
}

type CopyMode = NoteCopyTransformMode

const MODE_TABS: { value: CopyMode; label: string }[] = [
  { value: 'TIME_SHIFT', label: 'Time' },
  { value: 'TRACK_SHIFT', label: 'Track' },
  { value: 'TRACK_TIME_ANCHOR', label: 'Track + Time' },
]

export function CopyToModal({ chartId, selectedNotes, onCancel, onPreviewReady }: Props) {
  const previewCopy = usePreviewNoteCopy(chartId)

  const [operation, setOperation] = useState<NoteCopyOperation>('COPY')
  const [mode, setMode] = useState<CopyMode>('TIME_SHIFT')
  const [timeDeltaDraft, setTimeDeltaDraft] = useState('+0.0')
  const [targetTrack, setTargetTrack] = useState(1)
  const [anchorTrack, setAnchorTrack] = useState(1)
  const [anchorTimeDraft, setAnchorTimeDraft] = useState('0.0')
  const [validating, setValidating] = useState(false)

  const minTrack = Math.min(...selectedNotes.map((n) => n.track))
  const maxTrack = Math.max(...selectedNotes.map((n) => n.track))
  const timeDelta = parseTimeDeltaDraft(timeDeltaDraft)
  const anchorTime = parsePatternPasteTimeDraft(anchorTimeDraft)
  const trackError = mode !== 'TIME_SHIFT' ? validateTrackTarget(
    mode === 'TRACK_SHIFT' ? targetTrack : anchorTrack,
    minTrack,
    maxTrack,
  ) : null

  function buildRequest() {
    const noteIds = selectedNotes.map((n) => n.id)
    if (mode === 'TIME_SHIFT') {
      return { noteIds, operation, mode, timeDelta: timeDelta! }
    }
    if (mode === 'TRACK_SHIFT') {
      return { noteIds, operation, mode, targetTrack }
    }
    return { noteIds, operation, mode, anchorTrack, anchorTime: anchorTime! }
  }

  function validateInputs(): string | null {
    if (mode === 'TIME_SHIFT') {
      if (timeDelta == null) return 'Enter a valid time shift (e.g. +2.0 or -1.5)'
      return null
    }
    if (trackError) return trackError
    if (mode === 'TRACK_TIME_ANCHOR' && anchorTime == null) {
      return 'Enter an anchor time between 0.0s and 300.0s'
    }
    return null
  }

  function handleValidate() {
    const error = validateInputs()
    if (error) {
      toast.error(error)
      return
    }

    setValidating(true)
    previewCopy.mutate(buildRequest(), {
      onSuccess: (preview) => {
        setValidating(false)
        onPreviewReady(preview, buildRequest())
      },
      onError: () => {
        setValidating(false)
        toast.error('Could not preview copy/move')
      },
    })
  }

  return (
    <Modal.Root open onOpenChange={(open) => !open && onCancel()}>
      <EditorModalContent className="max-w-[420px]">
        <Modal.Header onClose={onCancel}>Copy / Move Notes</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--modal-muted)' }}>
              {selectedNotes.length} notes selected
            </p>

            <div className="space-y-1.5">
              <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>Operation</span>
              <ToggleGroup
                items={[
                  { value: 'COPY', label: 'Copy' },
                  { value: 'MOVE', label: 'Move' },
                ]}
                value={operation}
                onValueChange={(v) => setOperation(v as NoteCopyOperation)}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>Destination</span>
              <ToggleGroup
                items={MODE_TABS}
                value={mode}
                onValueChange={(v) => setMode(v as CopyMode)}
                className="w-full"
              />
            </div>

            {mode === 'TIME_SHIFT' && (
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--modal-muted)' }}>
                  Time shift
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={timeDeltaDraft}
                    onChange={(e) => setTimeDeltaDraft(sanitizeTimeDeltaDraft(e.target.value))}
                    onBlur={() => {
                      if (timeDelta != null) setTimeDeltaDraft(formatTimeDelta(timeDelta))
                    }}
                    className="min-w-0 flex-1 rounded border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                    style={{
                      backgroundColor: 'var(--modal-input-bg)',
                      borderColor: 'var(--modal-input-border)',
                      color: 'var(--modal-input-text)',
                    }}
                    aria-label="Time shift in seconds"
                    autoFocus
                  />
                  <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>s</span>
                  <button
                    type="button"
                    onClick={() => setTimeDeltaDraft(stepTimeDeltaDraft(timeDeltaDraft, -1))}
                    className="h-8 w-8 rounded border text-sm hover:opacity-80"
                    style={{ borderColor: 'var(--modal-input-border)', color: 'var(--modal-text)' }}
                    aria-label="Decrease time shift"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeDeltaDraft(stepTimeDeltaDraft(timeDeltaDraft, 1))}
                    className="h-8 w-8 rounded border text-sm hover:opacity-80"
                    style={{ borderColor: 'var(--modal-input-border)', color: 'var(--modal-text)' }}
                    aria-label="Increase time shift"
                  >
                    +
                  </button>
                </div>
                {timeDelta == null && (
                  <p className="mt-1 text-xs text-error">Enter a valid shift (e.g. +2.0 or -1.5)</p>
                )}
              </div>
            )}

            {mode === 'TRACK_SHIFT' && (
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--modal-muted)' }}>
                  Target track (selection starts on track {minTrack})
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
                    <button
                      key={track}
                      type="button"
                      onClick={() => setTargetTrack(track)}
                      className={`rounded border px-2 py-2 text-xs font-medium transition-colors ${
                        targetTrack === track
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-shell-border text-shell-muted hover:text-shell-text'
                      }`}
                    >
                      <span
                        className="mr-1 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: trackColor(track) }}
                      />
                      {track}
                    </button>
                  ))}
                </div>
                {trackError && <p className="mt-1 text-xs text-error">{trackError}</p>}
              </div>
            )}

            {mode === 'TRACK_TIME_ANCHOR' && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--modal-muted)' }}>
                    Anchor track
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => (
                      <button
                        key={track}
                        type="button"
                        onClick={() => setAnchorTrack(track)}
                        className={`rounded border px-2 py-2 text-xs font-medium transition-colors ${
                          anchorTrack === track
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-shell-border text-shell-muted hover:text-shell-text'
                        }`}
                      >
                        <span
                          className="mr-1 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: trackColor(track) }}
                        />
                        {track}
                      </button>
                    ))}
                  </div>
                  {trackError && <p className="mt-1 text-xs text-error">{trackError}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-xs" style={{ color: 'var(--modal-muted)' }}>
                    Anchor time
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={anchorTimeDraft}
                      onChange={(e) => setAnchorTimeDraft(sanitizePatternPasteTimeDraft(e.target.value))}
                      onBlur={() => {
                        if (anchorTime != null) setAnchorTimeDraft(formatPatternPasteTime(anchorTime))
                      }}
                      className="min-w-0 flex-1 rounded border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30"
                      style={{
                        backgroundColor: 'var(--modal-input-bg)',
                        borderColor: 'var(--modal-input-border)',
                        color: 'var(--modal-input-text)',
                      }}
                      aria-label="Anchor time in seconds"
                    />
                    <span className="text-xs" style={{ color: 'var(--modal-muted)' }}>s</span>
                    <button
                      type="button"
                      onClick={() => setAnchorTimeDraft(stepPatternPasteTimeDraft(anchorTimeDraft, -1))}
                      className="h-8 w-8 rounded border text-sm hover:opacity-80"
                      style={{ borderColor: 'var(--modal-input-border)', color: 'var(--modal-text)' }}
                      aria-label="Move anchor time earlier"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnchorTimeDraft(stepPatternPasteTimeDraft(anchorTimeDraft, 1))}
                      className="h-8 w-8 rounded border text-sm hover:opacity-80"
                      style={{ borderColor: 'var(--modal-input-border)', color: 'var(--modal-text)' }}
                      aria-label="Move anchor time later"
                    >
                      +
                    </button>
                  </div>
                  {anchorTime == null && (
                    <p className="mt-1 text-xs text-error">Enter 0.0-300.0s</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={validateInputs() != null}
            loading={validating || previewCopy.isPending}
            onClick={handleValidate}
          >
            Validate
          </Button>
        </Modal.Footer>
      </EditorModalContent>
    </Modal.Root>
  )
}
