import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  default: 'bg-shell-bg text-shell-text border border-shell-border',
  success: 'bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  error:   'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  info:    'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  muted:   'bg-shell-bg text-shell-muted dark:bg-shell-border/40 dark:text-shell-text',
} as const

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm font-semibold',
} as const

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  icon?: React.ReactNode
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  ),
)
Badge.displayName = 'Badge'
