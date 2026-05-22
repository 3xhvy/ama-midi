import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <div>
      <textarea
        ref={ref}
        className={cn(
          'w-full px-3 py-2 text-sm border rounded-lg bg-shell-surface text-shell-text placeholder-shell-tertiary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none',
          error ? 'border-error' : 'border-shell-border',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  ),
)
Textarea.displayName = 'Textarea'
