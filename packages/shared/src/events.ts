import type { Note } from './types'

export const NOTE_EVENTS = {
  CREATED: 'note.created',
  UPDATED: 'note.updated',
  DELETED: 'note.deleted',
  BATCH_APPLIED: 'notes.batch-applied',
} as const

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
}

export interface NoteUpdatedEvent {
  songId: string
  noteId: string
  userId: string
  beforeState: Partial<Note>
  afterState: Note
}

export interface NoteDeletedEvent {
  songId: string
  noteId: string
  userId: string
  beforeState: Partial<Note>
  batchId?: string
  replacedByBatch?: boolean
  realtimeMode?: 'single' | 'batch'
}

export interface NotesBatchAppliedPayload {
  songId: string
  batchId: string
  created: Note[]
  deletedIds: string[]
  actorId: string
}
