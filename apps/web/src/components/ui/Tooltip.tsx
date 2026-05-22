import * as RadixTooltip from '@radix-ui/react-tooltip'
import { cn } from '../../lib/utils'

export interface TooltipProps {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={4}
            className={cn(
              'z-50 px-3 py-1.5 text-xs bg-shell-surface text-shell-text border border-shell-border rounded-lg shadow-md animate-in fade-in-0 zoom-in-95',
              className,
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-shell-border" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
