import { useState } from 'react'
import { toast } from 'sonner'
import {
  SONG_DIFFICULTY_OPTIONS,
  SongDifficultyEnum,
  type GenerateChartResponse,
  type ScaleChartRequest,
  type Song,
  type SongDifficulty,
} from '@ama-midi/shared'
import { Button, Modal, Textarea } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { useEditorStore } from '../../../store/editor.store'
import { apiClient } from '../../auth/api'

interface Props {
  songId: string
  song: Song | undefined
  chartId: string | null
  noteCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiScaleChartModal({ songId, song, chartId, noteCount, open, onOpenChange }: Props) {
  const token = useAuthStore((s) => s.token)
  const { snapMode, setChartPreview } = useEditorStore()
  const [targetTier, setTargetTier] = useState<SongDifficulty | ''>('')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)

  async function scale() {
    if (!chartId) {
      toast.error('No chart selected')
      return
    }
    if (!targetTier) {
      toast.error('Choose a target tier')
      return
    }
    if (noteCount === 0) {
      toast.error('Add or generate notes before scaling difficulty')
      return
    }

    setLoading(true)
    const toastId = toast.loading('Scaling chart…')
    try {
      const body: ScaleChartRequest = {
        chartId,
        targetTier,
        snapMode,
        ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
      }
      const result = await apiClient(token)<GenerateChartResponse>(`/songs/${songId}/scale-chart`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (result.notes.length === 0) {
        toast.error('AI returned no notes — try a different target or instruction')
        return
      }
      setChartPreview({
        notes: result.notes,
        sections: result.sections,
        replaceExisting: true,
      })
      toast.success(`Scaled preview ready — ${result.notes.length} notes`)
      onOpenChange(false)
      setInstruction('')
    } catch {
      toast.error('Failed to scale chart')
    } finally {
      setLoading(false)
      toast.dismiss(toastId)
    }
  }

  const selectClassName =
    'w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text'

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content className="max-w-lg">
        <Modal.Header>
          <h2 className="text-sm font-semibold text-shell-text">Scale chart difficulty</h2>
        </Modal.Header>
        <Modal.Body className="space-y-3">
          <p className="text-xs text-shell-muted">
            Generate a full replacement preview for <span className="text-shell-text">{song?.name ?? 'this song'}</span>.
            The current chart is replaced only if you accept the preview.
          </p>
          <div>
            <label className="mb-1 block text-xs text-shell-muted">Target tier</label>
            <select
              value={targetTier}
              onChange={(e) => setTargetTier(e.target.value as SongDifficulty | '')}
              className={selectClassName}
              disabled={loading}
            >
              <option value="">Choose target tier</option>
              {SONG_DIFFICULTY_OPTIONS.map((key) => (
                <option key={key} value={key}>{SongDifficultyEnum.label(key)}</option>
              ))}
            </select>
          </div>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional: keep chorus energetic, reduce doubles, add more holds"
            rows={4}
            maxLength={2000}
            disabled={loading}
          />
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-shell-text">
            Preview uses replace mode. Accepting it will replace the current chart notes and section markers.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void scale()} disabled={loading || !targetTier || !chartId || noteCount === 0}>
            {loading ? 'Scaling…' : 'Generate preview'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
