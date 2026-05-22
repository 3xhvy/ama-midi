import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  ghost:    'text-shell-muted hover:text-shell-text hover:bg-shell-bg',
  outlined: 'text-shell-muted hover:text-shell-text border border-shell-border hover:bg-shell-bg',
} as const

const sizes = {
  sm: 'w-7 h-7 text-sm',
  md: 'w-8 h-8 text-base',
} as const

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  tooltip?: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', tooltip, children, ...props }, ref) => (
    <button
      ref={ref}
      title={tooltip}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
)
IconButton.displayName = 'IconButton'
