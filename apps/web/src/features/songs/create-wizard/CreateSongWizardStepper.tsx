import { CheckIcon } from '@radix-ui/react-icons'
import { cn } from '../../../lib/utils'
import { WIZARD_STEPS, type WizardStep } from './wizard-logic'

export function CreateSongWizardStepper({
  current,
  onStepClick,
}: {
  current: WizardStep
  onStepClick: (step: WizardStep) => void
}) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === current)

  return (
    <nav aria-label="Wizard progress" className="mb-5 flex items-center gap-1">
      {WIZARD_STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = step.id === current
        const clickable = done

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(step.id)}
              className={cn(
                'flex min-w-0 items-center gap-1.5 text-xs font-medium transition-colors',
                active && 'text-primary',
                done && 'text-shell-text cursor-pointer hover:text-primary',
                !active && !done && 'text-shell-muted cursor-default',
              )}
            >
              <span className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                active && 'border-primary bg-primary text-white',
                done && 'border-primary bg-primary/10 text-primary',
                !active && !done && 'border-shell-border text-shell-muted',
              )}>
                {done ? <CheckIcon className="h-3 w-3" /> : index + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </button>
            {index < WIZARD_STEPS.length - 1 && (
              <div className={cn('h-px flex-1', done ? 'bg-primary/40' : 'bg-shell-border')} />
            )}
          </div>
        )
      })}
    </nav>
  )
}
