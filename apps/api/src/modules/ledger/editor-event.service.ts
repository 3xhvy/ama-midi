import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RecordEditorEventInput } from './editor-event.types'

@Injectable()
export class EditorEventService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordEditorEventInput) {
    return this.prisma.editorEvent.create({
      data: {
        songId: input.songId,
        chartId: input.chartId ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        eventType: input.eventType,
        userId: input.userId,
        beforeState: input.beforeState ?? undefined,
        afterState: input.afterState ?? undefined,
        batchId: input.batchId ?? null,
        replacesEventId: input.replacesEventId ?? null,
        undoneByEventId: input.undoneByEventId ?? null,
        commandId: input.commandId ?? null,
        undoable: input.undoable,
      },
    })
  }

  async findLatestUndoable(songId: string, userId: string, chartId?: string | null) {
    const rows = await this.prisma.editorEvent.findMany({
      where: {
        songId,
        userId,
        ...(chartId ? { chartId } : {}),
        undoable: true,
        undoneByEventId: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    return rows[0] ?? null
  }

  findUndoableBatch(songId: string, userId: string, batchId: string) {
    return this.prisma.editorEvent.findMany({
      where: { songId, userId, batchId, undoable: true, undoneByEventId: null },
      orderBy: { createdAt: 'desc' },
    })
  }

  markUndone(eventIds: string[], undoneByEventId: string) {
    return this.prisma.editorEvent.updateMany({
      where: { id: { in: eventIds } },
      data: { undoneByEventId },
    })
  }
}
