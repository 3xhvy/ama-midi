import { SYNC_STATUS_COLORS } from '@ama-midi/shared'
import { Badge } from './Badge'

type Status = keyof typeof SYNC_STATUS_COLORS

const icons: Record<Status, string> = {
  synced: '✓',
  needsReview: '!',
  outdated: '×',
  draft: '○',
}

const badgeVariants: Record<Status, 'success' | 'warning' | 'error' | 'muted'> = {
  synced: 'success',
  needsReview: 'warning',
  outdated: 'error',
  draft: 'muted',
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge variant={badgeVariants[status]} size="sm" icon={<span>{icons[status]}</span>} className={className}>
      {SYNC_STATUS_COLORS[status].label}
    </Badge>
  )
}
