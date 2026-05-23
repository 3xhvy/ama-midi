import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RealtimeGateway } from './realtime.gateway'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type {
  NoteCreatedEvent,
  NoteUpdatedEvent,
  NoteDeletedEvent,
  NotesBatchAppliedPayload,
} from '@ama-midi/shared'

@Injectable()
export class RealtimeListener {
  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(NOTE_EVENTS.CREATED)
  onNoteCreated(event: NoteCreatedEvent) {
    if (event.realtimeMode === 'batch') return
    this.gateway.broadcastToSong(event.songId, 'note-created', event.afterState)
  }

  @OnEvent(NOTE_EVENTS.UPDATED)
  onNoteUpdated({ songId, afterState }: NoteUpdatedEvent) {
    this.gateway.broadcastToSong(songId, 'note-updated', afterState)
  }

  @OnEvent(NOTE_EVENTS.DELETED)
  onNoteDeleted(event: NoteDeletedEvent) {
    if (event.realtimeMode === 'batch') return
    this.gateway.broadcastToSong(event.songId, 'note-deleted', { noteId: event.noteId })
  }

  @OnEvent(NOTE_EVENTS.BATCH_APPLIED)
  onNotesBatchApplied(payload: NotesBatchAppliedPayload) {
    this.gateway.broadcastToSong(payload.songId, 'notes-batch-applied', payload)
  }

  @OnEvent('project.member.updated')
  handleProjectMemberUpdated(payload: { projectId: string; memberId: string }) {
    this.gateway.server.to(`project:${payload.projectId}`).emit('project.member.updated', payload)
  }

  @OnEvent('project.member.removed')
  handleProjectMemberRemoved(payload: { projectId: string; memberId: string }) {
    this.gateway.server.to(`project:${payload.projectId}`).emit('project.member.removed', payload)
  }
}
