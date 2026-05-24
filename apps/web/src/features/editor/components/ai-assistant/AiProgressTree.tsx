import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { AI_STREAM_STEPS, type AiStreamAction } from '@ama-midi/shared'
import { cn } from '../../../../lib/utils'
import type { ProgressStepState } from './ai-assistant.types'

interface Props {
  action: AiStreamAction
  steps: Record<string, ProgressStepState>
}

function StepIcon({ status }: { status: ProgressStepState }) {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CheckIcon className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <Cross2Icon className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </span>
    )
  }
  return <span className="h-5 w-5 shrink-0 rounded-full border border-shell-border" />
}

export function AiProgressTree({ action, steps }: Props) {
  const defs = AI_STREAM_STEPS[action]

  return (
    <ul className="space-y-3">
      {defs.map((def) => {
        const status = steps[def.stepId] ?? 'pending'
        return (
          <li key={def.stepId} className="flex items-center gap-3">
            <StepIcon status={status} />
            <span
              className={cn(
                'text-sm',
                status === 'active' && 'font-medium text-primary',
                status === 'done' && 'text-shell-text',
                status === 'error' && 'text-red-400',
                status === 'pending' && 'text-shell-muted',
              )}
            >
              {def.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
