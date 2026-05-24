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

/** Phrases cycled client-side during the blocking AI call, per action. */
const GENERATE_PHRASES: Record<AiStreamAction, Array<{ afterSec: number; text: string }>> = {
  'generate-chart': [
    { afterSec: 0,  text: 'Turning your brief into AI language…' },
    { afterSec: 4,  text: 'AI is reading the song structure…' },
    { afterSec: 9,  text: 'Laying out notes across 8 lanes…' },
    { afterSec: 14, text: 'Shaping the rhythm and density…' },
    { afterSec: 19, text: 'Placing holds and swipes…' },
    { afterSec: 24, text: 'Adding the final touches…' },
    { afterSec: 30, text: 'Still going — this one is detailed…' },
  ],
  'scale-chart': [
    { afterSec: 0,  text: 'Turning your chart into AI language…' },
    { afterSec: 4,  text: 'AI is studying the existing notes…' },
    { afterSec: 9,  text: 'Adjusting density for the target tier…' },
    { afterSec: 14, text: 'Reshaping rhythm patterns…' },
    { afterSec: 19, text: 'Balancing difficulty across sections…' },
    { afterSec: 24, text: 'Polishing the result…' },
    { afterSec: 30, text: 'Almost there — hang tight…' },
  ],
  'suggest-notes': [
    { afterSec: 0,  text: 'Preparing the groove for AI…' },
    { afterSec: 4,  text: 'AI is feeling the rhythm…' },
    { afterSec: 9,  text: 'Finding notes that fit the pattern…' },
    { afterSec: 14, text: 'Almost ready…' },
  ],
}

/** Tracks elapsed seconds since a given timestamp. */
function useElapsed(startTime: number): number {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startTime) / 1000))
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
      ref.current = setTimeout(tick, 1000)
    }
    tick()
    return () => { if (ref.current) clearTimeout(ref.current) }
  }, [startTime])

  return elapsed
}

/** MM:SS badge shown beside the active step label. */
function ElapsedBadge({ startTime }: { startTime: number }) {
  const elapsed = useElapsed(startTime)
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return (
    <span className="ml-auto shrink-0 tabular-nums text-[10px] text-primary/60">
      {m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`}
    </span>
  )
}

/**
 * Rotating phrase row shown below the active generate step.
 * Cycles through client-side phrases until the server signals completion.
 * Once the server returns "AI returned …" we show that instead.
 */
function GeneratePhraseRow({ startTime, action, serverDetail }: {
  startTime: number
  action: AiStreamAction
  serverDetail?: string
}) {
  const elapsed = useElapsed(startTime)
  const phrases = GENERATE_PHRASES[action]

  // Server sends two details: pre-call ("Sending…") and post-call ("AI returned…").
  // Show client phrases during the wait; switch to post-call detail when it arrives.
  const isPostCall = serverDetail?.startsWith('AI returned') || serverDetail?.startsWith('Asking AI')
  const clientPhrase = [...phrases].reverse().find((p) => elapsed >= p.afterSec)?.text ?? phrases[0]!.text
  const text = (serverDetail && !isPostCall) ? serverDetail : clientPhrase

  return (
    <p className="ml-8 mt-0.5 text-[11px] leading-snug text-primary/50 transition-opacity duration-500" key={text}>
      {text}
    </p>
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
        const serverDetail = details[def.stepId]
        const startTime = stepStartTimes[def.stepId]
        const isActive = status === 'active'
        const isGenerateStep = def.stepId === 'generate'

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
              {isActive && startTime != null && <ElapsedBadge startTime={startTime} />}
            </div>

            {/* Generate step: rotating client phrases (feel alive during long LLM wait) */}
            {isActive && startTime != null && isGenerateStep && (
              <GeneratePhraseRow
                startTime={startTime}
                action={action}
                serverDetail={serverDetail}
              />
            )}

            {/* Other steps: show server detail when available */}
            {isActive && !isGenerateStep && serverDetail && (
              <p className="ml-8 mt-0.5 text-[11px] leading-snug text-primary/50" key={serverDetail}>
                {serverDetail}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
