import { useState } from 'react'
import { toast } from 'sonner'
import {
  SONG_DIFFICULTY_OPTIONS,
  SongDifficultyEnum,
  type ChartApplyPreview,
  type SongDifficulty,
} from '@ama-midi/shared'
import { apiClient } from '../../../../auth/api'
import { useAuthStore } from '../../../../../store/auth.store'
import { useEditorStore } from '../../../../../store/editor.store'
import type { AiFlowBaseProps } from '../ai-assistant.types'
import {
  AiFlowCallout,
  AiFlowCheckbox,
  AiFlowFooter,
  AiFlowGhostButton,
  AiFlowHighlight,
  AiFlowIntro,
  AiFlowLabel,
  AiFlowPrimaryButton,
  AiFlowSelect,
  AiFlowTextarea,
} from '../AiFlowChrome'
import { confirmReplaceEntireChart } from '../../chart-replace-warning'
import { suggestAiChartName } from '../../ai-chart-name'
import { useCharts } from '../../../../charts/useCharts'
import { AiPromptTemplateChips } from '../AiPromptTemplateChips'

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
  const { data: charts = [] } = useCharts(songId)
  const [description, setDescription] = useState('')
  const [targetTier, setTargetTier] = useState<SongDifficulty | ''>('')
  const [createAsNewChart, setCreateAsNewChart] = useState(true)
  const [useReferenceChart, setUseReferenceChart] = useState(true)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const { start, processing } = streamRun

  function handleCreateAsNewChartChange(checked: boolean) {
    setCreateAsNewChart(checked)
    if (checked) setReplaceExisting(false)
  }

  function handleReplaceExistingChange(checked: boolean) {
    if (checked && !confirmReplaceEntireChart(noteCount)) return
    setReplaceExisting(checked)
    if (checked) setCreateAsNewChart(false)
  }

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

    const aiReplaceExisting = createAsNewChart
      ? !useReferenceChart
      : replaceExisting

    onPhaseChange('processing')
    try {
      const result = await start({
        action: 'generate-chart',
        chartId,
        replaceExisting: aiReplaceExisting,
        createAsNewChart,
        useReferenceChart: createAsNewChart ? useReferenceChart : undefined,
        description: brief,
        snapMode,
        ...(targetTier ? { targetTier } : {}),
      })
      if (result.type !== 'result' || result.action !== 'generate-chart') {
        toast.error('Unexpected AI response — try again')
        onPhaseChange('configure')
        return
      }

      const { notes, sections } = result.payload
      if (notes.length === 0) {
        toast.error('AI returned no notes — try a more specific description')
        onPhaseChange('configure')
        return
      }

      let placement: ChartApplyPreview | null = null
      if (!createAsNewChart && !replaceExisting) {
        placement = await apiClient(token)<ChartApplyPreview>(
          `/songs/${songId}/charts/${chartId}/preview-chart`,
          { method: 'POST', body: JSON.stringify({ notes, replaceExisting: false }) },
        )
      }

      setChartPreview({
        notes,
        sections,
        replaceExisting: createAsNewChart || replaceExisting,
        createAsNewChart,
        useReferenceChart: createAsNewChart ? useReferenceChart : undefined,
        previewOnClearGrid: createAsNewChart && useReferenceChart,
        suggestedChartName: createAsNewChart
          ? suggestAiChartName(sections, brief, charts)
          : undefined,
        placement,
      })
      toast.success('Chart preview ready — apply from the bar above when ready')
      closeAiAssistant()
      setDescription('')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      toast.error(e instanceof Error ? e.message : 'Failed to generate chart preview')
      onPhaseChange('configure')
    }
  }

  return (
    <>
      <div className="space-y-4">
        <AiFlowIntro>
          Describe mood, genre, structure, and density. AI builds a full starter chart for{' '}
          <AiFlowHighlight>{song?.name ?? 'this song'}</AiFlowHighlight>
          {song ? ` (${song.bpm} BPM)` : ''}.
        </AiFlowIntro>

        <div>
          <AiFlowLabel hint="(optional, not saved)">Target tier hint</AiFlowLabel>
          <AiFlowSelect
            value={targetTier}
            onChange={(e) => setTargetTier(e.target.value as SongDifficulty | '')}
            disabled={processing}
          >
            <option value="">No preference</option>
            {SONG_DIFFICULTY_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {SongDifficultyEnum.label(key)}
              </option>
            ))}
          </AiFlowSelect>
        </div>

        <AiPromptTemplateChips
          flow="generate-chart"
          value={description}
          onChange={setDescription}
          disabled={processing}
        />

        <AiFlowTextarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Upbeat EDM drop — sparse intro, building hi-hats, hold notes on vocals/bass, dense doubles in chorus"
          rows={5}
          maxLength={2000}
          disabled={processing}
        />

        <AiFlowCheckbox
          checked={createAsNewChart}
          onChange={handleCreateAsNewChartChange}
          disabled={processing}
          title="Create as new chart"
          description="Applies the preview to a new chart and leaves the current chart unchanged."
        />

        {createAsNewChart && (
          <AiFlowCheckbox
            checked={useReferenceChart}
            onChange={setUseReferenceChart}
            disabled={processing}
            title="Use current chart as reference"
            description="AI reads this chart for style and density. Preview shows only the generated notes on an empty grid."
          />
        )}

        {!createAsNewChart && noteCount > 0 && (
          <>
            <AiFlowCheckbox
              checked={replaceExisting}
              onChange={handleReplaceExistingChange}
              disabled={processing}
              title={`Replace existing chart (${noteCount} notes)`}
              description="Removes current notes and section markers before applying the preview."
            />
            {replaceExisting && (
              <AiFlowCallout variant="amber">
                Dangerous: applying this preview will delete all {noteCount} existing notes and
                section markers. Review the preview on the grid before clicking Replace chart.
              </AiFlowCallout>
            )}
          </>
        )}
      </div>

      <AiFlowFooter>
        <AiFlowGhostButton onClick={onCancel} disabled={processing}>
          Cancel
        </AiFlowGhostButton>
        <AiFlowPrimaryButton
          onClick={() => void handleSubmit()}
          disabled={processing || !description.trim()}
        >
          Generate preview
        </AiFlowPrimaryButton>
      </AiFlowFooter>
    </>
  )
}
