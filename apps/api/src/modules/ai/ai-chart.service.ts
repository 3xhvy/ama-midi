import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import {
  NOTE_EVENTS,
  SNAP_RESOLUTION,
  TIME_MAX,
  TIME_MIN,
  TRACK_MAX,
  TRACK_MIN,
  measureDuration,
  snapTime,
  type ApplyChartResponse,
  type AuthUser,
  type GeneratedChartNote,
  type GeneratedChartSection,
  type GenerateChartResponse,
  type Note,
  type NoteCreatedEvent,
  type NoteDeletedEvent,
  type NotesBatchAppliedPayload,
  type SnapMode,
} from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'

const MAX_GENERATED_NOTES = 150
const NOTE_TYPES = new Set(['TAP', 'HOLD', 'SWIPE'])

const TARGET_NOTE_COUNT: Record<string, number> = {
  EASY: 50,
  NORMAL: 90,
  HARD: 130,
  EXPERT: 150,
  MASTER: 150,
}

@Injectable()
export class AiChartService {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async generateChart(
    songId: string,
    userRole: string,
    body: { description: string; snapMode: SnapMode; targetTier?: keyof typeof TARGET_NOTE_COUNT },
  ): Promise<GenerateChartResponse> {
    if (userRole === 'VIEWER') throw new ForbiddenException('VIEWER cannot use AI chart generation')

    const song = await this.prisma.song.findUnique({ where: { id: songId } })
    if (!song) throw new NotFoundException('Song not found')

    const description = body.description.trim()
    if (!description) throw new BadRequestException('Description is required')

    const targetCount = body.targetTier ? TARGET_NOTE_COUNT[body.targetTier] ?? 90 : 90
    const prompt = this.buildGeneratePrompt(song, description, body.snapMode, targetCount, body.targetTier)
    const parsed = await this.callClaudeForChart(prompt)
    const notes = this.normalizeGeneratedNotes(parsed.notes, body.snapMode, song.bpm)
    const sections = this.normalizeSections(parsed.sections)

    return { notes, sections }
  }

  async applyChart(
    songId: string,
    user: AuthUser,
    body: {
      notes: GeneratedChartNote[]
      sections?: GeneratedChartSection[]
      replaceExisting: boolean
    },
  ): Promise<ApplyChartResponse> {
    await this.access.assertCanEditSongChart(songId, user)
    const chart = await this.prisma.songChart.findFirst({
      where: { songId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!chart) throw new NotFoundException('No chart found for song')
    const chartId = chart.id

    if (body.notes.length === 0) throw new BadRequestException('No notes to apply')
    if (body.notes.length > MAX_GENERATED_NOTES) {
      throw new BadRequestException(`Cannot apply more than ${MAX_GENERATED_NOTES} notes at once`)
    }

    const batchId = randomUUID()
    const deletedIds: string[] = []
    const createdEntries: Note[] = []
    let skippedCount = 0

    await this.prisma.$transaction(async (tx) => {
      if (body.replaceExisting) {
        const existing = await tx.note.findMany({
          where: { chartId, deletedAt: null },
        })
        for (const note of existing) {
          await tx.note.update({
            where: { id: note.id },
            data: { deletedAt: new Date() },
          })
          deletedIds.push(note.id)
        }
        await tx.sectionMarker.deleteMany({ where: { songId } })
      }

      const occupied = new Set<string>()
      if (!body.replaceExisting) {
        const current = await tx.note.findMany({
          where: { chartId, deletedAt: null },
          select: { track: true, time: true },
        })
        for (const n of current) occupied.add(this.slotKey(n.track, n.time))
      }

      for (const draft of body.notes) {
        const track = draft.track
        const time = Math.round(draft.time * 10) / 10
        const noteType = draft.noteType ?? 'TAP'
        const key = this.slotKey(track, time)

        if (track < TRACK_MIN || track > TRACK_MAX) { skippedCount++; continue }
        if (time < TIME_MIN || time > TIME_MAX) { skippedCount++; continue }
        if (!NOTE_TYPES.has(noteType)) { skippedCount++; continue }
        if (noteType === 'HOLD' && (draft.duration == null || draft.duration <= 0)) { skippedCount++; continue }
        if (occupied.has(key)) { skippedCount++; continue }

        occupied.add(key)

        try {
          const row = await tx.note.create({
            data: {
              chartId,
              songId,
              track,
              time,
              title: draft.title?.trim() || 'AI Chart',
              description: '',
              noteType: noteType as 'TAP' | 'HOLD' | 'SWIPE',
              duration: noteType === 'HOLD' ? draft.duration! : null,
              createdBy: user.id,
            },
            include: { creator: { select: { name: true, avatarUrl: true } } },
          })
          createdEntries.push(this.toNote(row))
        } catch (e: unknown) {
          if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002') {
            skippedCount++
            continue
          }
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

    for (const noteId of deletedIds) {
      this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
        songId,
        noteId,
        userId: user.id,
        beforeState: { id: noteId },
        batchId,
        replacedByBatch: true,
        realtimeMode: 'batch',
      } satisfies NoteDeletedEvent)
    }

    for (const note of createdEntries) {
      this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
        songId,
        noteId: note.id,
        userId: user.id,
        afterState: note,
        batchId,
        realtimeMode: 'batch',
      } satisfies NoteCreatedEvent)
    }

    if (createdEntries.length > 0 || deletedIds.length > 0) {
      this.eventEmitter.emit(NOTE_EVENTS.BATCH_APPLIED, {
        songId,
        batchId,
        created: createdEntries,
        deletedIds,
        actorId: user.id,
      } satisfies NotesBatchAppliedPayload)
    }

    return {
      batchId,
      createdCount: createdEntries.length,
      skippedCount,
      sectionsCreated: body.sections?.length ?? 0,
      replacedCount: deletedIds.length,
    }
  }

  private buildGeneratePrompt(
    song: {
      name: string
      bpm: number
      timeSignature: string
      category: string
    },
    description: string,
    snapMode: SnapMode,
    targetCount: number,
    targetTier?: string,
  ) {
    const measure = measureDuration(song.bpm, song.timeSignature)
    const snapHint =
      snapMode === '0.1s'
        ? `${SNAP_RESOLUTION}s steps`
        : snapMode === 'beat'
          ? `quarter notes at ${song.bpm} BPM`
          : `eighth notes at ${song.bpm} BPM`

    const system = [
      'You are a rhythm-game chart designer for AMA-MIDI.',
      'Charts use 8 lanes (tracks 1–8), timeline 0–300 seconds.',
      'Note types: TAP (default), HOLD (requires duration in seconds), SWIPE.',
      'Return ONLY valid JSON with keys "notes" and "sections". No markdown.',
    ].join(' ')

    const user = [
      `Song "${song.name}": ${song.bpm} BPM, ${song.timeSignature}, category ${song.category}.`,
      targetTier ? `Target difficulty tier hint: ${targetTier} (not persisted — match density to this tier).` : null,
      `Snap all times to ${snapHint}. One note per track+time (no overlaps).`,
      `Composer brief: ${description}`,
      `Generate about ${targetCount} notes spread across the full 0–300s timeline with clear structure (intro, build, peak, outro as appropriate).`,
      `Match genre, mood, energy, and lane density from the brief.`,
      `Also suggest 3–6 section markers when they help structure the chart.`,
      `JSON shape: {"notes":[{"track":1,"time":0.0,"noteType":"TAP","title":"Kick"}],"sections":[{"time":0,"label":"Intro","color":"#10B981"}]}`,
      `HOLD notes must include duration. Keep titles short.`,
    ].filter(Boolean).join(' ')

    return { system, user }
  }

  private async callClaudeForChart(prompt: { system: string; user: string }) {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
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
    const seen = new Set<string>()
    const out: GeneratedChartNote[] = []

    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue
      const row = item as Record<string, unknown>
      if (!Number.isInteger(row.track) || typeof row.time !== 'number') continue

      const track = row.track as number
      let time = snapTime(row.time as number, snapMode, bpm)
      time = Math.round(time * 10) / 10
      const noteType = typeof row.noteType === 'string' ? row.noteType : 'TAP'

      if (track < TRACK_MIN || track > TRACK_MAX) continue
      if (time < TIME_MIN || time > TIME_MAX) continue
      if (!NOTE_TYPES.has(noteType)) continue

      const duration = typeof row.duration === 'number' ? row.duration : undefined
      if (noteType === 'HOLD' && (duration == null || duration <= 0)) continue

      const key = this.slotKey(track, time)
      if (seen.has(key)) continue
      seen.add(key)

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
