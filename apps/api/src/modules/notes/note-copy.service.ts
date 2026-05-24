import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { createHash, randomUUID } from 'crypto'
import {
  NOTE_EVENTS,
  TIME_MAX,
  TIME_MIN,
  TRACK_MAX,
  TRACK_MIN,
} from '@ama-midi/shared'
import type {
  AuthUser,
  ConflictAction,
  Note,
  NoteCopyApplyRequest,
  NoteCopyApplyResult,
  NoteCopyPreview,
  NoteCopyPreviewRequest,
  NoteCreatedEvent,
  NoteDeletedEvent,
  NotesBatchAppliedPayload,
  PlacementConflict,
  PlacementCreatableSlot,
} from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { ChartAnalyzeService } from '../charts/chart-analyze.service'
import { EditorCommandService } from '../editor-commands/editor-command.service'
import {
  classifySlots,
  type IncomingSlot,
  type ExistingSlotRow,
} from './note-slot-preview'

const MIN_NOTE_IDS = 2
const MAX_NOTE_IDS = 500

function snapTime(time: number): number {
  return Math.round(time * 10) / 10
}

interface SelectionNoteRow {
  id: string
  chartId: string
  songId: string
  track: number
  time: number
  title: string
  description: string
  noteType: string
  duration: number | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  creator?: { name: string; avatarUrl?: string | null }
}

interface CreatableWithSource extends PlacementCreatableSlot {
  sourceNoteId: string
}

@Injectable()
export class NoteCopyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly eventEmitter: EventEmitter2,
    private readonly analyze: ChartAnalyzeService,
    private readonly editorCommands: EditorCommandService,
  ) {}

  async previewCopy(
    chartId: string,
    request: NoteCopyPreviewRequest,
    user: AuthUser,
  ): Promise<NoteCopyPreview> {
    const { songId } = await this.resolveChart(chartId, user)
    const notes = await this.loadSelection(chartId, request.noteIds)
    return this.buildPreview(songId, chartId, notes, request)
  }

  async applyCopy(
    chartId: string,
    request: NoteCopyApplyRequest,
    user: AuthUser,
  ): Promise<NoteCopyApplyResult> {
    const { songId } = await this.resolveChart(chartId, user)
    const notes = await this.loadSelection(chartId, request.noteIds)
    const preview = await this.buildPreview(songId, chartId, notes, request)

    const currentVersion = this.buildSelectionVersion(notes, request)
    if (request.selectionVersion !== currentVersion) {
      throw new ConflictException({ error: 'CONFLICTS_CHANGED', preview })
    }

    this.assertResolutionsMatchPreview(preview, request.resolutions)

    const resolutionMap = new Map(
      request.resolutions.map((resolution) => [resolution.conflictId, resolution.action]),
    )

    const sourceIdsToDelete = this.resolveSourceIdsToDelete(
      preview,
      resolutionMap,
      request.operation,
    )

    const batchId = randomUUID()
    const deletedIds: string[] = []
    const createdEntries: Array<{ note: Note; replacesNoteId?: string }> = []
    const deletedBeforeStates: Array<{ noteId: string; beforeState: Note }> = []

    await this.prisma.$transaction(async (tx) => {
      for (const conflict of preview.conflicts) {
        if (resolutionMap.get(conflict.conflictId) !== 'REPLACE_WITH_PATTERN') continue

        const existing = await tx.note.findFirst({
          where: { id: conflict.conflictId, chartId, deletedAt: null },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })
        if (!existing) continue

        await tx.note.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        })

        deletedIds.push(existing.id)
        deletedBeforeStates.push({
          noteId: existing.id,
          beforeState: this.toDomainNote(existing),
        })
      }

      for (const sourceId of sourceIdsToDelete) {
        const source = await tx.note.findFirst({
          where: { id: sourceId, chartId, deletedAt: null },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })
        if (!source) continue

        await tx.note.update({
          where: { id: source.id },
          data: { deletedAt: new Date() },
        })

        deletedIds.push(source.id)
        deletedBeforeStates.push({
          noteId: source.id,
          beforeState: this.toDomainNote(source),
        })
      }

      const notesToCreate: Array<CreatableWithSource & { replacesNoteId?: string }> = [
        ...preview.creatable,
      ]

      for (const conflict of preview.conflicts) {
        if (resolutionMap.get(conflict.conflictId) !== 'REPLACE_WITH_PATTERN') continue
        notesToCreate.push({
          sourceIndex: conflict.sourceIndex,
          sourceNoteId: conflict.sourceNoteId,
          track: conflict.track,
          time: conflict.time,
          noteType: conflict.incomingNote.noteType,
          duration: conflict.incomingNote.duration,
          title: conflict.incomingNote.title,
          description: conflict.incomingNote.description,
          replacesNoteId: conflict.conflictId,
        })
      }

      for (const slot of notesToCreate) {
        const createdRow = await tx.note.create({
          data: {
            chartId,
            songId,
            track: slot.track,
            time: slot.time,
            title: slot.title,
            description: slot.description,
            noteType: slot.noteType as any,
            duration: slot.duration ?? null,
            createdBy: user.id,
          },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })
        createdEntries.push({
          note: this.toDomainNote(createdRow),
          replacesNoteId: slot.replacesNoteId,
        })
      }
    })

    const commandType = request.operation === 'MOVE'
      ? ('NOTES_MOVED' as const)
      : request.mode === 'REPEAT_INTERVAL'
        ? ('NOTES_REPEATED' as const)
        : ('PATTERN_PASTED' as const)

    const cmd = await this.editorCommands.record({
      songId,
      chartId,
      commandType,
      userId: user.id,
      summary: {
        noteCount: createdEntries.length,
        operation: request.operation,
        mode: request.mode,
        batchId,
      },
    })

    for (const { noteId, beforeState } of deletedBeforeStates) {
      this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
        songId,
        noteId,
        userId: user.id,
        beforeState,
        batchId,
        replacedByBatch: true,
        realtimeMode: 'batch',
        commandId: cmd.id,
      } satisfies NoteDeletedEvent)
    }

    for (const { note, replacesNoteId } of createdEntries) {
      this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
        songId,
        noteId: note.id,
        userId: user.id,
        afterState: note,
        batchId,
        replacesNoteId,
        realtimeMode: 'batch',
        commandId: cmd.id,
      } satisfies NoteCreatedEvent)
    }

    const created = createdEntries.map((entry) => entry.note)
    const replacedCount = preview.conflicts.filter(
      (conflict) => resolutionMap.get(conflict.conflictId) === 'REPLACE_WITH_PATTERN',
    ).length

    this.eventEmitter.emit(NOTE_EVENTS.BATCH_APPLIED, {
      songId,
      batchId,
      created,
      deletedIds,
      actorId: user.id,
    } satisfies NotesBatchAppliedPayload)

    await this.analyze.run(chartId)

    return {
      batchId,
      createdCount: created.length,
      replacedCount,
      skippedCount: preview.conflicts.length - replacedCount,
      movedCount: sourceIdsToDelete.size,
      notes: created,
    }
  }

  private resolveSourceIdsToDelete(
    preview: NoteCopyPreview,
    resolutionMap: Map<string, ConflictAction>,
    operation: NoteCopyPreviewRequest['operation'],
  ): Set<string> {
    if (operation !== 'MOVE') return new Set()

    const sourceIds = new Set<string>()
    for (const slot of preview.creatable) {
      sourceIds.add(slot.sourceNoteId)
    }
    for (const conflict of preview.conflicts) {
      if (resolutionMap.get(conflict.conflictId) === 'REPLACE_WITH_PATTERN') {
        sourceIds.add(conflict.sourceNoteId)
      }
    }
    return sourceIds
  }

  private assertResolutionsMatchPreview(
    preview: NoteCopyPreview,
    resolutions: Array<{ conflictId: string; action: ConflictAction }>,
  ): void {
    const currentIds = new Set(preview.conflicts.map((conflict) => conflict.conflictId))
    const requestedIds = new Set(resolutions.map((resolution) => resolution.conflictId))

    const idsMatch =
      currentIds.size === requestedIds.size &&
      [...currentIds].every((id) => requestedIds.has(id))

    if (!idsMatch) {
      throw new ConflictException({ error: 'CONFLICTS_CHANGED', preview })
    }
  }

  private async loadSelection(chartId: string, noteIds: string[]): Promise<SelectionNoteRow[]> {
    if (noteIds.length < MIN_NOTE_IDS || noteIds.length > MAX_NOTE_IDS) {
      throw new BadRequestException(`Selection must contain ${MIN_NOTE_IDS}-${MAX_NOTE_IDS} note IDs`)
    }

    const uniqueIds = new Set(noteIds)
    if (uniqueIds.size !== noteIds.length) {
      throw new BadRequestException('Selection note IDs must be unique')
    }

    const rows = await this.prisma.note.findMany({
      where: { id: { in: noteIds }, chartId, deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })

    if (rows.length !== noteIds.length) {
      throw new NotFoundException('One or more notes not found')
    }

    const byId = new Map(rows.map((row) => [row.id, row as SelectionNoteRow]))
    return noteIds.map((id) => byId.get(id)!)
  }

  private buildSelectionVersion(
    notes: SelectionNoteRow[],
    request: NoteCopyPreviewRequest,
  ): string {
    const sortedIds = [...request.noteIds].sort()
    const byId = new Map(notes.map((note) => [note.id, note]))
    const updatedAts = sortedIds
      .map((id) => byId.get(id)!.updatedAt.toISOString())
      .join(',')

    const transformParams =
      request.mode === 'TIME_SHIFT'
        ? String(request.timeDelta ?? '')
        : request.mode === 'TRACK_SHIFT'
          ? String(request.targetTrack ?? '')
          : request.mode === 'TRACK_TIME_ANCHOR'
            ? `${request.anchorTrack ?? ''},${request.anchorTime ?? ''}`
            : `${request.repeatCount ?? ''},${request.repeatInterval ?? ''}`

    const payload = [
      sortedIds.join(','),
      updatedAts,
      request.operation,
      request.mode,
      transformParams,
    ].join('|')

    return createHash('sha256').update(payload).digest('hex').slice(0, 32)
  }

  private computeTransformedSlots(
    notes: SelectionNoteRow[],
    request: NoteCopyPreviewRequest,
  ): { slots: IncomingSlot[]; minTime: number; minTrack: number } {
    const minTrack = Math.min(...notes.map((note) => note.track))
    const minTime = Math.min(...notes.map((note) => note.time))

    if (request.mode === 'REPEAT_INTERVAL') {
      return this.computeRepeatedSlots(notes, request, minTime, minTrack)
    }

    let trackDelta = 0
    let timeDelta = 0

    switch (request.mode) {
      case 'TIME_SHIFT':
        timeDelta = request.timeDelta ?? 0
        break
      case 'TRACK_SHIFT':
        trackDelta = (request.targetTrack ?? minTrack) - minTrack
        break
      case 'TRACK_TIME_ANCHOR':
        timeDelta = snapTime((request.anchorTime ?? minTime) - minTime)
        trackDelta = (request.anchorTrack ?? minTrack) - minTrack
        break
    }

    const slots: IncomingSlot[] = []

    for (let sourceIndex = 0; sourceIndex < notes.length; sourceIndex++) {
      const note = notes[sourceIndex]
      const track = note.track + trackDelta
      const time = snapTime(note.time + timeDelta)
      this.assertDestinationInRange(track, time, note)

      slots.push({
        sourceIndex,
        sourceNoteId: note.id,
        track,
        time,
        noteType: note.noteType,
        duration: note.duration,
        title: note.title,
        description: note.description,
      })
    }

    return { slots, minTime, minTrack }
  }

  private computeRepeatedSlots(
    notes: SelectionNoteRow[],
    request: NoteCopyPreviewRequest,
    minTime: number,
    minTrack: number,
  ): { slots: IncomingSlot[]; minTime: number; minTrack: number } {
    if (request.operation !== 'COPY') {
      throw new BadRequestException('REPEAT_INTERVAL only supports COPY operation')
    }

    const repeatCount = request.repeatCount ?? 0
    const repeatInterval = request.repeatInterval ?? 0

    if (!Number.isInteger(repeatCount) || repeatCount < 1) {
      throw new BadRequestException('repeatCount must be at least 1')
    }
    if (!Number.isFinite(repeatInterval) || repeatInterval <= 0) {
      throw new BadRequestException('repeatInterval must be greater than 0')
    }
    if (notes.length * repeatCount > MAX_NOTE_IDS) {
      throw new BadRequestException(`Cannot create more than ${MAX_NOTE_IDS} notes at once`)
    }

    const slots: IncomingSlot[] = []
    for (let repeatIndex = 1; repeatIndex <= repeatCount; repeatIndex++) {
      for (let sourceIndex = 0; sourceIndex < notes.length; sourceIndex++) {
        const note = notes[sourceIndex]
        const track = note.track
        const time = snapTime(note.time + repeatInterval * repeatIndex)
        this.assertDestinationInRange(track, time, note)

        slots.push({
          sourceIndex,
          sourceNoteId: note.id,
          track,
          time,
          noteType: note.noteType,
          duration: note.duration,
          title: note.title,
          description: note.description,
        })
      }
    }

    return { slots, minTime, minTrack }
  }

  private assertDestinationInRange(
    track: number,
    time: number,
    note: SelectionNoteRow,
  ): void {
    if (track < TRACK_MIN || track > TRACK_MAX) {
      throw new BadRequestException(`Track ${track} is out of range`)
    }
    if (time < TIME_MIN || time > TIME_MAX) {
      throw new BadRequestException(`Time ${time} is out of range`)
    }
    if (note.noteType === 'HOLD' && note.duration != null && note.duration > 0) {
      const endTime = snapTime(time + note.duration)
      if (endTime > TIME_MAX) {
        throw new BadRequestException(`HOLD end time ${endTime} is out of range`)
      }
    }
  }

  private async buildPreview(
    songId: string,
    chartId: string,
    notes: SelectionNoteRow[],
    request: NoteCopyPreviewRequest,
  ): Promise<NoteCopyPreview> {
    const { slots, minTime } = this.computeTransformedSlots(notes, request)

    const tracks = [...new Set(slots.map((slot) => slot.track))]
    const existingRows = tracks.length === 0
      ? []
      : await this.prisma.note.findMany({
          where: {
            chartId,
            deletedAt: null,
            track: { in: tracks },
          },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })

    const existingSlots: ExistingSlotRow[] = existingRows.map((row) => ({
      id: row.id,
      track: row.track,
      time: row.time,
      noteType: row.noteType,
      duration: row.duration,
    }))

    const existingById = new Map(existingRows.map((row) => [row.id, row]))

    const excludeIds =
      request.operation === 'MOVE'
        ? new Set(notes.map((note) => note.id))
        : new Set<string>()

    const classified = classifySlots(slots, existingSlots, excludeIds, minTime)

    if (classified.internalCollision) {
      throw new UnprocessableEntityException('Selection maps to overlapping destination slots')
    }

    const creatable: PlacementCreatableSlot[] = classified.creatable
    const conflicts: PlacementConflict[] = classified.conflicts.map((conflict) => {
      const existing = existingById.get(conflict.conflictId)!
      return {
        conflictId: conflict.conflictId,
        sourceIndex: conflict.sourceIndex,
        sourceNoteId: conflict.sourceNoteId,
        track: conflict.track,
        time: conflict.time,
        incomingNote: conflict.incomingNote,
        existingNote: {
          id: existing.id,
          title: existing.title,
          description: existing.description,
          track: existing.track,
          time: existing.time,
          noteType: existing.noteType as Note['noteType'],
          duration: existing.duration ?? undefined,
          createdBy: existing.createdBy,
          creatorName: existing.creator?.name ?? '',
          creatorAvatarUrl: existing.creator?.avatarUrl ?? undefined,
          createdAt: existing.createdAt.toISOString(),
        },
      }
    })

    const affectedExisting = new Set(conflicts.map((conflict) => conflict.conflictId))

    return {
      songId,
      selectionVersion: this.buildSelectionVersion(notes, request),
      operation: request.operation,
      mode: request.mode,
      summary: {
        totalNotes: slots.length,
        creatableNotes: creatable.length,
        conflictCount: conflicts.length,
        affectedExistingNotes: affectedExisting.size,
      },
      creatable,
      conflicts,
    }
  }

  private toDomainNote(row: {
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
      id: row.id,
      songId: row.songId,
      chartId: row.chartId,
      track: row.track,
      time: row.time,
      title: row.title,
      description: row.description,
      createdBy: row.createdBy,
      creatorName: row.creator?.name ?? '',
      creatorAvatarUrl: row.creator?.avatarUrl ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      noteType: (row.noteType as Note['noteType']) ?? 'TAP',
      duration: row.duration ?? undefined,
    }
  }

  private async resolveChart(chartId: string, user: AuthUser) {
    const chart = await this.prisma.songChart.findUnique({
      where: { id: chartId },
      select: { songId: true },
    })
    if (!chart) throw new NotFoundException('Chart not found')
    await this.access.assertCanEditSongChart(chart.songId, user)
    return { chartId, songId: chart.songId }
  }
}
