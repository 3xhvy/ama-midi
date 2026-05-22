import { cn } from '../../lib/utils'

export interface ColorPickerProps {
  colors: readonly string[]
  value: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ colors, value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'w-6 h-6 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            value === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105',
          )}
          style={{ backgroundColor: color }}
          aria-label={`Color ${color}`}
        />
      ))}
    </div>
  )
}
