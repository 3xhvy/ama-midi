import type { EditorEntityType, EditorEventType } from '@ama-midi/shared'

export interface RecordEditorEventInput {
  songId: string
  chartId?: string | null
  entityType: EditorEntityType
  entityId?: string | null
  eventType: EditorEventType
  userId: string
  beforeState?: object | null
  afterState?: object | null
  batchId?: string | null
  replacesEventId?: string | null
  undoneByEventId?: string | null
  undoable: boolean
}
