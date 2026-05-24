import { cn } from '../../../lib/utils'
import { Modal } from '../../../components/ui'

export function EditorModalContent({
  className,
  ...props
}: React.ComponentProps<typeof Modal.Content>) {
  return <Modal.Content className={cn('editor-modal', className)} {...props} />
}

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'default' | 'wide' | 'undo-wide'
}

/** Standalone panel for custom overlay layouts (conflict review, save pattern). */
export function EditorModalPanel({ className, size = 'default', ...props }: PanelProps) {
  return (
    <div
      className={cn(
        'editor-modal flex flex-col overflow-hidden rounded-2xl',
        size === 'wide' && 'editor-modal--wide',
        size === 'undo-wide' && 'editor-modal--undo-wide',
        className,
      )}
      {...props}
    />
  )
}

export function EditorModalOverlay({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center', className)}
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      {...props}
    />
  )
}

export function EditorModalCompact({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('editor-modal modal-body w-80 max-w-full rounded-xl p-6', className)}
      {...props}
    />
  )
}
