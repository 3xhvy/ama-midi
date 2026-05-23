import { SongStatusEnum, type SongStatus } from '@ama-midi/shared'
import { Badge } from './Badge'

export function SongStatusBadge({ status, className }: { status: SongStatus; className?: string }) {
  return (
    <Badge variant={SongStatusEnum.variant(status)} size="sm" className={className}>
      {SongStatusEnum.label(status)}
    </Badge>
  )
}
