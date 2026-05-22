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
      <Dialog.Overlay className="fixed inset-0 bg-[rgba(26,22,53,0.6)] z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[400px] bg-shell-surface rounded-xl shadow-lg p-0 focus:outline-none',
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
    <div className={cn('flex items-center justify-between px-6 py-4 border-b border-shell-border', className)}>
      <Dialog.Title className="font-semibold text-shell-text text-sm">{children}</Dialog.Title>
      {onClose && (
        <Dialog.Close asChild>
          <button className="text-shell-muted hover:text-shell-text text-xl leading-none" onClick={onClose}>×</button>
        </Dialog.Close>
      )}
    </div>
  )
}

function Body({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

function Footer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-2 px-6 py-4 border-t border-shell-border', className)}>
      {children}
    </div>
  )
}

export const Modal = { Root, Trigger, Content, Header, Body, Footer, Close: Dialog.Close }
