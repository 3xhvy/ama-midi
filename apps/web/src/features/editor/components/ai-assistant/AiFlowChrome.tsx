import { cn } from '../../../../lib/utils'
import { Button, Textarea } from '../../../../components/ui'

export function AiFlowIntro({ children }: { children: React.ReactNode }) {
  return <p className="ai-flow-intro text-xs leading-relaxed">{children}</p>
}

export function AiFlowHighlight({ children }: { children: React.ReactNode }) {
  return <span className="ai-flow-highlight font-medium">{children}</span>
}

export function AiFlowLabel({
  children,
  hint,
}: {
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="ai-flow-label mb-1.5 block text-xs">
      {children}
      {hint ? <span className="ai-flow-label-hint ml-1">{hint}</span> : null}
    </label>
  )
}

export function AiFlowSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'ai-flow-input w-full rounded-lg border px-3 py-2 text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function AiFlowTextarea({
  className,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      className={cn('ai-flow-input !border !bg-transparent', className)}
      {...props}
    />
  )
}

export function AiFlowCheckbox({
  checked,
  onChange,
  disabled,
  title,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  title: React.ReactNode
  description?: React.ReactNode
}) {
  return (
    <label className="ai-flow-checkbox flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="ai-flow-checkbox-input mt-0.5"
      />
      <span className="min-w-0">
        <span className="ai-flow-checkbox-title block">{title}</span>
        {description ? (
          <span className="ai-flow-checkbox-desc mt-0.5 block text-[10px] leading-snug">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export function AiFlowCallout({
  variant = 'amber',
  children,
}: {
  variant?: 'amber' | 'violet'
  children: React.ReactNode
}) {
  return (
    <p className={cn('ai-flow-callout text-xs leading-relaxed', `ai-flow-callout--${variant}`)}>
      {children}
    </p>
  )
}

export function AiFlowFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="ai-flow-footer mt-4 flex justify-end gap-2 border-t pt-4">{children}</div>
  )
}

export function AiFlowPrimaryButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="primary" size="sm" className="ai-flow-primary" {...props}>
      {children}
    </Button>
  )
}

export function AiFlowGhostButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="sm" className="ai-flow-ghost" {...props}>
      {children}
    </Button>
  )
}
