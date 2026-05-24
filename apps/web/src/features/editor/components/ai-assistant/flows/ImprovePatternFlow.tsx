import { useState } from 'react'
import { toast } from 'sonner'
import { CounterClockwiseClockIcon, PlusIcon } from '@radix-ui/react-icons'
import { useEditorStore } from '../../../../../store/editor.store'
import type { AiFlowBaseProps } from '../ai-assistant.types'
import {
  AiFlowFooter,
  AiFlowGhostButton,
  AiFlowHighlight,
  AiFlowIntro,
  AiFlowPrimaryButton,
  AiFlowTextarea,
} from '../AiFlowChrome'

type ImproveSubMode = 'extend' | 'refine'

const SUB_MODES: {
  value: ImproveSubMode
  title: string
  description: string
  Icon: typeof PlusIcon
  accent: 'violet' | 'cyan'
}[] = [
  {
    value: 'extend',
    title: 'Extend forward',
    description: 'Add ~4 notes continuing the rhythm after the selection',
    Icon: PlusIcon,
    accent: 'violet',
  },
  {
    value: 'refine',
    title: 'Refine selection',
    description: 'Rewrite the selected notes — fix spacing, density, or lane choices',
    Icon: CounterClockwiseClockIcon,
    accent: 'cyan',
  },
]

export function ImprovePatternFlow({
  chartId,
  selectedNotes,
  sections,
  onPhaseChange,
  onResultMessage,
  onCancel,
  streamRun,
}: AiFlowBaseProps) {
  const aiAssistant = useEditorStore((s) => s.aiAssistant)
  const { snapMode, setAiSuggestions } = useEditorStore()
  const [subMode, setSubMode] = useState<ImproveSubMode | null>(
    aiAssistant?.improveSubMode ?? null,
  )
  const [instruction, setInstruction] = useState('')
  const { start, processing } = streamRun

  const times = selectedNotes.map((n) => n.time)
  const minTime = times.length ? Math.min(...times) : 0
  const maxTime = times.length ? Math.max(...times) : 0
  const currentSection = [...sections].reverse().find((s) => s.time <= minTime)

  async function handleSubmit() {
    if (!chartId) {
      toast.error('No chart selected')
      return
    }
    if (!subMode) {
      toast.error('Choose Extend or Refine')
      return
    }
    if (selectedNotes.length < 2) {
      toast.error('Select at least 2 notes to improve a pattern')
      return
    }

    const patternNotes = selectedNotes.map((n) => ({ track: n.track, time: n.time }))
    const mode = subMode === 'extend' ? 'continue_pattern' : 'refine_pattern'

    onPhaseChange('processing')
    try {
      const result = await start({
        action: 'suggest-notes',
        chartId,
        mode,
        playheadTime: maxTime,
        snapMode,
        selectedNotes: patternNotes,
        ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
      })
      if (result.type !== 'result' || result.action !== 'suggest-notes') return

      const { suggestions } = result.payload
      if (suggestions.length === 0) {
        onResultMessage('No suggestions — try a different instruction')
        onPhaseChange('result')
        return
      }

      setAiSuggestions(suggestions)
      onResultMessage(`${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} ready on chart`)
      onPhaseChange('result')
    } catch {
      onPhaseChange('configure')
    }
  }

  const selectionSummary = (
    <AiFlowIntro>
      <AiFlowHighlight>{selectedNotes.length} notes</AiFlowHighlight> selected · time range{' '}
      {minTime.toFixed(1)}–{maxTime.toFixed(1)} s
      {currentSection ? (
        <>
          {' '}
          · section: <AiFlowHighlight>{currentSection.label}</AiFlowHighlight>
        </>
      ) : null}
    </AiFlowIntro>
  )

  if (!subMode) {
    return (
      <div className="space-y-4">
        {selectionSummary}
        <div className="ai-flow-submode-grid">
          {SUB_MODES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSubMode(opt.value)}
              className={`ai-feature-card ai-feature-card--${opt.accent} w-full`}
            >
              <span className="ai-feature-icon">
                <opt.Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="ai-feature-title">{opt.title}</span>
              <span className="ai-feature-desc">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {selectionSummary}
        <p className="ai-flow-mode-text text-xs">
          Mode:{' '}
          <span className="ai-flow-mode-name">
            {subMode === 'extend' ? 'Extend forward' : 'Refine selection'}
          </span>
          {' · '}
          <button
            type="button"
            className="ai-flow-mode-link"
            onClick={() => setSubMode(null)}
            disabled={processing}
          >
            Change
          </button>
        </p>
        <AiFlowTextarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: add doubles, simplify, keep same lanes"
          rows={3}
          maxLength={2000}
          disabled={processing}
        />
      </div>

      <AiFlowFooter>
        <AiFlowGhostButton onClick={onCancel} disabled={processing}>
          Cancel
        </AiFlowGhostButton>
        <AiFlowPrimaryButton
          onClick={() => void handleSubmit()}
          disabled={processing || !chartId || selectedNotes.length < 2}
        >
          Get suggestions
        </AiFlowPrimaryButton>
      </AiFlowFooter>
    </>
  )
}
