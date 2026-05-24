import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma } from '../../../generated/prisma/client'
import { rethrowPrismaAsHttp } from '../../common/prisma-error.util'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { ChartAnalyzeService } from '../charts/chart-analyze.service'
import { EditorCommandService } from '../editor-commands/editor-command.service'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { ActivityActor, AuthUser, Note, NoteCreatedEvent, NoteDeletedEvent, NoteUpdatedEvent } from '@ama-midi/shared'
import { UpdateNoteDto } from './dto/update-note.dto'

function snapTime(time: number): number {
  return Math.round(time * 10) / 10
}

function toNote(n: {
  id: string
  chartId: string
  songId: string
  track: number
  time: number
  title: string
  description: string
  createdBy: string
  noteType?: string
  duration?: number | null
  createdAt: Date
  updatedAt: Date
  creator?: { name: string; avatarUrl?: string | null }
}): Note {
  return {
    id: n.id,
    chartId: n.chartId,
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

function noteCommandSummary(note: Pick<Note, 'track' | 'time' | 'title' | 'noteType' | 'duration'>) {
  return {
    track: note.track,
    time: note.time,
    title: note.title,
    noteType: note.noteType,
    ...(note.duration != null ? { duration: note.duration } : {}),
  }
}

function toActor(user: AuthUser): ActivityActor {
  return { id: user.id, name: user.name, avatarUrl: user.avatarUrl ?? null }
}

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly access: ProjectAccessService,
    private readonly analyze: ChartAnalyzeService,
    private readonly editorCommands: EditorCommandService,
  ) {}

  async create(
    chartId: string,
    body: { track: number; time: number; title: string; description?: string; noteType?: string; duration?: number },
    user: AuthUser,
  ): Promise<Note> {
    const { songId } = await this.resolveChart(chartId, user)
    const time = snapTime(body.time)

    if (body.noteType === 'HOLD' && (body.duration == null || body.duration <= 0)) {
      throw new BadRequestException('HOLD notes require duration > 0')
    }

    await this.assertNoTrackOverlap(chartId, body.track, time, body.noteType ?? 'TAP', body.duration ?? null)

    try {
      const n = await this.prisma.note.create({
        data: {
          chartId,
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

      const cmd = await this.editorCommands.record({
        songId,
        chartId,
        commandType: 'SINGLE_NOTE_CREATED',
        userId: user.id,
        summary: noteCommandSummary(note),
      })

      this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
        songId,
        noteId: note.id,
        userId: user.id,
        afterState: note,
        commandId: cmd.id,
        actor: toActor(user),
      } satisfies NoteCreatedEvent)

      this.analyze.scheduleRun(chartId)
      return note
    } catch (e: unknown) {
      rethrowPrismaAsHttp(e)
    }
  }

  async softDelete(chartId: string, noteId: string, user: AuthUser): Promise<void> {
    const { songId } = await this.resolveChart(chartId, user)
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, chartId, deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })
    if (!note) throw new NotFoundException('Note not found')
    if (note.createdBy !== user.id && user.role !== 'ADMIN') throw new ForbiddenException()

    await this.prisma.note.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    })

    const cmd = await this.editorCommands.record({
      songId,
      chartId,
      commandType: 'SINGLE_NOTE_DELETED',
      userId: user.id,
      summary: noteCommandSummary(toNote(note)),
    })

    this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
      songId,
      noteId,
      userId: user.id,
      beforeState: toNote(note),
      commandId: cmd.id,
      actor: toActor(user),
    } satisfies NoteDeletedEvent)

    this.analyze.scheduleRun(chartId)
  }

  async update(chartId: string, noteId: string, dto: UpdateNoteDto, user: AuthUser): Promise<Note> {
    const existing = await this.prisma.note.findFirst({
      where: { id: noteId, deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })
    if (!existing) throw new NotFoundException('Note not found')
    if (existing.chartId !== chartId) throw new NotFoundException('Note not found')
    await this.access.assertCanEditSongChart(existing.songId, user)
    if (existing.createdBy !== user.id && user.role !== 'ADMIN') throw new ForbiddenException()

    const track = existing.track
    const time = existing.time
    const noteType = dto.noteType ?? existing.noteType
    const duration = dto.duration !== undefined ? dto.duration : existing.duration

    if (noteType === 'HOLD' && (duration == null || duration <= 0)) {
      throw new BadRequestException('HOLD notes require duration > 0')
    }

    await this.assertNoTrackOverlap(existing.chartId, track, time, noteType, duration, noteId)

    const updated = await this.prisma.note.update({
      where: { id: noteId },
      data: { ...dto },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })

    const note = toNote(updated)

    const cmd = await this.editorCommands.record({
      songId: note.songId,
      chartId: existing.chartId,
      commandType: 'SINGLE_NOTE_UPDATED',
      userId: user.id,
      summary: { noteId: note.id, ...noteCommandSummary(note) },
    })

    this.eventEmitter.emit(NOTE_EVENTS.UPDATED, {
      songId: note.songId,
      noteId: note.id,
      userId: user.id,
      beforeState: toNote(existing),
      afterState: note,
      commandId: cmd.id,
      actor: toActor(user),
    } satisfies NoteUpdatedEvent)

    this.analyze.scheduleRun(existing.chartId)
    return note
  }

  async getEvents(chartId: string, user: AuthUser, cursor?: string, limit = 50) {
    await this.resolveChart(chartId, user, 'view')
    const commands = await this.prisma.editorCommand.findMany({
      where: {
        chartId,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
    const hasMore = commands.length > limit
    const items = hasMore ? commands.slice(0, limit) : commands
    return {
      events: items.map(cmd => ({ ...cmd, createdAt: cmd.createdAt.toISOString() })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    }
  }

  private async resolveChart(chartId: string, user: AuthUser, mode: 'edit' | 'view' = 'edit') {
    const chart = await this.prisma.songChart.findUnique({
      where: { id: chartId },
      select: { songId: true },
    })
    if (!chart) throw new NotFoundException('Chart not found')
    if (mode === 'view') {
      await this.access.assertCanViewSong(chart.songId, user)
    } else {
      await this.access.assertCanEditSongChart(chart.songId, user)
    }
    return { chartId, songId: chart.songId }
  }

  private async assertNoTrackOverlap(
    chartId: string,
    track: number,
    time: number,
    noteType: string,
    duration: number | null,
    excludeNoteId?: string,
  ): Promise<void> {
    const candidateStart = time
    const candidateEnd =
      noteType === 'HOLD' && duration != null && duration > 0 ? time + duration : time + 0.0001

    const overlapFilter = excludeNoteId
      ? Prisma.sql`AND id != ${excludeNoteId}`
      : Prisma.empty

    const rows = await this.prisma.$queryRaw<Array<{ time: number }>>`
      SELECT time
      FROM notes
      WHERE "chartId" = ${chartId}
        AND track = ${track}
        AND "deletedAt" IS NULL
        ${overlapFilter}
        AND time < ${candidateEnd}
        AND (
          CASE
            WHEN "noteType" = 'HOLD' AND duration IS NOT NULL AND duration > 0
            THEN time + duration
            ELSE time + 0.0001
          END
        ) > ${candidateStart}
      LIMIT 1
    `

    if (rows.length > 0) {
      throw new ConflictException({ error: 'POSITION_TAKEN' })
    }
  }
}
