import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Prisma } from '../../../generated/prisma/client'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { CommandType, Note, NoteCreatedEvent, NoteDeletedEvent, UndoConflict, UndoPreview } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { RecordCommandInput, UndoResolution } from './editor-command.types'

@Injectable()
export class EditorCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  record(input: RecordCommandInput) {
    return this.prisma.editorCommand.create({
      data: {
        songId: input.songId,
        chartId: input.chartId ?? null,
        commandType: input.commandType,
        userId: input.userId,
        summary: input.summary as Prisma.InputJsonValue,
        undoable: input.undoable ?? true,
        isCompensation: input.isCompensation ?? false,
      },
    })
  }

  findUndoStack(chartId: string, userId: string) {
    return this.prisma.editorCommand.findMany({
      where: {
        chartId,
        userId,
        undoable: true,
        isCompensation: false,
        undoneByCommandId: null,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: string) {
    return this.prisma.editorCommand.findUnique({ where: { id } })
  }

  async previewUndo(chartId: string, userId: string): Promise<UndoPreview> {
    const stack = await this.findUndoStack(chartId, userId)
    if (stack.length === 0) throw new NotFoundException('Nothing to undo')

    const command = stack[0]
    const conflicts = await this.computeUndoConflicts(command)

    return {
      commandId: command.id,
      commandType: command.commandType as CommandType,
      summary: command.summary as Record<string, unknown>,
      conflicts,
    }
  }

  async applyUndo(
    chartId: string,
    userId: string,
    commandId: string,
    resolutions: UndoResolution[],
  ): Promise<{ id: string; commandType: string; isCompensation: boolean }> {
    const command = await this.findById(commandId)
    if (!command || command.userId !== userId) throw new NotFoundException('Command not found')
    if (command.undoneByCommandId) throw new NotFoundException('Already undone')

    const currentConflicts = await this.computeUndoConflicts(command)
    const resolvedIds = new Set(resolutions.map(r => r.conflictId))
    const currentIds = new Set(currentConflicts.map(c => c.conflictId))
    if (!this.setsEqual(resolvedIds, currentIds)) {
      throw new ConflictException({ error: 'CONFLICTS_CHANGED', conflicts: currentConflicts })
    }

    const resolutionMap = new Map(resolutions.map(r => [r.conflictId, r.action]))

    const mutations = await this.prisma.editorEvent.findMany({
      where: { commandId: command.id },
      orderBy: { createdAt: 'asc' },
    })

    const compensationCommand = await this.record({
      songId: command.songId,
      chartId: command.chartId,
      commandType: 'UNDO',
      userId,
      summary: { targetCommandId: command.id, targetCommandType: command.commandType },
      undoable: false,
      isCompensation: true,
    })

    // NOTE_CREATED → soft-delete first (frees slots before NOTE_DELETED restorations)
    for (const mutation of mutations) {
      if (mutation.entityType !== 'NOTE' || mutation.eventType !== 'NOTE_CREATED') continue
      if (!mutation.entityId) continue

      const note = await this.prisma.note.findFirst({
        where: { id: mutation.entityId, deletedAt: null },
        include: { creator: { select: { name: true, avatarUrl: true } } },
      })
      if (!note) continue

      await this.prisma.note.update({ where: { id: mutation.entityId }, data: { deletedAt: new Date() } })

      const before = this.toNote(note)
      this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
        songId: note.songId,
        noteId: note.id,
        userId,
        beforeState: before,
        commandId: compensationCommand.id,
      } satisfies NoteDeletedEvent)

      await this.prisma.editorEvent.create({
        data: {
          songId: note.songId,
          chartId: note.chartId,
          entityType: 'NOTE',
          entityId: note.id,
          eventType: 'NOTE_DELETED',
          userId,
          beforeState: before as object,
          commandId: compensationCommand.id,
          undoable: false,
        },
      })
    }

    // NOTE_DELETED → restore notes, respecting resolutions
    for (const mutation of mutations) {
      if (mutation.entityType !== 'NOTE' || mutation.eventType !== 'NOTE_DELETED') continue
      if (!mutation.entityId) continue

      const before = mutation.beforeState as Record<string, unknown> | null
      const conflict = currentConflicts.find(
        c => before && c.track === (before.track as number) && c.time === (before.time as number),
      )

      if (conflict) {
        const action = resolutionMap.get(conflict.conflictId) ?? 'KEEP_EXISTING'
        if (action === 'KEEP_EXISTING') continue
        await this.prisma.note.update({
          where: { id: conflict.conflictId },
          data: { deletedAt: new Date() },
        })
      }

      const softDeleted = await this.prisma.note.findFirst({ where: { id: mutation.entityId } })
      if (!softDeleted || softDeleted.deletedAt === null) continue

      const restored = await this.prisma.note.update({
        where: { id: mutation.entityId },
        data: { deletedAt: null },
        include: { creator: { select: { name: true, avatarUrl: true } } },
      })
      const note = this.toNote(restored)

      this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
        songId: note.songId,
        noteId: note.id,
        userId,
        afterState: note,
        commandId: compensationCommand.id,
      } satisfies NoteCreatedEvent)

      await this.prisma.editorEvent.create({
        data: {
          songId: note.songId,
          chartId: note.chartId,
          entityType: 'NOTE',
          entityId: note.id,
          eventType: 'NOTE_CREATED',
          userId,
          afterState: note as object,
          commandId: compensationCommand.id,
          undoable: false,
        },
      })
    }

    // NOTE_UPDATED → restore beforeState
    for (const mutation of mutations) {
      if (mutation.entityType !== 'NOTE' || mutation.eventType !== 'NOTE_UPDATED') continue
      if (!mutation.entityId) continue

      const before = mutation.beforeState as Partial<Note> | null
      if (!before) continue

      const existing = await this.prisma.note.findFirst({
        where: { id: mutation.entityId, deletedAt: null },
        include: { creator: { select: { name: true, avatarUrl: true } } },
      })
      if (!existing) continue

      const updated = await this.prisma.note.update({
        where: { id: mutation.entityId },
        data: {
          title: before.title,
          description: before.description,
          noteType: before.noteType as any,
          duration: before.duration ?? null,
        },
        include: { creator: { select: { name: true, avatarUrl: true } } },
      })

      await this.prisma.editorEvent.create({
        data: {
          songId: updated.songId,
          chartId: updated.chartId,
          entityType: 'NOTE',
          entityId: updated.id,
          eventType: 'NOTE_UPDATED',
          userId,
          beforeState: this.toNote(existing) as object,
          afterState: this.toNote(updated) as object,
          commandId: compensationCommand.id,
          undoable: false,
        },
      })
    }

    // SECTION mutations
    for (const mutation of mutations) {
      if (mutation.entityType !== 'SECTION') continue
      await this.applySectionMutationUndo(mutation as any, userId, compensationCommand.id)
    }

    await this.prisma.editorCommand.update({
      where: { id: command.id },
      data: { undoneByCommandId: compensationCommand.id },
    })

    return compensationCommand
  }

  private async computeUndoConflicts(command: { id: string; chartId?: string | null }): Promise<UndoConflict[]> {
    const deletedMutations = await this.prisma.editorEvent.findMany({
      where: { commandId: command.id, eventType: 'NOTE_DELETED' },
    })

    const conflicts: UndoConflict[] = []

    for (const mutation of deletedMutations) {
      const before = mutation.beforeState as Record<string, unknown> | null
      if (!before || before.track == null || before.time == null) continue

      const occupant = await this.prisma.note.findFirst({
        where: {
          chartId: command.chartId ?? undefined,
          track: before.track as number,
          time: before.time as number,
          deletedAt: null,
          NOT: { id: mutation.entityId ?? '' },
        },
        include: { creator: { select: { name: true, avatarUrl: true } } },
      })

      if (occupant) {
        conflicts.push({
          conflictId: occupant.id,
          track: before.track as number,
          time: before.time as number,
          incomingNote: {
            id: (before.id as string) ?? '',
            track: before.track as number,
            time: before.time as number,
            title: (before.title as string) ?? '',
            noteType: (before.noteType as string) ?? 'TAP',
            duration: before.duration as number | undefined,
            createdBy: (before.createdBy as string) ?? '',
            creatorName: (before.creatorName as string) ?? '',
          },
          existingNote: {
            id: occupant.id,
            track: occupant.track,
            time: occupant.time,
            title: occupant.title,
            noteType: occupant.noteType,
            duration: occupant.duration ?? undefined,
            createdBy: occupant.createdBy,
            creatorName: occupant.creator?.name ?? '',
          },
        })
      }
    }

    return conflicts
  }

  private async applySectionMutationUndo(
    mutation: { entityId?: string | null; eventType: string; beforeState: unknown; afterState: unknown; songId: string },
    userId: string,
    compensationCommandId: string,
  ): Promise<void> {
    if (mutation.eventType === 'SECTION_CREATED') {
      if (!mutation.entityId) return
      await this.prisma.sectionMarker.delete({ where: { id: mutation.entityId } }).catch(() => {})
      await this.prisma.editorEvent.create({
        data: {
          songId: mutation.songId,
          entityType: 'SECTION',
          entityId: mutation.entityId,
          eventType: 'SECTION_DELETED',
          userId,
          beforeState: mutation.afterState as object,
          commandId: compensationCommandId,
          undoable: false,
        },
      })
    }

    if (mutation.eventType === 'SECTION_DELETED') {
      const before = mutation.beforeState as { id?: string; songId?: string; time?: number; label?: string; color?: string; createdBy?: string } | null
      if (!before?.songId || before.time == null || !before.label) return
      const restored = await this.prisma.sectionMarker.create({
        data: {
          songId: before.songId,
          time: before.time,
          label: before.label,
          color: before.color ?? '#6C63FF',
          createdBy: before.createdBy ?? userId,
        },
      })
      await this.prisma.editorEvent.create({
        data: {
          songId: mutation.songId,
          entityType: 'SECTION',
          entityId: restored.id,
          eventType: 'SECTION_CREATED',
          userId,
          afterState: restored as object,
          commandId: compensationCommandId,
          undoable: false,
        },
      })
    }

    if (mutation.eventType === 'SECTION_UPDATED') {
      const before = mutation.beforeState as { label?: string; color?: string } | null
      if (!mutation.entityId || !before) return
      const existing = await this.prisma.sectionMarker.findUnique({ where: { id: mutation.entityId } })
      if (!existing) return
      const updated = await this.prisma.sectionMarker.update({
        where: { id: mutation.entityId },
        data: { label: before.label, color: before.color },
      })
      await this.prisma.editorEvent.create({
        data: {
          songId: mutation.songId,
          entityType: 'SECTION',
          entityId: mutation.entityId,
          eventType: 'SECTION_UPDATED',
          userId,
          beforeState: existing as object,
          afterState: updated as object,
          commandId: compensationCommandId,
          undoable: false,
        },
      })
    }
  }

  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    return a.size === b.size && [...a].every(v => b.has(v))
  }

  private toNote(n: {
    id: string; chartId: string; songId: string; track: number; time: number;
    title: string; description: string; createdBy: string; noteType?: string;
    duration?: number | null; createdAt: Date; updatedAt: Date;
    creator?: { name: string; avatarUrl?: string | null }
  }): Note {
    return {
      id: n.id, chartId: n.chartId, songId: n.songId,
      track: n.track, time: n.time, title: n.title, description: n.description,
      createdBy: n.createdBy, creatorName: n.creator?.name ?? '',
      creatorAvatarUrl: n.creator?.avatarUrl ?? undefined,
      createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString(),
      noteType: (n.noteType as Note['noteType']) ?? 'TAP',
      duration: n.duration ?? undefined,
    }
  }
}
