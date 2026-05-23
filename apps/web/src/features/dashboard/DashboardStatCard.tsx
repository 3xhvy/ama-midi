import { cn } from '../../lib/utils'

const accents = {
  amber: {
    ring: 'ring-amber-500/20',
    bg: 'bg-gradient-to-br from-amber-500/10 via-shell-surface to-shell-surface',
    dot: 'bg-amber-500',
    value: 'text-amber-700 dark:text-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  blue: {
    ring: 'ring-blue-500/20',
    bg: 'bg-gradient-to-br from-blue-500/10 via-shell-surface to-shell-surface',
    dot: 'bg-blue-500',
    value: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-600 dark:text-blue-300',
  },
  purple: {
    ring: 'ring-primary/25',
    bg: 'bg-gradient-to-br from-primary/10 via-shell-surface to-shell-surface',
    dot: 'bg-primary',
    value: 'text-primary',
    icon: 'text-primary',
  },
  green: {
    ring: 'ring-emerald-500/20',
    bg: 'bg-gradient-to-br from-emerald-500/10 via-shell-surface to-shell-surface',
    dot: 'bg-emerald-500',
    value: 'text-emerald-700 dark:text-emerald-400',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
} as const

export function DashboardStatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string
  value: number
  accent: keyof typeof accents
  icon: React.ReactNode
}) {
  const tone = accents[accent]

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-shell-border px-3 py-2.5 ring-1',
        tone.ring,
        tone.bg,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-shell-muted">{label}</p>
          <p className={cn('mt-1 text-2xl font-semibold tabular-nums', tone.value)}>{value}</p>
        </div>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-md bg-shell-surface/80 text-base', tone.icon)}>
          {icon}
        </span>
      </div>
      <span className={cn('absolute bottom-0 left-0 top-0 w-1', tone.dot)} aria-hidden />
    </div>
  )
}
