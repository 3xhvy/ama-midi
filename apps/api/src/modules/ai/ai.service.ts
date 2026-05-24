import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { LLM_ADAPTER, type LLMAdapter } from './adapters/llm-adapter.interface'
import {
  AI_STREAM_STEPS,
  SNAP_RESOLUTION,
  TIME_MAX,
  TIME_MIN,
  TRACK_MAX,
  TRACK_MIN,
  measureDuration,
  snapTime,
  type AiChartContext,
  type AiChartNote,
  type SnapMode,
  type SuggestNotesMode,
} from '@ama-midi/shared'
import { type AiProgressEmitter, runStep, emitDetail } from './ai-progress.util'
import { ChartContextService } from './chart-context.service'

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
  contextNotes: AiChartNote[]
  targetTrackNotes: AiChartNote[]
  occupied: Array<{ track: number; time: number }>
  sections: Array<{ time: number; label: string }>
  segments: Array<{
    startTimeMs: number
    endTimeMs: number
    notesPerSecond: number
    difficultyLevel: string
    difficultyScore: number
  }>
  chartNoteCount: number
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(
    @Inject(LLM_ADAPTER) private readonly llm: LLMAdapter,
    private readonly chartContext: ChartContextService,
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
      instruction?: string
    },
    onProgress?: AiProgressEmitter,
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
    if (body.mode === 'refine_pattern') {
      if (!body.selectedNotes?.length || body.selectedNotes.length < 2) {
        throw new BadRequestException('Select at least 2 notes to refine a pattern')
      }
    }

    const steps = AI_STREAM_STEPS['suggest-notes']

    const ctx = await runStep(steps, 'load_context', onProgress, () =>
      this.chartContext.loadChartContext(songId, body.chartId),
    )

    if (body.mode === 'fill_track' && ctx.notes.length < 5) {
      const readyDef = steps.find((s) => s.stepId === 'ready')!
      onProgress?.({ type: 'step', stepId: 'ready', label: readyDef.label, status: 'done' })
      return { suggestions: [] }
    }

    const segments = await runStep(steps, 'analyze', onProgress, async () =>
      ctx.segments.map((s) => ({
        startTimeMs: s.start * 1000,
        endTimeMs: s.end * 1000,
        notesPerSecond: s.nps,
        difficultyLevel: s.level,
        difficultyScore: s.score,
      })),
    )

    const context = this.buildContext(ctx, body, segments)

    const raw = await runStep(steps, 'generate', onProgress, async () => {
      emitDetail(steps, 'generate', `Asking AI for note ideas…`, onProgress)
      const prompt = this.buildPrompt(
        body.mode,
        body.targetTrack,
        context,
        body.instruction,
        body.selectedNotes,
      )
      const result = await this.callClaude(prompt)
      emitDetail(steps, 'generate', `AI returned ${result.length} idea${result.length !== 1 ? 's' : ''}`, onProgress)
      return result
    })

    const suggestions = await runStep(steps, 'validate', onProgress, async () => {
      const validated = this.postProcess(raw, context, body.mode, body.targetTrack, body.selectedNotes)
      emitDetail(steps, 'validate', `${validated.length} note${validated.length !== 1 ? 's' : ''} fit perfectly`, onProgress)
      return validated
    })

    const readyDef = steps.find((s) => s.stepId === 'ready')!
    onProgress?.({ type: 'step', stepId: 'ready', label: readyDef.label, status: 'done' })

    return { suggestions }
  }

  private buildContext(
    ctx: AiChartContext,
    body: {
      playheadTime: number
      snapMode: SnapMode
      targetTrack?: number
      selectedNotes?: Array<{ track: number; time: number }>
      mode?: SuggestNotesMode
    },
    segments: Array<{
      startTimeMs: number
      endTimeMs: number
      notesPerSecond: number
      difficultyLevel: string
      difficultyScore: number
    }>,
  ): ChartContext {
    const { song, chart, notes, sections, occupied } = ctx
    const measure = measureDuration(song.bpm, song.timeSignature)
    const chartNoteCount = notes.length

    if (
      body.selectedNotes?.length &&
      (body.mode === 'continue_pattern' || body.mode === 'refine_pattern')
    ) {
      const sorted = [...body.selectedNotes].sort((a, b) => a.time - b.time || a.track - b.track)
      const continueFromTime = sorted[sorted.length - 1]!.time
      const minTime = sorted[0]!.time
      const windowStart = Math.max(TIME_MIN, minTime - measure)
      const windowEnd = Math.min(TIME_MAX, continueFromTime + measure * 4)

      return {
        bpm: song.bpm,
        timeSignature: song.timeSignature,
        difficulty: chart.computedDifficulty,
        category: song.category,
        playheadTime: continueFromTime,
        snapMode: body.snapMode,
        windowStart,
        windowEnd,
        contextNotes: sorted.map((n) => {
          const full = notes.find(
            (note) => note.track === n.track && Math.abs(note.time - n.time) < SNAP_RESOLUTION / 2,
          )
          return full ?? { track: n.track, time: n.time, noteType: 'TAP' as const }
        }),
        targetTrackNotes: [],
        occupied,
        sections,
        segments,
        chartNoteCount,
      }
    }

    const windowStart = Math.max(TIME_MIN, body.playheadTime - measure * 2)
    const windowEnd = Math.min(TIME_MAX, body.playheadTime + measure * 4)

    const contextNotes = notes.filter((n) => n.time >= windowStart && n.time <= windowEnd)
    const targetTrackNotes =
      body.targetTrack != null ? notes.filter((n) => n.track === body.targetTrack) : []

    return {
      bpm: song.bpm,
      timeSignature: song.timeSignature,
      difficulty: chart.computedDifficulty,
      category: song.category,
      playheadTime: body.playheadTime,
      snapMode: body.snapMode,
      windowStart,
      windowEnd,
      contextNotes,
      targetTrackNotes,
      occupied,
      sections,
      segments,
      chartNoteCount,
    }
  }

  private buildPrompt(
    mode: SuggestNotesMode,
    targetTrack: number | undefined,
    ctx: ChartContext,
    instruction?: string,
    selectedNotes?: Array<{ track: number; time: number }>,
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

    const anchorTime = selectedNotes?.length
      ? Math.min(...selectedNotes.map((n) => n.time))
      : ctx.playheadTime
    const currentSection = [...ctx.sections].reverse().find((s) => s.time <= anchorTime)

    const base = [
      `Song: ${ctx.bpm} BPM, ${ctx.timeSignature}, difficulty ${ctx.difficulty}, category ${ctx.category}.`,
      `Snap grid: ${ctx.snapMode} — align all times to ${snapHint}.`,
      `Context window: ${ctx.windowStart.toFixed(1)}s–${ctx.windowEnd.toFixed(1)}s.`,
      currentSection
        ? `Current section: "${currentSection.label}" at ${currentSection.time}s.`
        : null,
      `All sections: ${JSON.stringify(ctx.sections)}.`,
      `Analysis segments: ${JSON.stringify(
        ctx.segments.map((s) => ({
          start: s.startTimeMs / 1000,
          end: s.endTimeMs / 1000,
          nps: s.notesPerSecond,
          level: s.difficultyLevel,
          score: s.difficultyScore,
        })),
      )}.`,
      `Chart totals: ${ctx.chartNoteCount} notes.`,
      instruction ? `User instruction: ${instruction}.` : null,
      `Occupied positions (never duplicate these track+time pairs): ${JSON.stringify(ctx.occupied)}.`,
    ].filter(Boolean)

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

    if (mode === 'refine_pattern') {
      const n = ctx.contextNotes.length
      return {
        system,
        user: [
          ...base,
          `Selected pattern to refine: ${JSON.stringify(ctx.contextNotes)}.`,
          `Task: REFINE PATTERN — return exactly ${n} suggestions that improve this pattern.`,
          'Adjust timing and lanes within the selection window; preserve musical intent.',
          'Return improved track+time pairs; do not collide with occupied positions outside the selection.',
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
    let text: string
    try {
      text = await this.llm.complete({
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        maxTokens: 600,
      })
    } catch (err) {
      this.logger.error('LLM call failed for suggestNotes', err instanceof Error ? err.stack : String(err))
      throw new ServiceUnavailableException('AI suggestion failed — try again in a moment.')
    }

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
    } catch (err) {
      this.logger.warn('Failed to parse LLM suggestNotes response', { preview: jsonText.slice(0, 200) })
      return []
    }
  }

  private postProcess(
    raw: RawSuggestion[],
    ctx: ChartContext,
    mode: SuggestNotesMode,
    targetTrack: number | undefined,
    selectedNotes?: Array<{ track: number; time: number }>,
  ): RawSuggestion[] {
    const selectedKeys =
      mode === 'refine_pattern'
        ? new Set(
            (selectedNotes ?? []).map(
              (n) => `${n.track}:${snapTime(n.time, ctx.snapMode, ctx.bpm).toFixed(1)}`,
            ),
          )
        : new Set<string>()

    const occupiedKeys = new Set(
      ctx.occupied
        .map((n) => `${n.track}:${n.time.toFixed(1)}`)
        .filter((key) => !selectedKeys.has(key)),
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
      if (out.length >= 4 && mode !== 'refine_pattern') break
    }

    return out
  }
}
