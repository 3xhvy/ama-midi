import { useState } from 'react'
import { toast } from 'sonner'
import {
  SONG_DIFFICULTY_OPTIONS,
  SongDifficultyEnum,
  type SongDifficulty,
} from '@ama-midi/shared'
import { Button, Textarea } from '../../../../../components/ui'
import { useEditorStore } from '../../../../../store/editor.store'
import type { AiFlowBaseProps } from '../ai-assistant.types'

export function ScaleDifficultyFlow({
  song,
  chartId,
  noteCount,
  onPhaseChange,
  onCancel,
  streamRun,
}: AiFlowBaseProps) {
  const { snapMode, setChartPreview, closeAiAssistant } = useEditorStore()
  const [targetTier, setTargetTier] = useState<SongDifficulty | ''>('')
  const [instruction, setInstruction] = useState('')
  const { start, processing } = streamRun

  async function handleSubmit() {
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

    onPhaseChange('processing')
    try {
      const result = await start({
        action: 'scale-chart',
        chartId,
        targetTier,
        snapMode,
        ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
      })
      if (result.type !== 'result' || result.action !== 'scale-chart') return

      const { notes, sections } = result.payload
      if (notes.length === 0) {
        toast.error('AI returned no notes — try a different target or instruction')
        onPhaseChange('configure')
        return
      }

      setChartPreview({ notes, sections, replaceExisting: true })
      closeAiAssistant()
      setInstruction('')
    } catch {
      onPhaseChange('configure')
    }
  }

  const selectClassName =
    'w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text'

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs text-shell-muted">
          Generate a full replacement preview for{' '}
          <span className="text-shell-text">{song?.name ?? 'this song'}</span>. The current chart
          is replaced only if you accept the preview.
        </p>
        <div>
          <label className="mb-1 block text-xs text-shell-muted">Target tier</label>
          <select
            value={targetTier}
            onChange={(e) => setTargetTier(e.target.value as SongDifficulty | '')}
            className={selectClassName}
            disabled={processing}
          >
            <option value="">Choose target tier</option>
            {SONG_DIFFICULTY_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {SongDifficultyEnum.label(key)}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: keep chorus energetic, reduce doubles, add more holds"
          rows={4}
          maxLength={2000}
          disabled={processing}
        />
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-shell-text">
          Preview uses replace mode. Accepting it will replace the current chart notes and section
          markers.
        </p>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-shell-border pt-4">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={processing || !targetTier || !chartId || noteCount === 0}
        >
          Generate preview
        </Button>
      </div>
    </>
  )
}
