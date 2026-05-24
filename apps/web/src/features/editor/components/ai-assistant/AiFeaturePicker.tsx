import {
  BarChartIcon,
  LoopIcon,
  Pencil2Icon,
  RowsIcon,
} from '@radix-ui/react-icons'
import { Tooltip } from '../../../../components/ui'
import type { AiAssistantFeature } from './ai-assistant.types'

type FeatureAccent = 'violet' | 'cyan' | 'emerald' | 'amber'

const FEATURES: {
  value: AiAssistantFeature
  title: string
  description: string
  Icon: typeof Pencil2Icon
  accent: FeatureAccent
  disabledReason?: (ctx: { noteCount: number; selectedCount: number }) => string | null
}[] = [
  {
    value: 'generate-chart',
    title: 'Generate chart',
    description: 'Build a full chart from a description',
    Icon: Pencil2Icon,
    accent: 'violet',
    disabledReason: () => null,
  },
  {
    value: 'scale-chart',
    title: 'Scale difficulty',
    description: 'Preview an easier or harder replacement chart',
    Icon: BarChartIcon,
    accent: 'cyan',
    disabledReason: ({ noteCount }) =>
      noteCount < 1 ? 'Add notes to the chart first' : null,
  },
  {
    value: 'fill-track',
    title: 'Fill track',
    description: 'Add notes on one lane near the playhead',
    Icon: RowsIcon,
    accent: 'emerald',
    disabledReason: ({ noteCount }) =>
      noteCount < 5 ? 'Need at least 5 notes on the chart' : null,
  },
  {
    value: 'improve-pattern',
    title: 'Improve pattern',
    description: 'Extend or refine a selected note pattern',
    Icon: LoopIcon,
    accent: 'amber',
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
  return (
    <div className="space-y-4">
      <p className="ai-assistant-prompt text-sm">
        What would you like AI to do?
      </p>

      <div className="ai-feature-grid grid grid-cols-2 gap-2.5">
        {FEATURES.map((feat) => {
          const disabledReason = feat.disabledReason?.({ noteCount, selectedCount })
          const disabled = disabledReason != null

          const cardButton = (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(feat.value)}
              className={`ai-feature-card w-full ai-feature-card--${feat.accent}${disabled ? ' ai-feature-card--disabled' : ''}`}
            >
              <span className="ai-feature-icon">
                <feat.Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="ai-feature-title">{feat.title}</span>
              <span className="ai-feature-desc">{feat.description}</span>
            </button>
          )

          return (
            <div key={feat.value} className="min-w-0 w-full">
              {disabled && disabledReason ? (
                <Tooltip content={disabledReason} side="top">
                  <span className="block w-full">{cardButton}</span>
                </Tooltip>
              ) : (
                cardButton
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
