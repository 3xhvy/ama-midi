import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { LLM_ADAPTER, type LLMAdapter } from './adapters/llm-adapter.interface'
import {
  SNAP_RESOLUTION,
  TIME_MAX,
  TIME_MIN,
  TRACK_MAX,
  TRACK_MIN,
  measureDuration,
  snapTime,
  type SnapMode,
  type SuggestNotesMode,
} from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'

interface RawSuggestion {
  track: number
  time: number
}

interface ChartContext {
  bpm: number
  timeSignature: string
  difficulty: string
  category: string
  playheadTime: number
  snapMode: SnapMode
  windowStart: number
  windowEnd: number
  contextNotes: Array<{ track: number; time: number; noteType: string }>
  targetTrackNotes: Array<{ track: number; time: number }>
  occupied: Array<{ track: number; time: number }>
}

@Injectable()
export class AiService {
  constructor(
    @Inject(LLM_ADAPTER) private readonly llm: LLMAdapter,
    private readonly prisma: PrismaService,
  ) {}

  async suggestNotes(
    songId: string,
    userRole: string,
    body: {
      chartId: string
      mode: SuggestNotesMode
      playheadTime: number
      snapMode: SnapMode
      targetTrack?: number
      selectedNotes?: Array<{ track: number; time: number }>
    },
  ): Promise<{ suggestions: RawSuggestion[] }> {
    if (userRole === 'VIEWER') throw new ForbiddenException('VIEWER cannot use AI suggestions')
    if (body.mode === 'fill_track' && body.targetTrack == null) {
      throw new BadRequestException('targetTrack is required for fill_track mode')
    }
    if (body.mode === 'continue_pattern') {
      if (!body.selectedNotes?.length || body.selectedNotes.length < 2) {
        throw new BadRequestException('Select at least 2 notes to continue a pattern')
      }
    }

    const chart = await this.prisma.songChart.findFirst({
      where: { id: body.chartId, songId },
      include: { song: true },
    })
    if (!chart) throw new NotFoundException('Chart not found')

    const allNotes = await this.prisma.note.findMany({
      where: { chartId: chart.id, deletedAt: null },
      orderBy: { time: 'asc' },
      select: { track: true, time: true, noteType: true },
    })

    if (body.mode === 'fill_track' && allNotes.length < 5) {
      return { suggestions: [] }
    }

    const context = this.buildContext(chart.song, chart.computedDifficulty, allNotes, body)
    const prompt = this.buildPrompt(body.mode, body.targetTrack, context)
    const raw = await this.callClaude(prompt)
    const suggestions = this.postProcess(raw, context, body.mode, body.targetTrack)

    return { suggestions }
  }

  private buildContext(
    song: { bpm: number; timeSignature: string; category: string },
    difficulty: string,
    allNotes: Array<{ track: number; time: number; noteType: string }>,
    body: {
      playheadTime: number
      snapMode: SnapMode
      targetTrack?: number
      selectedNotes?: Array<{ track: number; time: number }>
    },
  ): ChartContext {
    const measure = measureDuration(song.bpm, song.timeSignature)

    if (body.selectedNotes?.length) {
      const sorted = [...body.selectedNotes].sort((a, b) => a.time - b.time || a.track - b.track)
      const continueFromTime = sorted[sorted.length - 1]!.time
      const minTime = sorted[0]!.time
      const windowStart = Math.max(TIME_MIN, minTime - measure)
      const windowEnd = Math.min(TIME_MAX, continueFromTime + measure * 4)

      return {
        bpm: song.bpm,
        timeSignature: song.timeSignature,
        difficulty,
        category: song.category,
        playheadTime: continueFromTime,
        snapMode: body.snapMode,
        windowStart,
        windowEnd,
        contextNotes: sorted.map((n) => {
          const full = allNotes.find(
            (note) => note.track === n.track && Math.abs(note.time - n.time) < SNAP_RESOLUTION / 2,
          )
          return { track: n.track, time: n.time, noteType: full?.noteType ?? 'TAP' }
        }),
        targetTrackNotes: [],
        occupied: allNotes.map((n) => ({ track: n.track, time: n.time })),
      }
    }

    const windowStart = Math.max(TIME_MIN, body.playheadTime - measure * 2)
    const windowEnd = Math.min(TIME_MAX, body.playheadTime + measure * 4)

    const contextNotes = allNotes.filter((n) => n.time >= windowStart && n.time <= windowEnd)
    const targetTrackNotes =
      body.targetTrack != null
        ? allNotes.filter((n) => n.track === body.targetTrack)
        : []

    return {
      bpm: song.bpm,
      timeSignature: song.timeSignature,
      difficulty,
      category: song.category,
      playheadTime: body.playheadTime,
      snapMode: body.snapMode,
      windowStart,
      windowEnd,
      contextNotes: contextNotes.map((n) => ({
        track: n.track,
        time: n.time,
        noteType: n.noteType,
      })),
      targetTrackNotes: targetTrackNotes.map((n) => ({ track: n.track, time: n.time })),
      occupied: allNotes.map((n) => ({ track: n.track, time: n.time })),
    }
  }

  private buildPrompt(
    mode: SuggestNotesMode,
    targetTrack: number | undefined,
    ctx: ChartContext,
  ): { system: string; user: string } {
    const system = [
      'You are a rhythm-game chart assistant for AMA-MIDI.',
      'Charts have 8 lanes (tracks 1–8). Time is in seconds from 0 to 300.',
      'Composers place notes on lanes to match music rhythm and gameplay density.',
      'Return ONLY a JSON array of {"track": number, "time": number}. No markdown, no explanation.',
    ].join(' ')

    const snapHint =
      ctx.snapMode === '0.1s'
        ? `0.1 second steps (${SNAP_RESOLUTION}s resolution)`
        : ctx.snapMode === 'beat'
          ? `quarter-note beats at ${ctx.bpm} BPM (${(60 / ctx.bpm).toFixed(3)}s per beat)`
          : `eighth-note subdivisions at ${ctx.bpm} BPM (${(60 / ctx.bpm / 2).toFixed(3)}s per step)`

    const base = [
      `Song: ${ctx.bpm} BPM, ${ctx.timeSignature}, difficulty ${ctx.difficulty}, category ${ctx.category}.`,
      `Snap grid: ${ctx.snapMode} — align all times to ${snapHint}.`,
      `Context window: ${ctx.windowStart.toFixed(1)}s–${ctx.windowEnd.toFixed(1)}s.`,
      `Occupied positions (never duplicate these track+time pairs): ${JSON.stringify(ctx.occupied)}.`,
    ]

    if (mode === 'continue_pattern') {
      return {
        system,
        user: [
          ...base,
          `Selected pattern to continue (chronological): ${JSON.stringify(ctx.contextNotes)}.`,
          `Task: CONTINUE PATTERN — suggest exactly 4 notes that extend this selected pattern forward after ${ctx.playheadTime.toFixed(1)}s.`,
          'Preserve the interval spacing, lane choices, and rhythmic feel of the selection.',
          `Every suggested time must be > ${ctx.playheadTime.toFixed(1)} and <= ${TIME_MAX}.`,
        ].join(' '),
      }
    }

    return {
      system,
      user: [
        ...base,
        `Notes in context window (chronological): ${JSON.stringify(ctx.contextNotes)}.`,
        `Notes already on target track ${targetTrack}: ${JSON.stringify(ctx.targetTrackNotes)}.`,
        `Task: FILL TRACK — suggest exactly 4 notes ONLY on track ${targetTrack}.`,
        'Identify empty slots on this lane and add notes whose timing matches the groove on other lanes in the window.',
        'Do not suggest notes on any other track.',
        `Times must be between ${ctx.windowStart.toFixed(1)}s and ${ctx.windowEnd.toFixed(1)}s.`,
      ].join(' '),
    }
  }

  private async callClaude(prompt: { system: string; user: string }): Promise<RawSuggestion[]> {
    const text = await this.llm.complete({
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
      maxTokens: 600,
    })
    const jsonText = (text || '[]').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const parsed = JSON.parse(jsonText.trim()) as unknown
      if (!Array.isArray(parsed)) return []
      return (parsed as Array<Record<string, unknown>>)
        .filter(
          (s) =>
            Number.isInteger(s.track) &&
            (s.track as number) >= TRACK_MIN &&
            (s.track as number) <= TRACK_MAX &&
            typeof s.time === 'number',
        )
        .map((s) => ({ track: s.track as number, time: s.time as number }))
    } catch {
      return []
    }
  }

  private postProcess(
    raw: RawSuggestion[],
    ctx: ChartContext,
    mode: SuggestNotesMode,
    targetTrack: number | undefined,
  ): RawSuggestion[] {
    const occupiedKeys = new Set(
      ctx.occupied.map((n) => `${n.track}:${n.time.toFixed(1)}`),
    )
    const seen = new Set<string>()
    const out: RawSuggestion[] = []

    for (const s of raw) {
      let track = s.track
      let time = snapTime(s.time, ctx.snapMode, ctx.bpm)
      time = Math.round(time * 10) / 10

      if (time < TIME_MIN || time > TIME_MAX) continue
      if (mode === 'fill_track' && targetTrack != null) track = targetTrack
      if (track < TRACK_MIN || track > TRACK_MAX) continue
      if (mode === 'continue_pattern' && time <= ctx.playheadTime + SNAP_RESOLUTION / 2) continue

      const key = `${track}:${time.toFixed(1)}`
      if (occupiedKeys.has(key) || seen.has(key)) continue

      seen.add(key)
      out.push({ track, time })
      if (out.length >= 4) break
    }

    return out
  }
}
