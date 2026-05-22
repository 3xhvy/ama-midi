import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { AuthUser, Note, NoteCreatedEvent, NoteDeletedEvent, NoteUpdatedEvent } from '@ama-midi/shared'
import { UpdateNoteDto } from './dto/update-note.dto'

function snapTime(time: number): number {
  return Math.round(time * 10) / 10
}

function toNote(n: {
  id: string; songId: string; track: number; time: number
  title: string; description: string; color: string; createdBy: string
  noteType?: string; duration?: number | null
  createdAt: Date; updatedAt: Date
  creator?: { name: string }
}): Note {
  return {
    id: n.id,
    songId: n.songId,
    track: n.track,
    time: n.time,
    title: n.title,
    description: n.description,
    color: n.color,
    createdBy: n.createdBy,
    creatorName: n.creator?.name ?? '',
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    noteType: (n.noteType as Note['noteType']) ?? 'TAP',
    duration: n.duration ?? undefined,
  }
}

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    songId: string,
    body: { track: number; time: number; title: string; description?: string; color?: string; noteType?: string; duration?: number },
    user: AuthUser,
  ): Promise<Note> {
    const time = snapTime(body.time)

    if (body.noteType === 'HOLD' && (body.duration == null || body.duration <= 0)) {
      throw new BadRequestException('HOLD notes require duration > 0')
    }

    try {
      const n = await this.prisma.note.create({
        data: {
          songId,
          track: body.track,
          time,
          title: body.title,
          description: body.description ?? '',
          color: body.color ?? '#6C63FF',
          noteType: (body.noteType as any) ?? 'TAP',
          duration: body.duration ?? null,
          createdBy: user.id,
        },
        include: { creator: { select: { name: true } } },
      })

      const note = toNote(n)
      this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
        songId,
        noteId: note.id,
        userId: user.id,
        afterState: note,
      } satisfies NoteCreatedEvent)

      return note
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e) {
        const code = (e as { code: string }).code
        if (code === 'P2002') throw new ConflictException({ error: 'POSITION_TAKEN' })
        if (code === 'P2003') throw new BadRequestException('Song not found')
      }
      throw e
    }
  }

  async softDelete(songId: string, noteId: string, user: AuthUser): Promise<void> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, songId, deletedAt: null },
      include: { creator: { select: { name: true } } },
    })
    if (!note) throw new NotFoundException('Note not found')
    if (note.createdBy !== user.id && user.role !== 'ADMIN') throw new ForbiddenException()

    await this.prisma.note.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    })

    this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
      songId,
      noteId,
      userId: user.id,
      beforeState: toNote(note),
    } satisfies NoteDeletedEvent)
  }

  async undo(songId: string, user: AuthUser): Promise<{ noteId: string }> {
    const lastEvent = await this.prisma.noteEvent.findFirst({
      where: { songId, userId: user.id, eventType: 'NOTE_CREATED' },
      orderBy: { createdAt: 'desc' },
    })
    if (!lastEvent || !lastEvent.noteId) throw new NotFoundException('Nothing to undo')

    const note = await this.prisma.note.findFirst({
      where: { id: lastEvent.noteId, songId, deletedAt: null },
      include: { creator: { select: { name: true } } },
    })
    if (!note) throw new NotFoundException('Note already deleted')

    await this.softDelete(songId, note.id, user)
    return { noteId: note.id }
  }

  async update(noteId: string, dto: UpdateNoteDto, user: AuthUser): Promise<Note> {
    if (dto.noteType === 'HOLD' && (dto.duration == null || dto.duration <= 0)) {
      throw new BadRequestException('HOLD notes require duration > 0')
    }

    const existing = await this.prisma.note.findFirst({
      where: { id: noteId, deletedAt: null },
      include: { creator: { select: { name: true } } },
    })
    if (!existing) throw new NotFoundException('Note not found')
    if (existing.createdBy !== user.id && user.role !== 'ADMIN') throw new ForbiddenException()

    const updated = await this.prisma.note.update({
      where: { id: noteId },
      data: { ...dto },
      include: { creator: { select: { name: true } } },
    })

    const note = toNote(updated)
    this.eventEmitter.emit(NOTE_EVENTS.UPDATED, {
      songId: note.songId,
      noteId: note.id,
      userId: user.id,
      beforeState: toNote(existing),
      afterState: note,
    } satisfies NoteUpdatedEvent)
    return note
  }

  async getEvents(songId: string, cursor?: string, limit = 50) {
    const events = await this.prisma.noteEvent.findMany({
      where: { songId, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
    const hasMore = events.length > limit
    const items = hasMore ? events.slice(0, limit) : events
    return {
      events: items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    }
  }
}
