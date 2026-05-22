import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RealtimeGateway } from './realtime.gateway'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { NoteCreatedEvent, NoteUpdatedEvent, NoteDeletedEvent } from '@ama-midi/shared'

@Injectable()
export class RealtimeListener {
  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(NOTE_EVENTS.CREATED)
  onNoteCreated({ songId, afterState }: NoteCreatedEvent) {
    this.gateway.broadcastToSong(songId, 'note-created', afterState)
  }

  @OnEvent(NOTE_EVENTS.UPDATED)
  onNoteUpdated({ songId, afterState }: NoteUpdatedEvent) {
    this.gateway.broadcastToSong(songId, 'note-updated', afterState)
  }

  @OnEvent(NOTE_EVENTS.DELETED)
  onNoteDeleted({ songId, noteId }: NoteDeletedEvent) {
    this.gateway.broadcastToSong(songId, 'note-deleted', { noteId })
  }
}
