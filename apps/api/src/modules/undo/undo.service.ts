import { Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { randomUUID } from 'crypto'
import { NOTE_EVENTS, type AuthUser, type Note, type NoteUpdatedEvent } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { EditorEventService } from '../ledger/editor-event.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { ChartAnalyzeService } from '../charts/chart-analyze.service'

function toNote(n: any): Note {
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
    noteType: n.noteType ?? 'TAP',
    duration: n.duration ?? undefined,
  }
}

@Injectable()
export class UndoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly editorEvents: EditorEventService,
    private readonly events: EventEmitter2,
    private readonly access: ProjectAccessService,
    private readonly analyze: ChartAnalyzeService,
  ) {}

  async undo(chartId: string, user: AuthUser): Promise<{ eventId: string }> {
    const chart = await this.prisma.songChart.findUnique({ where: { id: chartId }, select: { songId: true } })
    if (!chart) throw new NotFoundException('Chart not found')
    await this.access.assertCanEditSongChart(chart.songId, user)

    const latest = await this.editorEvents.findLatestUndoable(chart.songId, user.id, chartId)
    if (!latest) throw new NotFoundException('Nothing to undo')

    const eventsToUndo = latest.batchId
      ? await this.editorEvents.findUndoableBatch(chart.songId, user.id, latest.batchId)
      : [latest]

    const undoBatchId = latest.batchId ? randomUUID() : null
    const undoneIds: string[] = []
    let undoEventId: string | null = null

    for (const event of eventsToUndo) {
      if (event.entityType === 'NOTE' && event.eventType === 'NOTE_UPDATED') {
        const before = event.beforeState as Partial<Note> | null
        if (!event.entityId || !before) continue
        const existing = await this.prisma.note.findFirst({ where: { id: event.entityId, deletedAt: null } })
        if (!existing) continue
        const updated = await this.prisma.note.update({
          where: { id: event.entityId },
          data: {
            title: before.title,
            description: before.description,
            noteType: before.noteType as any,
            duration: before.duration ?? null,
          },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })
        const note = toNote(updated)
        this.events.emit(NOTE_EVENTS.UPDATED, {
          songId: note.songId,
          noteId: note.id,
          userId: user.id,
          beforeState: existing as any,
          afterState: note,
        } satisfies NoteUpdatedEvent)
        const undoEvent = await this.editorEvents.record({
          songId: note.songId,
          chartId: note.chartId,
          entityType: 'NOTE',
          entityId: note.id,
          eventType: 'NOTE_UPDATED',
          userId: user.id,
          beforeState: existing as any,
          afterState: note as any,
          batchId: undoBatchId,
          undoable: true,
        })
        undoEventId = undoEvent.id
        undoneIds.push(event.id)
      }

      if (event.entityType === 'SECTION' && event.eventType === 'SECTION_CREATED') {
        if (!event.entityId) continue
        const existing = await this.prisma.sectionMarker.findUnique({ where: { id: event.entityId } })
        if (!existing) continue
        await this.prisma.sectionMarker.delete({ where: { id: event.entityId } })
        const undoEvent = await this.editorEvents.record({
          songId: event.songId,
          entityType: 'SECTION',
          entityId: event.entityId,
          eventType: 'SECTION_DELETED',
          userId: user.id,
          beforeState: event.afterState as object,
          batchId: undoBatchId,
          undoable: true,
        })
        undoEventId = undoEvent.id
        undoneIds.push(event.id)
      }

      if (event.entityType === 'SECTION' && event.eventType === 'SECTION_DELETED') {
        const before = event.beforeState as {
          id?: string
          songId?: string
          time?: number
          label?: string
          color?: string
          createdBy?: string
        } | null
        if (!before?.songId || before.time == null || !before.label) continue
        const restored = await this.prisma.sectionMarker.create({
          data: {
            songId: before.songId,
            time: before.time,
            label: before.label,
            color: before.color ?? '#6C63FF',
            createdBy: before.createdBy ?? user.id,
          },
        })
        const undoEvent = await this.editorEvents.record({
          songId: event.songId,
          entityType: 'SECTION',
          entityId: restored.id,
          eventType: 'SECTION_CREATED',
          userId: user.id,
          afterState: restored as object,
          batchId: undoBatchId,
          undoable: true,
        })
        undoEventId = undoEvent.id
        undoneIds.push(event.id)
      }

      if (event.entityType === 'SECTION' && event.eventType === 'SECTION_UPDATED') {
        const before = event.beforeState as {
          id?: string
          label?: string
          color?: string
        } | null
        if (!event.entityId || !before) continue
        const existing = await this.prisma.sectionMarker.findUnique({ where: { id: event.entityId } })
        if (!existing) continue
        const updated = await this.prisma.sectionMarker.update({
          where: { id: event.entityId },
          data: {
            label: before.label,
            color: before.color,
          },
        })
        const undoEvent = await this.editorEvents.record({
          songId: event.songId,
          entityType: 'SECTION',
          entityId: event.entityId,
          eventType: 'SECTION_UPDATED',
          userId: user.id,
          beforeState: existing as object,
          afterState: updated as object,
          batchId: undoBatchId,
          undoable: true,
        })
        undoEventId = undoEvent.id
        undoneIds.push(event.id)
      }
    }

    if (!undoEventId || undoneIds.length === 0) throw new NotFoundException('Nothing to undo')
    await this.editorEvents.markUndone(undoneIds, undoEventId)
    await this.analyze.run(chartId)
    return { eventId: undoEventId }
  }
}
