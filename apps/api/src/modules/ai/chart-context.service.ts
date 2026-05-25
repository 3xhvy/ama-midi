import { Injectable, NotFoundException } from '@nestjs/common'
import { analyzeChart, type AiChartContext, type AiChartNote, type NoteType } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'

function normalizeAiNoteType(noteType: string): NoteType {
  return noteType === 'HOLD' ? 'HOLD' : 'TAP'
}

function mapDbNoteToAi(note: {
  track: number
  time: number
  noteType: string
  duration: number | null
  title: string | null | undefined
}): AiChartNote {
  const out: AiChartNote = {
    track: note.track,
    time: note.time,
    noteType: normalizeAiNoteType(note.noteType),
  }
  if (note.title != null && note.title !== '') {
    out.title = note.title
  }
  if (note.duration != null) {
    out.duration = note.duration
  }
  return out
}

function mapPersistedSegments(
  segments: Array<{
    startTimeMs: number
    endTimeMs: number
    notesPerSecond: number
    difficultyLevel: string
    difficultyScore: number
  }>,
) {
  return segments.map((s) => ({
    start: s.startTimeMs / 1000,
    end: s.endTimeMs / 1000,
    nps: s.notesPerSecond,
    level: String(s.difficultyLevel),
    score: s.difficultyScore,
  }))
}

@Injectable()
export class ChartContextService {
  constructor(private readonly prisma: PrismaService) {}

  async loadChartContext(songId: string, chartId: string): Promise<AiChartContext> {
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
      select: {
        name: true,
        bpm: true,
        timeSignature: true,
        category: true,
      },
    })
    if (!song) throw new NotFoundException('Song not found')

    const chart = await this.prisma.songChart.findFirst({
      where: { id: chartId, songId },
      select: {
        id: true,
        name: true,
        speedMultiplier: true,
        computedDifficulty: true,
        averageDifficultyScore: true,
        peakDifficultyScore: true,
        updatedAt: true,
      },
    })
    if (!chart) throw new NotFoundException('Chart not found')

    const [rawNotes, sections, persistedSegments, warnings] = await Promise.all([
      this.prisma.note.findMany({
        where: { chartId: chart.id, deletedAt: null },
        orderBy: [{ time: 'asc' }, { track: 'asc' }],
        select: { track: true, time: true, noteType: true, duration: true, title: true },
      }),
      this.prisma.sectionMarker.findMany({
        where: { songId },
        orderBy: { time: 'asc' },
        select: { time: true, label: true, color: true },
      }),
      this.prisma.chartDifficultySegment.findMany({
        where: { chartId: chart.id },
        orderBy: { startTimeMs: 'asc' },
        select: {
          startTimeMs: true,
          endTimeMs: true,
          notesPerSecond: true,
          difficultyLevel: true,
          difficultyScore: true,
        },
      }),
      this.prisma.chartValidationWarning.findMany({
        where: { chartId: chart.id },
        orderBy: [{ severity: 'asc' }, { startTimeMs: 'asc' }],
        select: { code: true, severity: true, message: true },
      }),
    ])

    const notes = rawNotes.map(mapDbNoteToAi)

    let segments: AiChartContext['segments']
    if (persistedSegments.length > 0) {
      segments = mapPersistedSegments(persistedSegments)
    } else {
      const localAnalysis = analyzeChart({
        chartId: chart.id,
        notes: rawNotes.map((n) => ({
          track: n.track,
          time: n.time,
          noteType: normalizeAiNoteType(n.noteType),
          duration: n.duration,
        })),
        bpm: song.bpm,
        timeSignature: song.timeSignature,
        speedMultiplier: chart.speedMultiplier,
      })
      segments = localAnalysis.segments.map((s) => ({
        start: s.startTimeMs / 1000,
        end: s.endTimeMs / 1000,
        nps: s.notesPerSecond,
        level: String(s.difficultyLevel),
        score: s.difficultyScore,
      }))
    }

    const noteCount = notes.length

    return {
      song: {
        name: song.name,
        bpm: song.bpm,
        timeSignature: song.timeSignature,
        category: song.category as string,
      },
      chart: {
        id: chart.id,
        name: chart.name,
        noteCount,
        computedDifficulty: String(chart.computedDifficulty),
        speedMultiplier: chart.speedMultiplier,
        averageDifficultyScore: chart.averageDifficultyScore,
        peakDifficultyScore: chart.peakDifficultyScore,
        updatedAt: chart.updatedAt.toISOString(),
      },
      notes,
      sections: sections.map((s) => ({
        time: s.time,
        label: s.label,
        ...(s.color != null && s.color !== '' ? { color: s.color } : {}),
      })),
      segments,
      warnings: warnings.map((w) => ({
        code: w.code,
        severity: String(w.severity),
        message: w.message,
      })),
      occupied: notes.map((n) => ({ track: n.track, time: n.time })),
    }
  }

  previewVersion(ctx: AiChartContext): string {
    return `${ctx.chart.updatedAt}:${ctx.chart.noteCount}`
  }
}
