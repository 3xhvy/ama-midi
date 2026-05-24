import { LockClosedIcon } from '@radix-ui/react-icons'

export function ReadOnlyBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="-mx-4 flex w-auto items-center gap-2 border-t border-amber-500/15 bg-amber-500/[0.08] px-4 py-1.5 text-[11px] leading-snug text-amber-100/90"
    >
      <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden />
      <span className="min-w-0 truncate sm:whitespace-normal">{message}</span>
    </div>
  )
}
