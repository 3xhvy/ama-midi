import {
  BarChartIcon,
  LoopIcon,
  Pencil2Icon,
  RowsIcon,
} from '@radix-ui/react-icons'
import { cn } from '../../../../lib/utils'
import { Tooltip } from '../../../../components/ui'
import type { AiAssistantFeature } from './ai-assistant.types'

const FEATURES: {
  value: AiAssistantFeature
  title: string
  description: string
  Icon: typeof Pencil2Icon
  disabledReason?: (ctx: { noteCount: number; selectedCount: number }) => string | null
}[] = [
  {
    value: 'generate-chart',
    title: 'Generate chart',
    description: 'Build a full chart from a description',
    Icon: Pencil2Icon,
    disabledReason: () => null,
  },
  {
    value: 'scale-chart',
    title: 'Scale difficulty',
    description: 'Preview an easier or harder replacement chart',
    Icon: BarChartIcon,
    disabledReason: ({ noteCount }) =>
      noteCount < 1 ? 'Add notes to the chart first' : null,
  },
  {
    value: 'fill-track',
    title: 'Fill track',
    description: 'Add notes on one lane near the playhead',
    Icon: RowsIcon,
    disabledReason: ({ noteCount }) =>
      noteCount < 5 ? 'Need at least 5 notes on the chart' : null,
  },
  {
    value: 'improve-pattern',
    title: 'Improve pattern',
    description: 'Extend or refine a selected note pattern',
    Icon: LoopIcon,
    disabledReason: ({ selectedCount }) =>
      selectedCount < 2 ? 'Select at least 2 notes on the chart' : null,
  },
]

interface Props {
  noteCount: number
  selectedCount: number
  onSelect: (feature: AiAssistantFeature) => void
}

export function AiFeaturePicker({ noteCount, selectedCount, onSelect }: Props) {
  const improveDisabled = selectedCount < 2

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-shell-text">What would you like AI to do?</h3>

      <div className="grid grid-cols-2 gap-2">
        {FEATURES.map((feat) => {
          const disabledReason = feat.disabledReason?.({ noteCount, selectedCount })
          const disabled = disabledReason != null

          const card = (
            <button
              key={feat.value}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(feat.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-3 pt-4 text-center transition-colors',
                disabled
                  ? 'cursor-not-allowed border-shell-border opacity-40'
                  : 'border-shell-border hover:border-shell-muted',
              )}
            >
              <feat.Icon className="h-5 w-5 text-shell-muted" />
              <span className="text-xs font-medium leading-tight text-shell-text">{feat.title}</span>
              <span className="text-[10px] leading-snug text-shell-muted">{feat.description}</span>
            </button>
          )

          if (disabled && disabledReason) {
            return (
              <Tooltip key={feat.value} content={disabledReason} side="top">
                <span className="block">{card}</span>
              </Tooltip>
            )
          }

          return card
        })}
      </div>

      {improveDisabled && (
        <p className="text-xs text-shell-muted">Select 2+ notes on the chart first.</p>
      )}
    </div>
  )
}
