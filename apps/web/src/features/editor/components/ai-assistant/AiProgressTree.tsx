import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { AI_STREAM_STEPS, type AiStreamAction } from '@ama-midi/shared'
import { cn } from '../../../../lib/utils'
import type { ProgressStepState } from './ai-assistant.types'

interface Props {
  action: AiStreamAction
  steps: Record<string, ProgressStepState>
  details: Record<string, string>
  stepStartTimes: Record<string, number>
}

/** Live elapsed counter for an active step. Renders MM:SS. */
function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0)
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
      rafRef.current = setTimeout(tick, 1000)
    }
    tick()
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current)
    }
  }, [startTime])

  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return (
    <span className="ml-auto shrink-0 tabular-nums text-[10px] text-primary/60">
      {m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`}
    </span>
  )
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

export function AiProgressTree({ action, steps, details, stepStartTimes }: Props) {
  const defs = AI_STREAM_STEPS[action]

  return (
    <ul className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3">
      {defs.map((def, index) => {
        const status = steps[def.stepId] ?? 'pending'
        const detail = details[def.stepId]
        const startTime = stepStartTimes[def.stepId]
        const isActive = status === 'active'

        return (
          <li
            key={def.stepId}
            className={cn(
              'flex flex-col gap-0.5 rounded-md px-2 py-1.5 transition-all duration-300',
              isActive && 'bg-primary/[0.07]',
            )}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-center gap-3">
              <StepIcon status={status} />
              <span
                className={cn(
                  'text-sm transition-all duration-200',
                  isActive && 'ai-progress-label--active font-semibold text-primary',
                  status === 'done' && 'ai-progress-label--done text-shell-text',
                  status === 'error' && 'font-medium text-red-400',
                  status === 'pending' && 'text-shell-muted dark:text-[var(--ai-text-muted)]',
                )}
              >
                {def.label}
              </span>
              {isActive && startTime && <ElapsedTimer startTime={startTime} />}
            </div>
            {isActive && detail && (
              <p
                className="ml-8 text-[11px] leading-snug text-primary/50 transition-all duration-300"
                key={detail}
              >
                {detail}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
