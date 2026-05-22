import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  primary:   'bg-primary text-white hover:bg-primary-dark',
  secondary: 'bg-shell-surface text-shell-text border border-shell-border hover:bg-shell-bg',
  ghost:     'text-shell-muted hover:text-shell-text hover:bg-shell-bg',
  danger:    'bg-error/10 text-error hover:bg-error/20 border border-error/30',
} as const

const sizes = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
} as const

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  rounded?: boolean
  loading?: boolean
  icon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', rounded, loading, icon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        rounded ? 'rounded-full' : 'rounded-md',
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
