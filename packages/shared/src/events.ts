import type { Note } from './types'

export const NOTE_EVENTS = {
  CREATED: 'note.created',
  UPDATED: 'note.updated',
  DELETED: 'note.deleted',
} as const

export interface NoteCreatedEvent {
  songId: string
  noteId: string
  userId: string
  afterState: Note
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
}
