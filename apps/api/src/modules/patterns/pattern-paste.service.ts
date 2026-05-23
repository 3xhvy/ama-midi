import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { findOverlapping, type NoteSlot } from '../notes/note-overlap'
import { NOTE_EVENTS, TIME_MAX, TIME_MIN, TRACK_MAX, TRACK_MIN } from '@ama-midi/shared'
import type {
  AuthUser,
  ConflictAction,
  Note,
  NotePattern,
  NoteCreatedEvent,
  NoteDeletedEvent,
  NotesBatchAppliedPayload,
  PatternNote,
  PatternPasteApplyRequest,
  PatternPasteApplyResult,
  PatternPasteConflict,
  PatternPasteCreatableNote,
  PatternPastePreview,
  PatternPastePreviewRequest,
} from '@ama-midi/shared'

const MAX_PATTERN_PASTE_NOTES = 500

function snapTime(time: number): number {
  return Math.round(time * 10) / 10
}

interface PatternSlot {
  patternNoteIndex: number
  track: number
  time: number
  noteType: string
  duration?: number
  timeOffset: number
}

interface ExistingNoteRow extends NoteSlot {
  id: string
  title: string
  description: string
  createdBy: string
  createdAt: Date
  creator?: { name: string; avatarUrl?: string | null }
}

@Injectable()
export class PatternPasteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async previewPaste(
    patternId: string,
    request: PatternPastePreviewRequest,
    user: AuthUser,
  ): Promise<PatternPastePreview> {
    await this.access.assertCanEditSongChart(request.songId, user)
    const pattern = await this.loadPattern(patternId)
    return this.buildPreview(pattern, request.songId, request.startTime)
  }

  async applyPaste(
    patternId: string,
    request: PatternPasteApplyRequest,
    user: AuthUser,
  ): Promise<PatternPasteApplyResult> {
    await this.access.assertCanEditSongChart(request.songId, user)
    const row = await this.loadPatternRow(patternId)
    const pattern = this.toDomainPattern(row)
    const patternVersion = this.getPatternVersion(row)

    if (request.patternVersion !== patternVersion) {
      const preview = await this.buildPreview(pattern, request.songId, request.startTime)
      throw new ConflictException({ error: 'PATTERN_VERSION_CHANGED', preview })
    }

    const preview = await this.buildPreview(pattern, request.songId, request.startTime)
    this.assertResolutionsMatchPreview(preview, request.resolutions)

    const resolutionMap = new Map(
      request.resolutions.map((resolution) => [resolution.conflictId, resolution.action]),
    )
    const batchId = randomUUID()
    const deletedIds: string[] = []
    const createdEntries: Array<{ note: Note; replacesNoteId?: string }> = []
    const deletedBeforeStates: Array<{ noteId: string; beforeState: Note }> = []

    await this.prisma.$transaction(async (tx) => {
      for (const conflict of preview.conflicts) {
        if (resolutionMap.get(conflict.conflictId) !== 'REPLACE_WITH_PATTERN') continue

        const existing = await tx.note.findFirst({
          where: { id: conflict.existingNote.id, songId: request.songId, deletedAt: null },
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

      const notesToCreate: Array<PatternPasteCreatableNote & { replacesNoteId?: string }> = [
        ...preview.creatable,
      ]

      for (const conflict of preview.conflicts) {
        if (resolutionMap.get(conflict.conflictId) !== 'REPLACE_WITH_PATTERN') continue
        notesToCreate.push({
          patternNoteIndex: conflict.patternNoteIndex,
          track: conflict.track,
          time: conflict.time,
          noteType: conflict.patternNote.noteType,
          duration: conflict.patternNote.duration,
          replacesNoteId: conflict.conflictId,
        })
      }

      for (const slot of notesToCreate) {
        const pn = pattern.notes[slot.patternNoteIndex]
        const createdRow = await tx.note.create({
          data: {
            songId: request.songId,
            track: slot.track,
            time: slot.time,
            title: `${pattern.name} ${slot.track}`,
            description: '',
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

    for (const { noteId, beforeState } of deletedBeforeStates) {
      this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
        songId: request.songId,
        noteId,
        userId: user.id,
        beforeState,
        batchId,
        replacedByBatch: true,
        realtimeMode: 'batch',
      } satisfies NoteDeletedEvent)
    }

    for (const { note, replacesNoteId } of createdEntries) {
      this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
        songId: request.songId,
        noteId: note.id,
        userId: user.id,
        afterState: note,
        batchId,
        replacesNoteId,
        realtimeMode: 'batch',
      } satisfies NoteCreatedEvent)
    }

    const created = createdEntries.map((entry) => entry.note)

    this.eventEmitter.emit(NOTE_EVENTS.BATCH_APPLIED, {
      songId: request.songId,
      batchId,
      created: created,
      deletedIds,
      actorId: user.id,
    } satisfies NotesBatchAppliedPayload)

    return {
      batchId,
      createdCount: created.length,
      replacedCount: deletedIds.length,
      skippedCount: preview.conflicts.length - deletedIds.length,
      notes: created,
    }
  }

  private assertResolutionsMatchPreview(
    preview: PatternPastePreview,
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

  private async loadPatternRow(patternId: string) {
    const row = await this.prisma.notePattern.findUnique({ where: { id: patternId } })
    if (!row) throw new NotFoundException('Pattern not found')
    return row
  }

  private async loadPattern(patternId: string): Promise<NotePattern> {
    return this.toDomainPattern(await this.loadPatternRow(patternId))
  }

  private getPatternVersion(row: { createdAt: Date; updatedAt?: Date | null }): string {
    return (row.updatedAt ?? row.createdAt).toISOString()
  }

  private toDomainPattern(row: {
    id: string
    name: string
    notes: unknown
    createdBy: string
    songId: string | null
    createdAt: Date
  }): NotePattern {
    return {
      id: row.id,
      name: row.name,
      notes: row.notes as PatternNote[],
      createdBy: row.createdBy,
      songId: row.songId,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private toPatternNoteSlots(
    pattern: NotePattern,
    startTime: number,
  ): PatternSlot[] {
    const snappedStart = snapTime(startTime)

    return pattern.notes.map((pn, patternNoteIndex) => {
      const time = snapTime(snappedStart + pn.timeOffset)

      if (pn.track < TRACK_MIN || pn.track > TRACK_MAX) {
        throw new BadRequestException(`Track ${pn.track} is out of range`)
      }
      if (time < TIME_MIN || time > TIME_MAX) {
        throw new BadRequestException(`Time ${time} is out of range`)
      }
      if (pn.noteType === 'HOLD' && (pn.duration == null || pn.duration <= 0)) {
        throw new BadRequestException('HOLD notes in pattern require duration > 0')
      }

      return {
        patternNoteIndex,
        track: pn.track,
        time,
        noteType: pn.noteType,
        duration: pn.duration,
        timeOffset: pn.timeOffset,
      }
    })
  }

  private async buildPreview(
    pattern: NotePattern,
    songId: string,
    startTime: number,
  ): Promise<PatternPastePreview> {
    if (pattern.notes.length > MAX_PATTERN_PASTE_NOTES) {
      throw new UnprocessableEntityException(`Pattern exceeds ${MAX_PATTERN_PASTE_NOTES} notes`)
    }

    const slots = this.toPatternNoteSlots(pattern, startTime)
    const snappedStart = snapTime(startTime)

    const tracks = [...new Set(slots.map((slot) => slot.track))]
    const existingRows = tracks.length === 0
      ? []
      : await this.prisma.note.findMany({
          where: {
            songId,
            deletedAt: null,
            track: { in: tracks },
          },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })

    const existingSlots: ExistingNoteRow[] = existingRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      creator: row.creator,
      track: row.track,
      time: row.time,
      noteType: row.noteType,
      duration: row.duration,
    }))

    const creatable: PatternPasteCreatableNote[] = []
    const conflicts: PatternPasteConflict[] = []
    const affectedExisting = new Set<string>()

    for (const slot of slots) {
      const candidate: NoteSlot = {
        track: slot.track,
        time: slot.time,
        noteType: slot.noteType,
        duration: slot.duration ?? null,
      }

      const overlap = findOverlapping(candidate, existingSlots)
      if (overlap) {
        affectedExisting.add(overlap.id)
        const pn = pattern.notes[slot.patternNoteIndex]
        conflicts.push({
          conflictId: overlap.id,
          patternNoteIndex: slot.patternNoteIndex,
          track: slot.track,
          time: slot.time,
          patternNote: {
            track: pn.track,
            timeOffset: pn.timeOffset,
            noteType: pn.noteType,
            duration: pn.duration,
          },
          existingNote: {
            id: overlap.id,
            title: overlap.title,
            description: overlap.description,
            track: overlap.track,
            time: overlap.time,
            noteType: overlap.noteType as Note['noteType'],
            duration: overlap.duration ?? undefined,
            createdBy: overlap.createdBy,
            creatorName: overlap.creator?.name ?? '',
            creatorAvatarUrl: overlap.creator?.avatarUrl ?? undefined,
            createdAt: overlap.createdAt.toISOString(),
          },
        })
      } else {
        creatable.push({
          patternNoteIndex: slot.patternNoteIndex,
          track: slot.track,
          time: slot.time,
          noteType: slot.noteType as Note['noteType'],
          duration: slot.duration,
        })
      }
    }

    return {
      patternId: pattern.id,
      patternVersion: pattern.createdAt,
      songId,
      startTime: snappedStart,
      summary: {
        totalPatternNotes: pattern.notes.length,
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
}
