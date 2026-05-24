import { useState } from 'react'
import { toast } from 'sonner'
import {
  SONG_DIFFICULTY_OPTIONS,
  SongDifficultyEnum,
  type SongDifficulty,
} from '@ama-midi/shared'
import { useEditorStore } from '../../../../../store/editor.store'
import type { AiFlowBaseProps } from '../ai-assistant.types'
import {
  AiFlowCallout,
  AiFlowFooter,
  AiFlowGhostButton,
  AiFlowHighlight,
  AiFlowIntro,
  AiFlowLabel,
  AiFlowPrimaryButton,
  AiFlowSelect,
  AiFlowTextarea,
} from '../AiFlowChrome'

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

      setChartPreview({ notes, sections, replaceExisting: true, placement: null })
      closeAiAssistant()
      setInstruction('')
    } catch {
      onPhaseChange('configure')
    }
  }

  return (
    <>
      <div className="space-y-4">
        <AiFlowIntro>
          Generate a full replacement preview for{' '}
          <AiFlowHighlight>{song?.name ?? 'this song'}</AiFlowHighlight>. The current chart is
          replaced only if you accept the preview.
        </AiFlowIntro>

        <div>
          <AiFlowLabel>Target tier</AiFlowLabel>
          <AiFlowSelect
            value={targetTier}
            onChange={(e) => setTargetTier(e.target.value as SongDifficulty | '')}
            disabled={processing}
          >
            <option value="">Choose target tier</option>
            {SONG_DIFFICULTY_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {SongDifficultyEnum.label(key)}
              </option>
            ))}
          </AiFlowSelect>
        </div>

        <AiFlowTextarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: keep chorus energetic, reduce doubles, add more holds"
          rows={4}
          maxLength={2000}
          disabled={processing}
        />

        <AiFlowCallout variant="amber">
          Preview uses replace mode. Accepting it will replace the current chart notes and section
          markers.
        </AiFlowCallout>
      </div>

      <AiFlowFooter>
        <AiFlowGhostButton onClick={onCancel} disabled={processing}>
          Cancel
        </AiFlowGhostButton>
        <AiFlowPrimaryButton
          onClick={() => void handleSubmit()}
          disabled={processing || !targetTier || !chartId || noteCount === 0}
        >
          Generate preview
        </AiFlowPrimaryButton>
      </AiFlowFooter>
    </>
  )
}
