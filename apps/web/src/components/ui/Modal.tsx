import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'

function Root({ children, ...props }: Dialog.DialogProps) {
  return <Dialog.Root {...props}>{children}</Dialog.Root>
}

function Trigger({ children, ...props }: Dialog.DialogTriggerProps) {
  return <Dialog.Trigger asChild {...props}>{children}</Dialog.Trigger>
}

function Content({ children, className, ...props }: Dialog.DialogContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        style={{ backgroundColor: 'var(--modal-overlay)' }}
      />
      <Dialog.Content
        className={cn(
          'app-modal fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[400px] rounded-2xl p-0 focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  )
}

function Header({ children, className, onClose }: { children: React.ReactNode; className?: string; onClose?: () => void }) {
  return (
    <div
      className={cn('flex items-center justify-between border-b px-6 py-4', className)}
      style={{ borderColor: 'var(--modal-border)' }}
    >
      <Dialog.Title className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
        {children}
      </Dialog.Title>
      {onClose && (
        <Dialog.Close asChild>
          <button
            type="button"
            className="text-xl leading-none transition-colors hover:opacity-80"
            style={{ color: 'var(--modal-muted)' }}
            onClick={onClose}
          >
            ×
          </button>
        </Dialog.Close>
      )}
    </div>
  )
}

function Body({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('modal-body px-6 py-4', className)}>{children}</div>
}

function Footer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t px-6 py-4', className)}
      style={{ borderColor: 'var(--modal-border)' }}
    >
      {children}
    </div>
  )
}

export const Modal = { Root, Trigger, Content, Header, Body, Footer, Close: Dialog.Close }
