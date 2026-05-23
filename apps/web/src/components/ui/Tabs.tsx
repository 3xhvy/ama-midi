import * as RadixTabs from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

function Root({ children, ...props }: RadixTabs.TabsProps) {
  return <RadixTabs.Root {...props}>{children}</RadixTabs.Root>
}

function List({ children, className, ...props }: RadixTabs.TabsListProps) {
  return (
    <RadixTabs.List className={cn('flex border-b border-shell-border shrink-0', className)} {...props}>
      {children}
    </RadixTabs.List>
  )
}

function Trigger({ children, className, ...props }: RadixTabs.TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'flex-1 py-2.5 text-xs font-medium capitalize transition-colors text-shell-muted hover:text-shell-text data-[state=active]:text-shell-text data-[state=active]:border-b-2 data-[state=active]:border-primary',
        className,
      )}
      {...props}
    >
      {children}
    </RadixTabs.Trigger>
  )
}

function Content({ children, className, ...props }: RadixTabs.TabsContentProps) {
  return (
    <RadixTabs.Content className={cn('flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden', className)} {...props}>
      {children}
    </RadixTabs.Content>
  )
}

export const Tabs = { Root, List, Trigger, Content }
