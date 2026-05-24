import type { CommandType } from '@ama-midi/shared'

export interface RecordCommandInput {
  songId: string
  chartId?: string | null
  commandType: CommandType
  userId: string
  summary: Record<string, unknown>
  undoable?: boolean
  isCompensation?: boolean
}

export interface UndoResolution {
  conflictId: string
  action: 'KEEP_EXISTING' | 'REPLACE_WITH_UNDO'
}
