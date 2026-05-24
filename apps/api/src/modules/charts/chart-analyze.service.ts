import { HttpException, HttpStatus, Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { randomUUID } from 'crypto'
import { analyzeChart } from '@ama-midi/shared'
import { CHART_EVENTS } from '@ama-midi/shared'
import type { ChartAnalysisResult, ChartFactorBreakdown, SongDifficulty } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'

const ANALYZE_COOLDOWN_MS = 5000
const DEFAULT_DEBOUNCE_MS = 2000

@Injectable()
export class ChartAnalyzeService implements OnModuleDestroy {
  private readonly lastManualAnalyze = new Map<string, number>()
  private readonly pendingTimers = new Map<string, NodeJS.Timeout>()
  private readonly inFlight = new Map<string, Promise<ChartAnalysisResult>>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleDestroy(): void {
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer)
    }
    this.pendingTimers.clear()
  }

  /** Debounced background analysis — safe on the note write hot path. */
  scheduleRun(chartId: string, debounceMs = DEFAULT_DEBOUNCE_MS): void {
    const existing = this.pendingTimers.get(chartId)
    if (existing) clearTimeout(existing)

    this.pendingTimers.set(
      chartId,
      setTimeout(() => {
        this.pendingTimers.delete(chartId)
        void this.runAndNotify(chartId)
      }, debounceMs),
    )
  }

  async run(chartId: string): Promise<ChartAnalysisResult> {
    return this.computeAndPersist(chartId)
  }

  async runManual(chartId: string): Promise<ChartAnalysisResult> {
    const now = Date.now()
    const last = this.lastManualAnalyze.get(chartId) ?? 0
    if (now - last < ANALYZE_COOLDOWN_MS) {
      throw new HttpException(
        `Re-analyze is limited to once every ${ANALYZE_COOLDOWN_MS / 1000}s per chart`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    this.lastManualAnalyze.set(chartId, now)
    return this.runAndNotify(chartId)
  }

  async getAnalysis(chartId: string): Promise<ChartAnalysisResult> {
    const chart = await this.prisma.songChart.findUnique({
      where: { id: chartId },
      include: {
        segments: { orderBy: { startTimeMs: 'asc' } },
        warnings: { orderBy: [{ severity: 'asc' }, { startTimeMs: 'asc' }] },
      },
    })
    if (!chart) throw new NotFoundException('Chart not found')

    return {
      chartId,
      computedDifficulty: chart.computedDifficulty as SongDifficulty,
      averageDifficultyScore: chart.averageDifficultyScore,
      peakDifficultyScore: chart.peakDifficultyScore,
      segments: chart.segments.map((s) => ({
        startTimeMs: s.startTimeMs,
        endTimeMs: s.endTimeMs,
        notesPerSecond: s.notesPerSecond,
        averageLaneJump: s.averageLaneJump,
        offbeatRatio: s.offbeatRatio,
        holdNoteRatio: s.holdNoteRatio,
        simultaneousNoteRatio: s.simultaneousNoteRatio,
        patternComplexityScore: s.patternComplexityScore,
        difficultyScore: s.difficultyScore,
        difficultyLevel: s.difficultyLevel as SongDifficulty,
      })),
      warnings: chart.warnings.map((w) => ({
        code: w.code,
        severity: w.severity as 'INFO' | 'WARN' | 'ERROR',
        startTimeMs: w.startTimeMs ?? undefined,
        endTimeMs: w.endTimeMs ?? undefined,
        message: w.message,
        metadata: (w.metadata as Record<string, unknown> | null) ?? undefined,
      })),
      factors: (chart.factorBreakdown as ChartFactorBreakdown | null) ?? emptyFactors(),
    }
  }

  private async runAndNotify(chartId: string): Promise<ChartAnalysisResult> {
    const existing = this.inFlight.get(chartId)
    if (existing) return existing

    const promise = this.computeAndPersist(chartId, true)
      .catch((err) => {
        console.error('[ChartAnalyzeService] analysis failed', chartId, err)
        throw err
      })
      .finally(() => {
        this.inFlight.delete(chartId)
      })

    this.inFlight.set(chartId, promise)
    return promise
  }

  private async computeAndPersist(chartId: string, notify = false): Promise<ChartAnalysisResult> {
    const chart = await this.prisma.songChart.findUnique({
      where: { id: chartId },
      include: {
        song: { select: { bpm: true, timeSignature: true } },
      },
    })
    if (!chart) throw new NotFoundException('Chart not found')

    const notes = await this.prisma.note.findMany({
      where: { chartId, deletedAt: null },
      select: { track: true, time: true, noteType: true, duration: true },
      orderBy: [{ time: 'asc' }, { track: 'asc' }],
    })

    const analysis = analyzeChart({
      chartId,
      notes: notes.map((n) => ({
        track: n.track,
        time: n.time,
        noteType: n.noteType,
        duration: n.duration,
      })),
      bpm: chart.song.bpm,
      timeSignature: chart.song.timeSignature,
      speedMultiplier: chart.speedMultiplier,
    })

    await this.persist(chartId, analysis)
    const result = this.toAnalysisResult(chartId, analysis)
    if (notify) {
      this.eventEmitter.emit(CHART_EVENTS.ANALYSIS_UPDATED, {
        songId: chart.songId,
        chartId,
      })
    }
    return result
  }

  private async persist(chartId: string, analysis: ChartAnalysisResult): Promise<void> {
    const now = new Date()
    await this.prisma.$transaction([
      this.prisma.songChart.update({
        where: { id: chartId },
        data: {
          computedDifficulty: analysis.computedDifficulty,
          averageDifficultyScore: analysis.averageDifficultyScore,
          peakDifficultyScore: analysis.peakDifficultyScore,
          factorBreakdown: analysis.factors as object,
          analyzedAt: now,
        },
      }),
      this.prisma.chartDifficultySegment.deleteMany({ where: { chartId } }),
      this.prisma.chartValidationWarning.deleteMany({ where: { chartId } }),
      ...(analysis.segments.length
        ? [
            this.prisma.chartDifficultySegment.createMany({
              data: analysis.segments.map((s) => ({
                id: randomUUID(),
                chartId,
                startTimeMs: s.startTimeMs,
                endTimeMs: s.endTimeMs,
                notesPerSecond: s.notesPerSecond,
                averageLaneJump: s.averageLaneJump,
                offbeatRatio: s.offbeatRatio,
                holdNoteRatio: s.holdNoteRatio,
                simultaneousNoteRatio: s.simultaneousNoteRatio,
                patternComplexityScore: s.patternComplexityScore,
                difficultyScore: s.difficultyScore,
                difficultyLevel: s.difficultyLevel,
              })),
            }),
          ]
        : []),
      ...(analysis.warnings.length
        ? [
            this.prisma.chartValidationWarning.createMany({
              data: analysis.warnings.map((w) => ({
                id: randomUUID(),
                chartId,
                code: w.code,
                severity: w.severity,
                startTimeMs: w.startTimeMs ?? null,
                endTimeMs: w.endTimeMs ?? null,
                message: w.message,
                metadata: (w.metadata ?? undefined) as object | undefined,
              })),
            }),
          ]
        : []),
    ])
  }

  private toAnalysisResult(chartId: string, analysis: ChartAnalysisResult): ChartAnalysisResult {
    return { ...analysis, chartId }
  }
}

function emptyFactors(): ChartFactorBreakdown {
  return {
    densityScore: 0,
    speedScore: 0,
    laneJumpScore: 0,
    syncopationScore: 0,
    holdNoteScore: 0,
    simultaneousNoteScore: 0,
    patternComplexityScore: 0,
    repetitionScore: 0,
  }
}
