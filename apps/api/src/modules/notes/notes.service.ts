import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { AuthUser, Note, NoteCreatedEvent, NoteDeletedEvent, NoteUpdatedEvent } from '@ama-midi/shared'
import { UpdateNoteDto } from './dto/update-note.dto'
import { noteEnd, overlapsAny, findOverlapping, type NoteSlot } from './note-overlap'
import { randomUUID } from 'crypto'

function snapTime(time: number): number {
  return Math.round(time * 10) / 10
}

function toNote(n: {
  id: string; songId: string; track: number; time: number
  title: string; description: string; createdBy: string
  noteType?: string; duration?: number | null
  createdAt: Date; updatedAt: Date
  creator?: { name: string; avatarUrl?: string | null }
}): Note {
  return {
    id: n.id,
    songId: n.songId,
    track: n.track,
    time: n.time,
    title: n.title,
    description: n.description,
    createdBy: n.createdBy,
    creatorName: n.creator?.name ?? '',
    creatorAvatarUrl: n.creator?.avatarUrl ?? undefined,
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
    private readonly access: ProjectAccessService,
  ) {}

  async create(
    songId: string,
    body: { track: number; time: number; title: string; description?: string; noteType?: string; duration?: number },
    user: AuthUser,
  ): Promise<Note> {
    await this.access.assertCanEditSongChart(songId, user)
    const time = snapTime(body.time)

    if (body.noteType === 'HOLD' && (body.duration == null || body.duration <= 0)) {
      throw new BadRequestException('HOLD notes require duration > 0')
    }

    await this.assertNoTrackOverlap(songId, body.track, time, body.noteType ?? 'TAP', body.duration ?? null)

    try {
      const n = await this.prisma.note.create({
        data: {
          songId,
          track: body.track,
          time,
          title: body.title,
          description: body.description ?? '',
          noteType: (body.noteType as any) ?? 'TAP',
          duration: body.duration ?? null,
          createdBy: user.id,
        },
        include: { creator: { select: { name: true, avatarUrl: true } } },
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
    await this.access.assertCanEditSongChart(songId, user)
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, songId, deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
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
    await this.access.assertCanEditSongChart(songId, user)
    const lastEvent = await this.prisma.noteEvent.findFirst({
      where: { songId, userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    if (!lastEvent) throw new NotFoundException('Nothing to undo')

    if (!lastEvent.batchId) {
      if (lastEvent.eventType !== 'NOTE_CREATED' || !lastEvent.noteId) {
        throw new NotFoundException('Nothing to undo')
      }

      const note = await this.prisma.note.findFirst({
        where: { id: lastEvent.noteId, songId, deletedAt: null },
        include: { creator: { select: { name: true, avatarUrl: true } } },
      })
      if (!note) throw new NotFoundException('Note already deleted')

      await this.softDelete(songId, note.id, user)
      return { noteId: note.id }
    }

    return this.undoBatch(songId, user, lastEvent.batchId)
  }

  private async undoBatch(songId: string, user: AuthUser, batchId: string): Promise<{ noteId: string }> {
    const batchEvents = await this.prisma.noteEvent.findMany({
      where: { songId, userId: user.id, batchId },
      orderBy: { createdAt: 'desc' },
    })
    if (batchEvents.length === 0) throw new NotFoundException('Nothing to undo')

    const undoBatchId = randomUUID()
    let lastNoteId = batchEvents[0]?.noteId ?? batchEvents[0]?.id

    for (const event of batchEvents) {
      if (event.eventType === 'NOTE_CREATED' && event.noteId) {
        const note = await this.prisma.note.findFirst({
          where: { id: event.noteId, songId, deletedAt: null },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })
        if (!note) continue

        await this.prisma.note.update({
          where: { id: note.id },
          data: { deletedAt: new Date() },
        })

        this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
          songId,
          noteId: note.id,
          userId: user.id,
          beforeState: toNote(note),
          batchId: undoBatchId,
          realtimeMode: 'batch',
        } satisfies NoteDeletedEvent)

        lastNoteId = note.id
      }

      if (event.eventType === 'NOTE_DELETED' && event.beforeState) {
        const before = event.beforeState as Partial<Note>
        if (
          before.track == null ||
          before.time == null ||
          before.title == null ||
          before.noteType == null
        ) {
          continue
        }

        const existing = await this.prisma.note.findMany({
          where: { songId, track: before.track, deletedAt: null },
          select: { id: true, track: true, time: true, noteType: true, duration: true },
        })

        const candidate: NoteSlot = {
          track: before.track,
          time: before.time,
          noteType: before.noteType,
          duration: before.duration ?? null,
        }

        if (findOverlapping(candidate, existing)) continue

        const restored = await this.prisma.note.create({
          data: {
            songId,
            track: before.track,
            time: before.time,
            title: before.title,
            description: before.description ?? '',
            noteType: before.noteType as any,
            duration: before.duration ?? null,
            createdBy: before.createdBy ?? user.id,
          },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })

        const note = toNote(restored)
        this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
          songId,
          noteId: note.id,
          userId: user.id,
          afterState: note,
          batchId: undoBatchId,
          realtimeMode: 'batch',
        } satisfies NoteCreatedEvent)

        lastNoteId = note.id
      }
    }

    this.eventEmitter.emit(NOTE_EVENTS.BATCH_APPLIED, {
      songId,
      batchId: undoBatchId,
      created: [],
      deletedIds: [],
      actorId: user.id,
    })

    return { noteId: lastNoteId ?? batchId }
  }

  async update(noteId: string, dto: UpdateNoteDto, user: AuthUser): Promise<Note> {
    const existing = await this.prisma.note.findFirst({
      where: { id: noteId, deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })
    if (!existing) throw new NotFoundException('Note not found')
    await this.access.assertCanEditSong(existing.songId, user)
    if (existing.createdBy !== user.id && user.role !== 'ADMIN') throw new ForbiddenException()

    const track = existing.track
    const time = existing.time
    const noteType = dto.noteType ?? existing.noteType
    const duration = dto.duration !== undefined ? dto.duration : existing.duration

    if (noteType === 'HOLD' && (duration == null || duration <= 0)) {
      throw new BadRequestException('HOLD notes require duration > 0')
    }

    await this.assertNoTrackOverlap(existing.songId, track, time, noteType, duration, noteId)

    const updated = await this.prisma.note.update({
      where: { id: noteId },
      data: { ...dto },
      include: { creator: { select: { name: true, avatarUrl: true } } },
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

  async getEvents(songId: string, user: AuthUser, cursor?: string, limit = 50) {
    await this.access.assertCanViewSong(songId, user)
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

  private async assertNoTrackOverlap(
    songId: string,
    track: number,
    time: number,
    noteType: string,
    duration: number | null,
    excludeNoteId?: string,
  ): Promise<void> {
    const end = noteType === 'HOLD' && duration != null && duration > 0 ? time + duration : time
    const others = await this.prisma.note.findMany({
      where: {
        songId,
        track,
        deletedAt: null,
        time: { lt: end },
        ...(excludeNoteId ? { id: { not: excludeNoteId } } : {}),
      },
      select: { time: true, noteType: true, duration: true },
    })
    if (overlapsAny({ time, noteType, duration }, others)) {
      throw new ConflictException({ error: 'POSITION_TAKEN' })
    }
  }
}
