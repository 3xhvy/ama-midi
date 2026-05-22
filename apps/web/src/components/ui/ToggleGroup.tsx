import * as RadixToggleGroup from '@radix-ui/react-toggle-group'
import { cn } from '../../lib/utils'

export interface ToggleGroupProps {
  items: { value: string; label: string }[]
  value: string
  onValueChange: (value: string) => void
  variant?: 'default' | 'canvas'
  className?: string
}

export function ToggleGroup({ items, value, onValueChange, variant = 'default', className }: ToggleGroupProps) {
  const bgClass      = variant === 'canvas' ? 'bg-canvas-bg border-canvas-border' : 'bg-shell-bg border-shell-border'
  const itemInactive = variant === 'canvas' ? 'text-canvas-muted hover:text-canvas-text' : 'text-shell-muted hover:text-shell-text'

  return (
    <RadixToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className={cn('flex rounded-md overflow-hidden border', bgClass, className)}
    >
      {items.map((item) => (
        <RadixToggleGroup.Item
          key={item.value}
          value={item.value}
          className={cn(
            'px-3 py-1 text-xs font-medium transition-colors',
            value === item.value ? 'bg-primary text-white' : itemInactive,
          )}
        >
          {item.label}
        </RadixToggleGroup.Item>
      ))}
    </RadixToggleGroup.Root>
  )
}
