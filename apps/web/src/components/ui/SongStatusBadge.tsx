import { SONG_STATUS_LABELS } from '@ama-midi/shared'
import type { SongStatus } from '@ama-midi/shared'
import { Badge } from './Badge'

const variants: Record<SongStatus, 'muted' | 'warning' | 'error' | 'success'> = {
  DRAFT: 'muted',
  IN_REVIEW: 'warning',
  NEEDS_FIX: 'error',
  APPROVED: 'success',
  PUBLISHED: 'success',
  ARCHIVED: 'muted',
}

export function SongStatusBadge({ status, className }: { status: SongStatus; className?: string }) {
  return (
    <Badge variant={variants[status]} size="sm" className={className}>
      {SONG_STATUS_LABELS[status]}
    </Badge>
  )
}
