import * as RadixToggleGroup from '@radix-ui/react-toggle-group'
import { cn } from '../../lib/utils'

export interface ToggleGroupProps {
  items: { value: string; label: string }[]
  value: string
  onValueChange: (value: string) => void
  variant?: 'default' | 'canvas' | 'editor'
  className?: string
}

export function ToggleGroup({ items, value, onValueChange, variant = 'default', className }: ToggleGroupProps) {
  const bgClass      = variant === 'canvas'
    ? 'bg-canvas-bg border-canvas-border'
    : variant === 'editor'
      ? 'bg-transparent'
      : 'bg-shell-bg border-shell-border'

  const itemInactive = variant === 'canvas'
    ? 'text-canvas-muted hover:text-canvas-text'
    : variant === 'editor'
      ? ''
      : 'text-shell-muted hover:text-shell-text'

  return (
    <RadixToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v)}
      className={cn('flex rounded-md overflow-hidden border', bgClass, className)}
      style={variant === 'editor' ? { borderColor: 'var(--color-editor-btn-border)' } : undefined}
    >
      {items.map((item) => (
        <RadixToggleGroup.Item
          key={item.value}
          value={item.value}
          className={cn(
            'flex-1 py-1 text-xs font-medium transition-colors text-center',
            value === item.value ? 'bg-primary text-white' : itemInactive,
          )}
          style={variant === 'editor' && value !== item.value
            ? { color: 'var(--color-editor-btn-inactive)' }
            : undefined}
        >
          {item.label}
        </RadixToggleGroup.Item>
      ))}
    </RadixToggleGroup.Root>
  )
}
