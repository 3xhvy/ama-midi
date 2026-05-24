import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RealtimeGateway } from './realtime.gateway'
import { PrismaService } from '../prisma/prisma.service'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type {
  NoteCreatedEvent,
  NoteUpdatedEvent,
  NoteDeletedEvent,
  NotesBatchAppliedPayload,
  ActivityActor,
  RealtimeActivityPayload,
} from '@ama-midi/shared'

@Injectable()
export class RealtimeListener {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {}

  private actorCache = new Map<string, ActivityActor>()

  private async resolveActor(userId: string): Promise<ActivityActor> {
    const cached = this.actorCache.get(userId)
    if (cached) return cached
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true },
    })
    const actor = user
      ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
      : { id: userId, name: 'Someone', avatarUrl: null }
    this.actorCache.set(userId, actor)
    return actor
  }

  private async wrap<T>(userId: string, data: T): Promise<RealtimeActivityPayload<T>> {
    return { actor: await this.resolveActor(userId), data }
  }

  @OnEvent(NOTE_EVENTS.CREATED)
  async onNoteCreated(event: NoteCreatedEvent) {
    if (event.realtimeMode === 'batch') return
    this.gateway.broadcastToSong(event.songId, 'note-created', await this.wrap(event.userId, event.afterState))
  }

  @OnEvent(NOTE_EVENTS.UPDATED)
  async onNoteUpdated({ songId, userId, afterState }: NoteUpdatedEvent) {
    this.gateway.broadcastToSong(songId, 'note-updated', await this.wrap(userId, afterState))
  }

  @OnEvent(NOTE_EVENTS.DELETED)
  async onNoteDeleted(event: NoteDeletedEvent) {
    if (event.realtimeMode === 'batch') return
    this.gateway.broadcastToSong(
      event.songId,
      'note-deleted',
      await this.wrap(event.userId, { noteId: event.noteId, beforeState: event.beforeState }),
    )
  }

  @OnEvent(NOTE_EVENTS.BATCH_APPLIED)
  async onNotesBatchApplied(payload: NotesBatchAppliedPayload) {
    this.gateway.broadcastToSong(payload.songId, 'notes-batch-applied', await this.wrap(payload.actorId, payload))
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
