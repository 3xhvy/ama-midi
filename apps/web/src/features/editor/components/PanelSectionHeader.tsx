import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Tooltip } from '../../../components/ui'
import { cn } from '../../../lib/utils'

interface Props {
  title: string
  help?: string
  className?: string
}

export function PanelSectionHeader({ title, help, className }: Props) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="text-xs font-medium text-shell-text uppercase tracking-wide">
        {title}
      </span>
      {help ? (
        <Tooltip content={help} side="right" className="max-w-[13rem] leading-snug text-[11px]">
          <button
            type="button"
            aria-label={`About ${title}`}
            className="inline-flex rounded-sm text-shell-muted hover:text-shell-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <QuestionMarkCircledIcon className="h-3.5 w-3.5 shrink-0" />
          </button>
        </Tooltip>
      ) : null}
    </div>
  )
}
