import { IsEnum } from 'class-validator'
import type { SongStatus } from '@ama-midi/shared'

const STATUSES = ['DRAFT', 'IN_REVIEW', 'NEEDS_FIX', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] as const

export class UpdateSongStatusDto {
  @IsEnum(STATUSES)
  status!: SongStatus
}
