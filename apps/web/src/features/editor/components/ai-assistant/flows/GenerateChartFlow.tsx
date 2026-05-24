import { useState } from 'react'
import { toast } from 'sonner'
import {
  SONG_DIFFICULTY_OPTIONS,
  SongDifficultyEnum,
  type ChartApplyPreview,
  type SongDifficulty,
} from '@ama-midi/shared'
import { Button, Textarea } from '../../../../../components/ui'
import { apiClient } from '../../../../auth/api'
import { useAuthStore } from '../../../../../store/auth.store'
import { useEditorStore } from '../../../../../store/editor.store'
import type { AiFlowBaseProps } from '../ai-assistant.types'

export function GenerateChartFlow({
  songId,
  song,
  chartId,
  noteCount,
  onPhaseChange,
  onCancel,
  streamRun,
}: AiFlowBaseProps) {
  const token = useAuthStore((s) => s.token)
  const { snapMode, setChartPreview, closeAiAssistant } = useEditorStore()
  const [description, setDescription] = useState('')
  const [targetTier, setTargetTier] = useState<SongDifficulty | ''>('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const { start, processing } = streamRun

  async function handleSubmit() {
    const brief = description.trim()
    if (!brief) {
      toast.error('Describe the chart you want first')
      return
    }
    if (!chartId) {
      toast.error('No chart selected')
      return
    }

    onPhaseChange('processing')
    try {
      const result = await start({
        action: 'generate-chart',
        chartId,
        replaceExisting,
        description: brief,
        snapMode,
        ...(targetTier ? { targetTier } : {}),
      })
      if (result.type !== 'result' || result.action !== 'generate-chart') return

      const { notes, sections } = result.payload
      if (notes.length === 0) {
        toast.error('AI returned no notes — try a more specific description')
        onPhaseChange('configure')
        return
      }

      const preview = await apiClient(token)<ChartApplyPreview>(
        `/songs/${songId}/charts/${chartId}/preview-chart`,
        { method: 'POST', body: JSON.stringify({ notes, replaceExisting }) },
      )
      setChartPreview({
        notes,
        sections,
        replaceExisting,
        placement: replaceExisting ? null : preview,
      })
      closeAiAssistant()
      setDescription('')
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
          Describe mood, genre, structure, and density. AI builds a full starter chart for{' '}
          <span className="text-shell-text">{song?.name ?? 'this song'}</span>
          {song ? ` (${song.bpm} BPM)` : ''}.
        </p>
        <div>
          <label className="mb-1 block text-xs text-shell-muted">
            Target tier hint <span className="text-shell-muted/70">(optional, not saved)</span>
          </label>
          <select
            value={targetTier}
            onChange={(e) => setTargetTier(e.target.value as SongDifficulty | '')}
            className={selectClassName}
            disabled={processing}
          >
            <option value="">No preference</option>
            {SONG_DIFFICULTY_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {SongDifficultyEnum.label(key)}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Upbeat EDM drop at 128 BPM feel — sparse intro 0–30s, building hi-hats on tracks 2–3, dense doubles in chorus 60–90s, calm outro"
          rows={5}
          maxLength={2000}
          disabled={processing}
        />
        {noteCount > 0 && (
          <label className="flex items-start gap-2 text-xs text-shell-text">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="mt-0.5"
              disabled={processing}
            />
            <span>
              Replace existing chart ({noteCount} notes)
              <span className="mt-0.5 block text-[10px] text-shell-muted">
                Removes current notes and section markers before applying the preview.
              </span>
            </span>
          </label>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-shell-border pt-4">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={processing || !description.trim()}
        >
          Generate preview
        </Button>
      </div>
    </>
  )
}
