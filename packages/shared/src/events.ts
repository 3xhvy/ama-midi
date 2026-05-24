import type { Note } from './types'

export const NOTE_EVENTS = {
  CREATED: 'note.created',
  UPDATED: 'note.updated',
  DELETED: 'note.deleted',
  BATCH_APPLIED: 'notes.batch-applied',
} as const

export const CHART_EVENTS = {
  ANALYSIS_UPDATED: 'chart.analysis.updated',
} as const

export interface ChartAnalysisUpdatedEvent {
  songId: string
  chartId: string
}

export const PROJECT_MEMBER_UPDATED = 'project.member.updated'
export const PROJECT_MEMBER_REMOVED = 'project.member.removed'
export const PROJECT_SONG_ACCESS_UPDATED = 'project.song.access.updated'

export interface NoteCreatedEvent {
  songId: string
  noteId: string
  userId: string
  afterState: Note
  batchId?: string
  replacesNoteId?: string
  realtimeMode?: 'single' | 'batch'
  commandId?: string
  /** When set, realtime skips a DB lookup for the actor profile. */
  actor?: ActivityActor
}

export interface NoteUpdatedEvent {
  songId: string
  noteId: string
  userId: string
  beforeState: Partial<Note>
  afterState: Note
  commandId?: string
  actor?: ActivityActor
}

export interface NoteDeletedEvent {
  songId: string
  noteId: string
  userId: string
  beforeState: Partial<Note>
  batchId?: string
  replacedByBatch?: boolean
  realtimeMode?: 'single' | 'batch'
  commandId?: string
  actor?: ActivityActor
}

export interface NotesBatchAppliedPayload {
  songId: string
  batchId: string
  created: Note[]
  deletedIds: string[]
  actorId: string
}

export type EditorEntityType = 'NOTE' | 'SECTION' | 'CHART'

export type EditorEventType =
  | 'NOTE_CREATED'
  | 'NOTE_UPDATED'
  | 'NOTE_DELETED'
  | 'SECTION_CREATED'
  | 'SECTION_UPDATED'
  | 'SECTION_DELETED'
  | 'CHART_SWITCHED'

export interface ActivityActor {
  id: string
  name: string
  avatarUrl?: string | null
}

export interface RealtimeActivityPayload<T> {
  actor: ActivityActor
  data: T
}

export interface EditorEventRow {
  id: string
  songId: string
  chartId?: string | null
  entityType: EditorEntityType
  entityId?: string | null
  eventType: EditorEventType
  userId: string
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  batchId?: string | null
  undoable: boolean
  undoneByEventId?: string | null
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string | null }
}

export type CommandType =
  | 'SINGLE_NOTE_CREATED'
  | 'SINGLE_NOTE_UPDATED'
  | 'SINGLE_NOTE_DELETED'
  | 'PATTERN_PASTED'
  | 'NOTES_REPEATED'
  | 'NOTES_MOVED'
  | 'SECTION_CREATED'
  | 'SECTION_UPDATED'
  | 'SECTION_DELETED'
  | 'AI_NOTES_APPLIED'
  | 'CHART_SWITCHED'
  | 'UNDO'

export interface EditorCommandRow {
  id: string
  songId: string
  chartId?: string | null
  commandType: CommandType
  userId: string
  summary: Record<string, unknown>
  undoable: boolean
  undoneByCommandId?: string | null
  isCompensation: boolean
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string | null }
}

export interface UndoConflictNote {
  id: string
  track: number
  time: number
  title: string
  noteType: string
  duration?: number
  createdBy: string
  creatorName: string
}

export interface UndoConflict {
  conflictId: string
  track: number
  time: number
  incomingNote: UndoConflictNote
  existingNote: UndoConflictNote
}

export interface UndoPreview {
  commandId: string
  commandType: CommandType
  summary: Record<string, unknown>
  conflicts: UndoConflict[]
}
