import { useState } from 'react'
import { toast } from 'sonner'
import { CounterClockwiseClockIcon, PlusIcon } from '@radix-ui/react-icons'
import { cn } from '../../../../../lib/utils'
import { Button, Textarea } from '../../../../../components/ui'
import { useEditorStore } from '../../../../../store/editor.store'
import type { AiFlowBaseProps } from '../ai-assistant.types'

type ImproveSubMode = 'extend' | 'refine'

const SUB_MODES: {
  value: ImproveSubMode
  title: string
  description: string
  Icon: typeof PlusIcon
}[] = [
  {
    value: 'extend',
    title: 'Extend forward',
    description: 'Add ~4 notes continuing the rhythm after the selection',
    Icon: PlusIcon,
  },
  {
    value: 'refine',
    title: 'Refine selection',
    description: 'Rewrite the selected notes — fix spacing, density, or lane choices',
    Icon: CounterClockwiseClockIcon,
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

  if (!subMode) {
    return (
      <>
        <div className="space-y-3">
          <p className="text-xs text-shell-muted">
            {selectedNotes.length} notes selected · time range {minTime.toFixed(1)}–{maxTime.toFixed(1)} s
            {currentSection ? ` · section: ${currentSection.label}` : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SUB_MODES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSubMode(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors',
                  'border-shell-border hover:border-shell-muted',
                )}
              >
                <opt.Icon className="h-5 w-5 text-shell-muted" />
                <span className="text-xs font-medium text-shell-text">{opt.title}</span>
                <span className="text-[10px] leading-snug text-shell-muted">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs text-shell-muted">
          {selectedNotes.length} notes selected · time range {minTime.toFixed(1)}–{maxTime.toFixed(1)} s
          {currentSection ? ` · section: ${currentSection.label}` : ''}
        </p>
        <p className="text-xs text-shell-text">
          Mode: <span className="font-medium">{subMode === 'extend' ? 'Extend forward' : 'Refine selection'}</span>
          {' · '}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setSubMode(null)}
            disabled={processing}
          >
            Change
          </button>
        </p>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: add doubles, simplify, keep same lanes"
          rows={3}
          maxLength={2000}
          disabled={processing}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-shell-border pt-4">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={processing || !chartId || selectedNotes.length < 2}
        >
          Get suggestions
        </Button>
      </div>
    </>
  )
}
