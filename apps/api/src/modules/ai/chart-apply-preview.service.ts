import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common'
import {
  TIME_MAX,
  TIME_MIN,
  TRACK_MAX,
  TRACK_MIN,
  type ChartApplyPreview,
  type ChartApplyResolution,
  type ConflictAction,
  type GeneratedChartNote,
  type Note,
  type NoteType,
  type PlacementConflict,
  type PlacementCreatableSlot,
} from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { classifySlots, type IncomingSlot } from '../notes/note-slot-preview'
import type { NoteSlot } from '../notes/note-overlap'
import { ChartContextService } from './chart-context.service'

const MAX_GENERATED_NOTES = 150
const NOTE_TYPES = new Set(['TAP', 'HOLD', 'SWIPE'])

interface ExistingNoteRow extends NoteSlot {
  id: string
  title: string
  description: string
  createdBy: string
  createdAt: Date
  creator?: { name: string; avatarUrl?: string | null }
}

interface ExistingNoteQueryRow {
  id: string
  title: string
  description: string
  createdBy: string
  createdAt: Date
  track: number
  time: number
  noteType: string
  duration: number | null
  creator?: { name: string; avatarUrl?: string | null } | null
}

export interface ChartMergeClassification {
  creatable: PlacementCreatableSlot[]
  conflicts: PlacementConflict[]
}

type NotesQueryClient = Pick<PrismaService, 'note'>

@Injectable()
export class ChartApplyPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chartContext: ChartContextService,
  ) {}

  async buildPreview(
    songId: string,
    chartId: string,
    notes: GeneratedChartNote[],
    replaceExisting: boolean,
  ): Promise<ChartApplyPreview> {
    this.assertNoteCount(notes)
    const ctx = await this.chartContext.loadChartContext(songId, chartId)
    const previewVersion = this.chartContext.previewVersion(ctx)

    if (replaceExisting) {
      const incoming = this.toIncomingSlots(notes)
      return {
        songId,
        chartId,
        previewVersion,
        replaceExisting: true,
        summary: {
          totalNotes: incoming.length,
          creatableNotes: incoming.length,
          conflictCount: 0,
          affectedExistingNotes: 0,
        },
        creatable: incoming.map((slot) => this.toCreatableSlot(slot)),
        conflicts: [],
      }
    }

    const classified = await this.classifyForMerge(chartId, notes, this.prisma)
    return {
      songId,
      chartId,
      previewVersion,
      replaceExisting: false,
      summary: {
        totalNotes: classified.incomingCount,
        creatableNotes: classified.creatable.length,
        conflictCount: classified.conflicts.length,
        affectedExistingNotes: new Set(classified.conflicts.map((c) => c.conflictId)).size,
      },
      creatable: classified.creatable,
      conflicts: classified.conflicts,
    }
  }

  async classifyForMerge(
    chartId: string,
    notes: GeneratedChartNote[],
    client: NotesQueryClient = this.prisma,
  ): Promise<ChartMergeClassification & { incomingCount: number }> {
    const incoming = this.toIncomingSlots(notes)
    if (incoming.length === 0) {
      return { creatable: [], conflicts: [], incomingCount: 0 }
    }

    const tracks = [...new Set(incoming.map((slot) => slot.track))]
    const existingRows: ExistingNoteQueryRow[] = tracks.length === 0
      ? []
      : await client.note.findMany({
          where: {
            chartId,
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
      creator: row.creator ?? undefined,
      track: row.track,
      time: row.time,
      noteType: row.noteType,
      duration: row.duration,
    }))

    const existingById = new Map(existingRows.map((row) => [row.id, row]))
    const classified = classifySlots(incoming, existingSlots, new Set(), 0)

    if (classified.internalCollision) {
      throw new UnprocessableEntityException('Generated chart notes collide at the same track and time')
    }

    const creatable: PlacementCreatableSlot[] = classified.creatable.map((slot) => ({
      sourceIndex: slot.sourceIndex,
      sourceNoteId: slot.sourceNoteId,
      track: slot.track,
      time: slot.time,
      noteType: slot.noteType,
      duration: slot.duration,
      title: slot.title,
      description: slot.description,
    }))

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

    return {
      creatable,
      conflicts,
      incomingCount: incoming.length,
    }
  }

  assertResolutionsMatchPreview(
    preview: ChartApplyPreview,
    resolutions: ChartApplyResolution[],
  ): void {
    const currentIds = new Set(preview.conflicts.map((conflict) => conflict.conflictId))
    const requestedIds = new Set(resolutions.map((resolution) => resolution.conflictId))

    const idsMatch =
      currentIds.size === requestedIds.size &&
      [...currentIds].every((id) => requestedIds.has(id))

    if (!idsMatch) {
      throw new ConflictException({ preview })
    }
  }

  assertResolutionsMatchClassification(
    classification: ChartMergeClassification,
    resolutions: ChartApplyResolution[],
  ): void {
    const currentIds = new Set(classification.conflicts.map((conflict) => conflict.conflictId))
    const requestedIds = new Set(resolutions.map((resolution) => resolution.conflictId))

    const idsMatch =
      currentIds.size === requestedIds.size &&
      [...currentIds].every((id) => requestedIds.has(id))

    if (!idsMatch) {
      throw new ConflictException({ error: 'CONFLICTS_CHANGED' })
    }
  }

  private assertNoteCount(notes: GeneratedChartNote[]): void {
    if (notes.length === 0) throw new BadRequestException('No notes to preview')
    if (notes.length > MAX_GENERATED_NOTES) {
      throw new BadRequestException(`Cannot preview more than ${MAX_GENERATED_NOTES} notes at once`)
    }
  }

  private toIncomingSlots(notes: GeneratedChartNote[]): IncomingSlot[] {
    const out: IncomingSlot[] = []

    for (let index = 0; index < notes.length; index++) {
      const draft = notes[index]
      const track = draft.track
      const time = Math.round(draft.time * 10) / 10
      const noteType = draft.noteType ?? 'TAP'

      if (track < TRACK_MIN || track > TRACK_MAX) continue
      if (time < TIME_MIN || time > TIME_MAX) continue
      if (!NOTE_TYPES.has(noteType)) continue
      if (noteType === 'HOLD' && (draft.duration == null || draft.duration <= 0)) continue

      out.push({
        sourceIndex: index,
        sourceNoteId: String(index),
        track,
        time,
        noteType,
        duration: noteType === 'HOLD' ? draft.duration! : null,
        title: draft.title?.trim() || 'AI Chart',
        description: '',
      })
    }

    return out
  }

  private toCreatableSlot(slot: IncomingSlot): PlacementCreatableSlot {
    return {
      sourceIndex: slot.sourceIndex,
      sourceNoteId: slot.sourceNoteId,
      track: slot.track,
      time: slot.time,
      noteType: slot.noteType as NoteType,
      duration: slot.duration ?? undefined,
      title: slot.title,
      description: slot.description,
    }
  }
}
