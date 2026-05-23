import { ChevronLeftIcon } from '@radix-ui/react-icons'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

export function BackNavLink({
  to,
  label,
  className,
}: {
  to: string
  label: string
  className?: string
}) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className={cn(
        'inline-flex items-center gap-1 rounded-md text-sm text-shell-muted transition-colors',
        'hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        className,
      )}
    >
      <ChevronLeftIcon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </button>
  )
}
