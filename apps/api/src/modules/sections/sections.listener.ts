import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import type { SectionMarker } from '@ama-midi/shared'

@Injectable()
export class SectionsListener {
  constructor(private readonly realtime: RealtimeGateway) {}

  @OnEvent('section.created')
  handleCreated({ songId, section }: { songId: string; section: SectionMarker }) {
    this.realtime.broadcastToSong(songId, 'section-created', section)
  }

  @OnEvent('section.updated')
  handleUpdated({ songId, section }: { songId: string; section: SectionMarker }) {
    this.realtime.broadcastToSong(songId, 'section-updated', section)
  }

  @OnEvent('section.deleted')
  handleDeleted({ songId, id }: { songId: string; id: string }) {
    this.realtime.broadcastToSong(songId, 'section-deleted', { id })
  }
}
