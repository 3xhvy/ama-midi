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
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/25 text-[var(--ai-accent-bright,#a5a0ff)] ring-1 ring-primary/40">
        <CheckIcon className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 ring-1 ring-red-500/40">
        <Cross2Icon className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="ai-progress-step--active flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/50">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--ai-accent-bright,#b4afff)] border-t-transparent" />
      </span>
    )
  }
  return (
    <span className="h-5 w-5 shrink-0 rounded-full border border-white/15 bg-white/[0.03]" />
  )
}

export function AiProgressTree({ action, steps }: Props) {
  const defs = AI_STREAM_STEPS[action]

  return (
    <ul className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
      {defs.map((def) => {
        const status = steps[def.stepId] ?? 'pending'
        return (
          <li key={def.stepId} className="flex items-center gap-3">
            <StepIcon status={status} />
            <span
              className={cn(
                'text-sm',
                status === 'active' && 'ai-progress-label--active font-semibold text-primary',
                status === 'done' && 'ai-progress-label--done text-shell-text',
                status === 'error' && 'font-medium text-red-400',
                status === 'pending' && 'text-shell-muted dark:text-[var(--ai-text-muted)]',
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
