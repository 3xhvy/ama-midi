import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import type { SectionMarker } from '@ama-midi/shared'

@Injectable()
export class SectionsListener {
  constructor(private readonly realtime: RealtimeGateway) {}

  @OnEvent('section.created')
  handleCreated(payload: { songId: string; userId: string; section: SectionMarker }) {
    this.realtime.broadcastToSong(payload.songId, 'section-created', payload.section)
  }

  @OnEvent('section.updated')
  handleUpdated(payload: { songId: string; userId: string; beforeState: SectionMarker; section: SectionMarker }) {
    this.realtime.broadcastToSong(payload.songId, 'section-updated', payload.section)
  }

  @OnEvent('section.deleted')
  handleDeleted(payload: { songId: string; userId: string; beforeState: SectionMarker; id: string }) {
    this.realtime.broadcastToSong(payload.songId, 'section-deleted', { id: payload.id, beforeState: payload.beforeState })
  }
}
