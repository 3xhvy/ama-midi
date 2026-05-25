import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { randomUUID } from 'crypto'
import { LLM_ADAPTER, type LLMAdapter } from './adapters/llm-adapter.interface'
import {
  NOTE_EVENTS,
  SNAP_RESOLUTION,
  TIME_MAX,
  TIME_MIN,
  TRACK_MAX,
  TRACK_MIN,
  snapTime,
  findOverlapping,
  type AiChartContext,
  type ApplyChartResponse,
  type AuthUser,
  type ChartApplyPreview,
  type ConflictAction,
  type GeneratedChartNote,
  type GeneratedChartSection,
  type GenerateChartResponse,
  type Note,
  type NoteCreatedEvent,
  type NoteDeletedEvent,
  type NotesBatchAppliedPayload,
  type SnapMode,
  type SongDifficulty,
} from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { mapPrismaToHttpException } from '../../common/prisma-error.util'
import { ProjectAccessService } from '../project-access/project-access.service'
import { EditorCommandService } from '../editor-commands/editor-command.service'
import { ChartAnalyzeService } from '../charts/chart-analyze.service'
import { AI_STREAM_STEPS, type AiProgressEmitter, runStep, emitDetail } from './ai-progress.util'
import { ChartContextService } from './chart-context.service'
import { ChartApplyPreviewService } from './chart-apply-preview.service'
import { buildGeneratePrompt, serializeChartContextForPrompt, CHART_NOTE_TYPE_INSTRUCTIONS, CHART_JSON_EXAMPLE } from './chart-context.prompt'
import { assertNoFinalCreateOverlaps } from '../notes/note-slot-preview'
import type { NoteSlot } from '../notes/note-overlap'
import type { ApplyChartDto, GenerateChartDto, PreviewChartDto } from './dto/chart.dto'

const MAX_GENERATED_NOTES = 150
const NOTE_TYPES = new Set(['TAP', 'HOLD'])

const TARGET_NOTE_COUNT: Record<string, number> = {
  EASY: 50,
  NORMAL: 90,
  HARD: 130,
  EXPERT: 150,
  MASTER: 150,
}

@Injectable()
export class AiChartService {
  private readonly logger = new Logger(AiChartService.name)

  constructor(
    @Inject(LLM_ADAPTER) private readonly llm: LLMAdapter,
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly eventEmitter: EventEmitter2,
    private readonly chartContext: ChartContextService,
    private readonly chartApplyPreview: ChartApplyPreviewService,
    private readonly editorCommands: EditorCommandService,
    private readonly analyze: ChartAnalyzeService,
  ) {}

  async generateChart(
    songId: string,
    user: AuthUser | string,
    body: GenerateChartDto,
    onProgress?: AiProgressEmitter,
  ): Promise<GenerateChartResponse> {
    const userRole = typeof user === 'string' ? user : user.role
    if (userRole === 'VIEWER') throw new ForbiddenException('VIEWER cannot use AI chart generation')
    if (typeof user !== 'string') {
      await this.access.assertCanEditSongChart(songId, user)
    }

    const steps = AI_STREAM_STEPS['generate-chart']

    const ctx = await runStep(steps, 'load_chart', onProgress, () =>
      this.chartContext.loadChartContext(songId, body.chartId),
    )

    const targetCount = body.targetTier ? TARGET_NOTE_COUNT[body.targetTier] ?? 90 : 90

    const prompt = await runStep(steps, 'build_prompt', onProgress, async () => {
      const description = body.description.trim()
      if (!description) throw new BadRequestException('Description is required')
      return buildGeneratePrompt({
        ctx,
        description,
        snapHint: this.snapHint(body.snapMode, ctx.song.bpm),
        targetCount,
        targetTier: body.targetTier,
        replaceExisting: body.replaceExisting,
        createAsNewChart: body.createAsNewChart,
        useReferenceChart: body.useReferenceChart,
      })
    })

    const parsed = await runStep(steps, 'generate', onProgress, async () => {
      emitDetail(steps, 'generate', `Sending your brief to AI — aiming for ~${targetCount} notes…`, onProgress)
      const result = await this.callClaudeForChart(prompt, 'generate')
      emitDetail(steps, 'generate', `AI returned ${(result.notes as unknown[]).length} note ideas`, onProgress)
      return result
    })

    const notes = await runStep(steps, 'normalize', onProgress, async () => {
      const normalized = this.normalizeGeneratedNotes(parsed.notes, body.snapMode, ctx.song.bpm)
      emitDetail(steps, 'normalize', `Kept ${normalized.length} note${normalized.length !== 1 ? 's' : ''} after cleanup`, onProgress)
      return normalized
    })
    const sections = this.normalizeSections(parsed.sections)

    const readyDef = steps.find((s) => s.stepId === 'ready')!
    onProgress?.({ type: 'step', stepId: 'ready', label: readyDef.label, status: 'done' })

    return { notes, sections }
  }

  async scaleChart(
    songId: string,
    user: AuthUser | string,
    body: { chartId: string; targetTier: SongDifficulty; instruction?: string; snapMode: SnapMode },
    onProgress?: AiProgressEmitter,
  ): Promise<GenerateChartResponse> {
    const userRole = typeof user === 'string' ? user : user.role
    if (userRole === 'VIEWER') throw new ForbiddenException('VIEWER cannot use AI chart scaling')
    if (typeof user !== 'string') {
      await this.access.assertCanEditSongChart(songId, user)
    }

    const steps = AI_STREAM_STEPS['scale-chart']

    const targetCount = TARGET_NOTE_COUNT[body.targetTier] ?? 90

    const ctx = await runStep(steps, 'load_chart', onProgress, async () => {
      const loaded = await this.chartContext.loadChartContext(songId, body.chartId)
      if (loaded.notes.length === 0) throw new BadRequestException('Cannot scale an empty chart')
      return loaded
    })

    const prompt = await runStep(steps, 'build_prompt', onProgress, async () =>
      this.buildScalePrompt(ctx, body.targetTier, targetCount, body.instruction?.trim(), body.snapMode),
    )

    const parsed = await runStep(steps, 'generate', onProgress, async () => {
      emitDetail(steps, 'generate', `Asking AI to rewrite chart for ${body.targetTier} (~${targetCount} notes)…`, onProgress)
      const result = await this.callClaudeForChart(prompt, 'scale')
      emitDetail(steps, 'generate', `AI returned ${(result.notes as unknown[]).length} note ideas`, onProgress)
      return result
    })

    const notes = await runStep(steps, 'normalize', onProgress, async () => {
      const normalized = this.normalizeGeneratedNotes(parsed.notes, body.snapMode, ctx.song.bpm)
      emitDetail(steps, 'normalize', `Kept ${normalized.length} note${normalized.length !== 1 ? 's' : ''} after cleanup`, onProgress)
      return normalized
    })
    const sections = this.normalizeSections(parsed.sections)

    const readyDef = steps.find((s) => s.stepId === 'ready')!
    onProgress?.({ type: 'step', stepId: 'ready', label: readyDef.label, status: 'done' })

    return { notes, sections }
  }

  async previewChart(
    songId: string,
    user: AuthUser,
    chartId: string,
    body: PreviewChartDto,
  ): Promise<ChartApplyPreview> {
    await this.access.assertCanEditSongChart(songId, user)
    return this.chartApplyPreview.buildPreview(songId, chartId, body.notes, body.replaceExisting)
  }

  async applyChart(
    songId: string,
    user: AuthUser,
    body: ApplyChartDto,
  ): Promise<ApplyChartResponse> {
    await this.access.assertCanEditSongChart(songId, user)
    const chart = await this.prisma.songChart.findFirst({
      where: { id: body.chartId, songId },
      select: { id: true },
    })
    if (!chart) throw new NotFoundException('Chart not found')
    const chartId = chart.id

    if (body.notes.length === 0) throw new BadRequestException('No notes to apply')
    if (body.notes.length > MAX_GENERATED_NOTES) {
      throw new BadRequestException(`Cannot apply more than ${MAX_GENERATED_NOTES} notes at once`)
    }

    let result: ApplyChartResponse
    if (body.replaceExisting) {
      result = await this.applyChartReplace(songId, user, chartId, body)
    } else if (body.resolutions?.length || body.previewVersion) {
      result = await this.applyChartMergeWithResolutions(songId, user, chartId, body)
    } else {
      result = await this.applyChartMergeSimple(songId, user, chartId, body)
    }

    this.analyze.scheduleRun(chartId)
    return result
  }

  private async applyChartReplace(
    songId: string,
    user: AuthUser,
    chartId: string,
    body: ApplyChartDto,
  ): Promise<ApplyChartResponse> {
    const batchId = randomUUID()
    const deletedIds: string[] = []
    const deletedBeforeStates: Array<{ noteId: string; beforeState: Note }> = []
    const createdEntries: Note[] = []

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.note.findMany({
        where: { chartId, deletedAt: null },
        include: { creator: { select: { name: true, avatarUrl: true } } },
      })
      for (const note of existing) {
        deletedBeforeStates.push({ noteId: note.id, beforeState: this.toNote(note) })
        deletedIds.push(note.id)
      }
      if (deletedIds.length > 0) {
        await tx.note.updateMany({
          where: { id: { in: deletedIds } },
          data: { deletedAt: new Date() },
        })
      }
      await tx.sectionMarker.deleteMany({ where: { songId } })

      for (const draft of body.notes) {
        const row = await this.createChartNote(tx, songId, chartId, user.id, draft)
        if (row) createdEntries.push(row)
      }

      if (body.sections?.length) {
        await tx.sectionMarker.createMany({
          data: body.sections.map((s) => ({
            songId,
            time: Math.round(s.time * 10) / 10,
            label: s.label.trim(),
            color: s.color ?? '#6C63FF',
            createdBy: user.id,
          })),
        })
      }
    })

    const cmd = await this.editorCommands.record({
      songId,
      chartId,
      commandType: 'AI_NOTES_APPLIED',
      userId: user.id,
      summary: { createdCount: createdEntries.length, removedCount: deletedIds.length, batchId, mode: 'replace' },
    })

    this.emitBatchEvents(songId, user.id, batchId, createdEntries, deletedBeforeStates, cmd.id)

    return {
      batchId,
      createdCount: createdEntries.length,
      skippedCount: 0,
      sectionsCreated: body.sections?.length ?? 0,
      replacedCount: deletedIds.length,
    }
  }

  private async applyChartMergeSimple(
    songId: string,
    user: AuthUser,
    chartId: string,
    body: ApplyChartDto,
  ): Promise<ApplyChartResponse> {
    const batchId = randomUUID()
    const createdEntries: Note[] = []
    let skippedCount = 0

    await this.prisma.$transaction(async (tx) => {
      const activeExisting: NoteSlot[] = await tx.note.findMany({
        where: { chartId, deletedAt: null },
        select: { track: true, time: true, noteType: true, duration: true },
      })
      const pendingCreates: NoteSlot[] = []

      for (const draft of body.notes) {
        const track = draft.track
        const time = Math.round(draft.time * 10) / 10
        const noteType = draft.noteType ?? 'TAP'
        const duration = noteType === 'HOLD' ? draft.duration ?? null : null

        if (track < TRACK_MIN || track > TRACK_MAX) { skippedCount++; continue }
        if (time < TIME_MIN || time > TIME_MAX) { skippedCount++; continue }
        if (!NOTE_TYPES.has(noteType)) { skippedCount++; continue }
        if (noteType === 'HOLD' && (draft.duration == null || draft.duration <= 0)) { skippedCount++; continue }

        const candidate: NoteSlot = { track, time, noteType, duration }
        if (findOverlapping(candidate, [...activeExisting, ...pendingCreates])) {
          skippedCount++
          continue
        }
        pendingCreates.push(candidate)

        try {
          const row = await this.createChartNote(tx, songId, chartId, user.id, draft)
          if (row) createdEntries.push(row)
        } catch (e: unknown) {
          if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002') {
            skippedCount++
            continue
          }
          const mapped = mapPrismaToHttpException(e)
          if (mapped) throw mapped
          throw e
        }
      }

      if (body.sections?.length) {
        await tx.sectionMarker.createMany({
          data: body.sections.map((s) => ({
            songId,
            time: Math.round(s.time * 10) / 10,
            label: s.label.trim(),
            color: s.color ?? '#6C63FF',
            createdBy: user.id,
          })),
        })
      }
    })

    const cmd = await this.editorCommands.record({
      songId,
      chartId,
      commandType: 'AI_NOTES_APPLIED',
      userId: user.id,
      summary: { createdCount: createdEntries.length, removedCount: 0, batchId, mode: 'merge' },
    })

    this.emitBatchEvents(songId, user.id, batchId, createdEntries, [], cmd.id)

    return {
      batchId,
      createdCount: createdEntries.length,
      skippedCount,
      sectionsCreated: body.sections?.length ?? 0,
      replacedCount: 0,
    }
  }

  private async applyChartMergeWithResolutions(
    songId: string,
    user: AuthUser,
    chartId: string,
    body: ApplyChartDto,
  ): Promise<ApplyChartResponse> {
    if (body.previewVersion) {
      const ctx = await this.chartContext.loadChartContext(songId, chartId)
      const currentVersion = this.chartContext.previewVersion(ctx)
      if (body.previewVersion !== currentVersion) {
        const preview = await this.chartApplyPreview.buildPreview(songId, chartId, body.notes, false)
        throw new ConflictException({ preview })
      }
    }

    const preview = await this.chartApplyPreview.buildPreview(songId, chartId, body.notes, false)
    if (body.resolutions?.length) {
      this.chartApplyPreview.assertResolutionsMatchPreview(preview, body.resolutions)
    }

    const resolutionMap = new Map<string, ConflictAction>(
      (body.resolutions ?? []).map((resolution) => [resolution.conflictId, resolution.action]),
    )
    const batchId = randomUUID()
    const deletedIds: string[] = []
    const createdEntries: Array<{ note: Note; replacesNoteId?: string }> = []
    const deletedBeforeStates: Array<{ noteId: string; beforeState: Note }> = []
    let skippedCount = 0

    await this.prisma.$transaction(async (tx) => {
      const classified = await this.chartApplyPreview.classifyForMerge(chartId, body.notes, tx)

      if (body.resolutions?.length) {
        this.chartApplyPreview.assertResolutionsMatchClassification(classified, body.resolutions)
      }

      skippedCount = classified.conflicts.length

      for (const conflict of classified.conflicts) {
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
          beforeState: this.toNote(existing),
        })
      }

      skippedCount -= deletedIds.length

      const notesToCreate: Array<{
        track: number
        time: number
        noteType: string
        duration?: number
        title: string
        replacesNoteId?: string
      }> = classified.creatable.map((slot) => ({
        track: slot.track,
        time: slot.time,
        noteType: slot.noteType,
        duration: slot.duration,
        title: slot.title,
      }))
      for (const conflict of classified.conflicts) {
        if (resolutionMap.get(conflict.conflictId) !== 'REPLACE_WITH_PATTERN') continue
        notesToCreate.push({
          track: conflict.track,
          time: conflict.time,
          noteType: conflict.incomingNote.noteType,
          duration: conflict.incomingNote.duration,
          title: conflict.incomingNote.title,
          replacesNoteId: conflict.conflictId,
        })
      }

      const affectedTracks = [...new Set(notesToCreate.map((slot) => slot.track))]
      const deletedIdSet = new Set(deletedIds)
      const activeExisting: NoteSlot[] = affectedTracks.length === 0
        ? []
        : (await tx.note.findMany({
            where: { chartId, deletedAt: null, track: { in: affectedTracks } },
          }))
            .filter((row) => !deletedIdSet.has(row.id))
            .map((row) => ({
              track: row.track,
              time: row.time,
              noteType: row.noteType,
              duration: row.duration,
            }))

      assertNoFinalCreateOverlaps(notesToCreate, activeExisting)

      for (const slot of notesToCreate) {
        const row = await this.createChartNote(tx, songId, chartId, user.id, {
          track: slot.track,
          time: slot.time,
          noteType: slot.noteType as GeneratedChartNote['noteType'],
          duration: slot.duration,
          title: slot.title,
        })
        if (row) {
          createdEntries.push({ note: row, replacesNoteId: slot.replacesNoteId })
        }
      }

      if (body.sections?.length) {
        await tx.sectionMarker.createMany({
          data: body.sections.map((s) => ({
            songId,
            time: Math.round(s.time * 10) / 10,
            label: s.label.trim(),
            color: s.color ?? '#6C63FF',
            createdBy: user.id,
          })),
        })
      }
    })

    const createdNotes = createdEntries.map((entry) => entry.note)

    const cmd = await this.editorCommands.record({
      songId,
      chartId,
      commandType: 'AI_NOTES_APPLIED',
      userId: user.id,
      summary: { createdCount: createdNotes.length, removedCount: deletedIds.length, batchId, mode: 'merge-resolutions' },
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

    if (createdNotes.length > 0 || deletedIds.length > 0) {
      this.eventEmitter.emit(NOTE_EVENTS.BATCH_APPLIED, {
        songId,
        batchId,
        created: createdNotes,
        deletedIds,
        actorId: user.id,
      } satisfies NotesBatchAppliedPayload)
    }

    return {
      batchId,
      createdCount: createdNotes.length,
      replacedCount: deletedIds.length,
      skippedCount,
      sectionsCreated: body.sections?.length ?? 0,
    }
  }

  private async createChartNote(
    tx: Pick<PrismaService, 'note'>,
    songId: string,
    chartId: string,
    userId: string,
    draft: GeneratedChartNote,
  ): Promise<Note | null> {
    const track = draft.track
    const time = Math.round(draft.time * 10) / 10
    const noteType = draft.noteType ?? 'TAP'

    if (track < TRACK_MIN || track > TRACK_MAX) return null
    if (time < TIME_MIN || time > TIME_MAX) return null
    if (!NOTE_TYPES.has(noteType)) return null
    if (noteType === 'HOLD' && (draft.duration == null || draft.duration <= 0)) return null

    const row = await tx.note.create({
      data: {
        chartId,
        songId,
        track,
        time,
        title: draft.title?.trim() || 'AI Chart',
        description: '',
        noteType: noteType as 'TAP' | 'HOLD',
        duration: noteType === 'HOLD' ? draft.duration! : null,
        createdBy: userId,
      },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })

    return this.toNote(row)
  }

  private emitBatchEvents(
    songId: string,
    userId: string,
    batchId: string,
    createdEntries: Note[],
    deletedBeforeStates: Array<{ noteId: string; beforeState: Note }>,
    commandId: string,
  ): void {
    const deletedIds = deletedBeforeStates.map((entry) => entry.noteId)

    for (const { noteId, beforeState } of deletedBeforeStates) {
      this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
        songId,
        noteId,
        userId,
        beforeState,
        batchId,
        replacedByBatch: true,
        realtimeMode: 'batch',
        commandId,
      } satisfies NoteDeletedEvent)
    }

    for (const note of createdEntries) {
      this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
        songId,
        noteId: note.id,
        userId,
        afterState: note,
        batchId,
        realtimeMode: 'batch',
        commandId,
      } satisfies NoteCreatedEvent)
    }

    if (createdEntries.length > 0 || deletedIds.length > 0) {
      this.eventEmitter.emit(NOTE_EVENTS.BATCH_APPLIED, {
        songId,
        batchId,
        created: createdEntries,
        deletedIds,
        actorId: userId,
      } satisfies NotesBatchAppliedPayload)
    }
  }

  private snapHint(snapMode: SnapMode, bpm: number): string {
    return snapMode === '0.1s'
      ? `${SNAP_RESOLUTION}s steps`
      : snapMode === 'beat'
        ? `quarter notes at ${bpm} BPM`
        : `eighth notes at ${bpm} BPM`
  }

  private buildScalePrompt(
    ctx: AiChartContext,
    targetTier: SongDifficulty,
    targetCount: number,
    instruction: string | undefined,
    snapMode: SnapMode,
  ): { system: string; user: string } {
    const snapHint = this.snapHint(snapMode, ctx.song.bpm)
    const contextBlock = serializeChartContextForPrompt(ctx, { mode: 'scale', snapHint })

    const system = [
      'You are a rhythm-game chart arranger for AMA-MIDI.',
      'Charts use 8 lanes (tracks 1-8), timeline 0-300 seconds.',
      CHART_NOTE_TYPE_INSTRUCTIONS,
      'Return ONLY valid JSON with keys "notes" and "sections". No markdown.',
      'The returned chart is a full replacement, not a patch.',
    ].join(' ')

    const user = [
      contextBlock,
      `Target tier: ${targetTier}. Target about ${targetCount} notes, never more than ${MAX_GENERATED_NOTES}.`,
      `Snap all times to ${snapHint}. Avoid duplicate track+time pairs.`,
      instruction ? `User instruction: ${instruction}.` : null,
      'Preserve recognizable timing motifs and song structure.',
      'For easier targets: thin density, reduce large lane jumps, reduce simultaneous notes, and simplify holds.',
      'For harder targets: add notes, controlled doubles, holds, and syncopation while preserving musical feel.',
      `JSON shape: ${CHART_JSON_EXAMPLE}`,
    ].filter(Boolean).join(' ')

    return { system, user }
  }

  private async callClaudeForChart(prompt: { system: string; user: string }, operation: 'generate' | 'scale') {
    try {
      const text = await this.llm.complete({
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        maxTokens: 8192,
      })
      return this.parseChartJson(text || '{}')
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      this.logger.error(`LLM chart ${operation} failed`, detail)
      throw new ServiceUnavailableException(`AI chart ${operation} failed — try again in a moment.`)
    }
  }

  private parseChartJson(text: string): { notes: unknown[]; sections: unknown[] } {
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const parsed = JSON.parse(jsonText) as {
        notes?: unknown
        sections?: unknown
      }
      return {
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      }
    } catch {
      return { notes: [], sections: [] }
    }
  }

  private normalizeGeneratedNotes(
    raw: unknown[],
    snapMode: SnapMode,
    bpm: number,
  ): GeneratedChartNote[] {
    const accepted: Array<{ track: number; time: number; noteType: string; duration: number | null }> = []
    const out: GeneratedChartNote[] = []

    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue
      const row = item as Record<string, unknown>
      if (!Number.isInteger(row.track) || typeof row.time !== 'number') continue

      const track = row.track as number
      let time = snapTime(row.time as number, snapMode, bpm)
      time = Math.round(time * 10) / 10

      let duration = this.readDuration(row)
      let noteType = this.parseNoteType(row)
      if (!noteType && duration != null && duration > 0) noteType = 'HOLD'
      if (!noteType) noteType = 'TAP'

      if (track < TRACK_MIN || track > TRACK_MAX) continue
      if (time < TIME_MIN || time > TIME_MAX) continue
      if (!NOTE_TYPES.has(noteType)) continue

      if (noteType === 'HOLD') {
        if (duration == null || duration <= 0) {
          duration = this.defaultHoldDuration(bpm)
        }
        duration = Math.round(duration * 10) / 10
      } else {
        duration = undefined
      }

      const candidate = {
        track,
        time,
        noteType,
        duration: noteType === 'HOLD' ? duration ?? null : null,
      }
      if (findOverlapping(candidate, accepted)) continue
      accepted.push(candidate)

      out.push({
        track,
        time,
        noteType: noteType as GeneratedChartNote['noteType'],
        duration,
        title: typeof row.title === 'string' ? row.title.slice(0, 120) : undefined,
      })

      if (out.length >= MAX_GENERATED_NOTES) break
    }

    return out.sort((a, b) => a.time - b.time || a.track - b.track)
  }

  private parseNoteType(row: Record<string, unknown>): string | null {
    const raw = row.noteType ?? row.type ?? row.note_type
    if (typeof raw !== 'string') return null
    const upper = raw.trim().toUpperCase()
    if (upper === 'LONG' || upper === 'LONGPRESS') return 'HOLD'
    return NOTE_TYPES.has(upper) ? upper : null
  }

  private readDuration(row: Record<string, unknown>): number | undefined {
    const raw = row.duration ?? row.holdDuration ?? row.hold_duration
    return typeof raw === 'number' && raw > 0 ? raw : undefined
  }

  private defaultHoldDuration(bpm: number): number {
    const beat = Math.round((60 / Math.max(bpm, 1)) * 10) / 10
    return Math.max(0.3, beat)
  }

  private normalizeSections(raw: unknown[]): GeneratedChartSection[] {
    const seen = new Set<string>()
    const out: GeneratedChartSection[] = []

    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue
      const row = item as Record<string, unknown>
      if (typeof row.time !== 'number' || typeof row.label !== 'string') continue
      const label = row.label.trim()
      if (!label) continue
      const key = `${row.time.toFixed(1)}:${label}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        time: Math.max(TIME_MIN, Math.min(TIME_MAX, row.time)),
        label: label.slice(0, 60),
        color: typeof row.color === 'string' ? row.color : undefined,
      })
    }

    return out.sort((a, b) => a.time - b.time)
  }

  private slotKey(track: number, time: number): string {
    return `${track}:${time.toFixed(1)}`
  }

  private toNote(n: {
    id: string
    chartId: string
    songId: string
    track: number
    time: number
    title: string
    description: string
    createdBy: string
    noteType?: string | null
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
}
