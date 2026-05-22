import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { NoteCreatedEvent, NoteDeletedEvent } from '@ama-midi/shared'

@Injectable()
export class LedgerListener {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(NOTE_EVENTS.CREATED)
  async onNoteCreated({ songId, noteId, userId, afterState }: NoteCreatedEvent) {
    await this.prisma.noteEvent.create({
      data: {
        songId,
        noteId,
        eventType: 'NOTE_CREATED',
        userId,
        afterState: afterState as object,
      },
    })
  }

  @OnEvent(NOTE_EVENTS.DELETED)
  async onNoteDeleted({ songId, noteId, userId, beforeState }: NoteDeletedEvent) {
    await this.prisma.noteEvent.create({
      data: {
        songId,
        noteId,
        eventType: 'NOTE_DELETED',
        userId,
        beforeState: beforeState as object,
      },
    })
  }
}
