import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { analyzeChart } from '@ama-midi/shared'
import type { ChartAnalysisResult, ChartFactorBreakdown, SongDifficulty } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'

const ANALYZE_COOLDOWN_MS = 5000

@Injectable()
export class ChartAnalyzeService {
  private readonly lastManualAnalyze = new Map<string, number>()

  constructor(private readonly prisma: PrismaService) {}

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
    return this.computeAndPersist(chartId)
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

  private async computeAndPersist(chartId: string): Promise<ChartAnalysisResult> {
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
    return this.toAnalysisResult(chartId, analysis)
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
