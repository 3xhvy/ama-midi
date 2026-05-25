import { useEffect, useState } from 'react'
import type { SongChart } from '@ama-midi/shared'
import { Button, Input } from '../../../components/ui'
import { Modal } from '../../../components/ui/Modal'
import { ensureUniqueChartName } from './ai-chart-name'

interface Props {
  open: boolean
  suggestedName: string
  charts: SongChart[]
  applying?: boolean
  onConfirm: (name: string) => void
  onClose: () => void
}

export function CreateAiChartModal({
  open,
  suggestedName,
  charts,
  applying = false,
  onConfirm,
  onClose,
}: Props) {
  const [letAiName, setLetAiName] = useState(true)
  const [customName, setCustomName] = useState('')

  useEffect(() => {
    if (!open) return
    setLetAiName(true)
    setCustomName('')
  }, [open, suggestedName])

  const resolvedAiName = ensureUniqueChartName(suggestedName, charts)
  const resolvedCustomName = ensureUniqueChartName(customName, charts)
  const canSubmit = letAiName || customName.trim().length > 0

  function handleConfirm() {
    onConfirm(letAiName ? resolvedAiName : resolvedCustomName)
  }

  return (
    <Modal.Root open={open} onOpenChange={(next) => { if (!next && !applying) onClose() }}>
      <Modal.Content className="max-w-[420px]">
        <Modal.Header onClose={applying ? undefined : onClose}>Create new chart</Modal.Header>
        <Modal.Body className="space-y-4">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--modal-muted)' }}>
            Save the AI preview as a new chart. Your current chart stays unchanged.
          </p>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs"
            style={{ borderColor: 'var(--modal-border)' }}>
            <input
              type="checkbox"
              checked={letAiName}
              onChange={(e) => setLetAiName(e.target.checked)}
              disabled={applying}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block font-medium" style={{ color: 'var(--modal-text)' }}>
                Let AI choose the name
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug" style={{ color: 'var(--modal-muted)' }}>
                Uses section labels or your brief to suggest a chart name.
              </span>
            </span>
          </label>

          {letAiName ? (
            <div
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--modal-border)', color: 'var(--modal-text)' }}
            >
              {resolvedAiName}
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--modal-text)' }}>
                Chart name
              </label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Hard remix"
                maxLength={60}
                disabled={applying}
                autoFocus
              />
              {customName.trim() && resolvedCustomName !== customName.trim() && (
                <p className="mt-1.5 text-[10px]" style={{ color: 'var(--modal-muted)' }}>
                  Will save as “{resolvedCustomName}” to avoid a duplicate name.
                </p>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={applying}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={applying || !canSubmit}
          >
            {applying ? 'Creating…' : 'Create chart'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
