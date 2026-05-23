import * as RadixTabs from '@radix-ui/react-tabs'
import { createContext, useContext } from 'react'
import { cn } from '../../lib/utils'

type TabsVariant = 'default' | 'management' | 'editor'

const TabsVariantContext = createContext<TabsVariant>('default')

function Root({ children, ...props }: RadixTabs.TabsProps) {
  return <RadixTabs.Root {...props}>{children}</RadixTabs.Root>
}

interface ListProps extends RadixTabs.TabsListProps {
  variant?: TabsVariant
}

function List({ children, className, variant = 'default', ...props }: ListProps) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <RadixTabs.List
        className={cn(
          'flex shrink-0 border-b border-shell-border',
          variant === 'management' ? 'gap-6' : '',
          className,
        )}
        {...props}
      >
        {children}
      </RadixTabs.List>
    </TabsVariantContext.Provider>
  )
}

interface TriggerProps extends RadixTabs.TabsTriggerProps {
  variant?: TabsVariant
}

function Trigger({ children, className, variant: variantProp, ...props }: TriggerProps) {
  const contextVariant = useContext(TabsVariantContext)
  const variant = variantProp ?? contextVariant

  return (
    <RadixTabs.Trigger
      className={cn(
        'transition-colors',
        variant === 'management'
          ? cn(
              'shrink-0 px-0 pb-2.5 -mb-px text-sm font-medium',
              'text-shell-muted hover:text-shell-text',
              'data-[state=active]:border-b-2 data-[state=active]:border-primary',
              'data-[state=active]:font-semibold data-[state=active]:text-primary',
            )
          : cn(
              'flex-1 py-2.5 text-xs font-medium capitalize',
              'data-[state=active]:border-b-2 data-[state=active]:border-primary',
              'text-shell-muted hover:text-shell-text data-[state=active]:text-shell-text',
            ),
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
