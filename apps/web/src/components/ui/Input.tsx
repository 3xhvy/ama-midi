import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
} as const

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: keyof typeof sizes
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = 'md', error, icon, ...props }, ref) => (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-shell-muted">{icon}</span>}
      <input
        ref={ref}
        className={cn(
          'w-full border rounded-lg bg-shell-surface text-shell-text placeholder-shell-tertiary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
          error ? 'border-error' : 'border-shell-border',
          icon ? 'pl-9' : '',
          sizes[size],
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
