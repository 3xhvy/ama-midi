import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { ChartAnalyzeService } from './chart-analyze.service'
import { CreateChartDto } from './dto/create-chart.dto'
import { UpdateChartDto } from './dto/update-chart.dto'
import { DuplicateChartDto } from './dto/duplicate-chart.dto'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { AuthUser, Note, NoteCreatedEvent, SongChart, SongDifficulty } from '@ama-midi/shared'

function toNote(n: {
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
    creatorName: '',
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    noteType: (n.noteType as Note['noteType']) ?? 'TAP',
    duration: n.duration ?? undefined,
  }
}

@Injectable()
export class ChartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly analyze: ChartAnalyzeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listBySong(songId: string, user: AuthUser): Promise<SongChart[]> {
    await this.access.assertCanViewSong(songId, user)
    const charts = await this.prisma.songChart.findMany({
      where: { songId },
      orderBy: { createdAt: 'asc' },
    })
    return charts.map((c) => this.toChart(c))
  }

  async create(songId: string, dto: CreateChartDto, user: AuthUser): Promise<SongChart> {
    await this.access.assertCanEditSongChart(songId, user)
    const chart = await this.prisma.songChart.create({
      data: {
        songId,
        name: dto.name.trim(),
        speedMultiplier: dto.speedMultiplier ?? 1.0,
      },
    })
    await this.analyze.run(chart.id)
    return this.toChart(chart)
  }

  async createDefaultChart(songId: string): Promise<SongChart> {
    const chart = await this.prisma.songChart.create({
      data: { songId, name: 'Main', speedMultiplier: 1.0 },
    })
    return this.toChart(chart)
  }

  async findOne(chartId: string, user: AuthUser): Promise<SongChart> {
    const chart = await this.getChartOrThrow(chartId)
    await this.access.assertCanViewSong(chart.songId, user)
    return this.toChart(chart)
  }

  async update(chartId: string, dto: UpdateChartDto, user: AuthUser): Promise<SongChart> {
    const existing = await this.getChartOrThrow(chartId)
    await this.access.assertCanEditSongChart(existing.songId, user)

    const chart = await this.prisma.songChart.update({
      where: { id: chartId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.speedMultiplier !== undefined ? { speedMultiplier: dto.speedMultiplier } : {}),
      },
    })

    if (dto.speedMultiplier !== undefined) {
      await this.analyze.run(chartId)
    }

    return this.toChart(chart)
  }

  async remove(chartId: string, user: AuthUser): Promise<void> {
    const chart = await this.getChartOrThrow(chartId)
    await this.access.assertCanEditSongChart(chart.songId, user)

    const count = await this.prisma.songChart.count({ where: { songId: chart.songId } })
    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last chart on a song')
    }

    await this.prisma.songChart.delete({ where: { id: chartId } })
  }

  async duplicate(chartId: string, user: AuthUser, dto: DuplicateChartDto = {}): Promise<SongChart> {
    const src = await this.getChartOrThrow(chartId)
    await this.access.assertCanEditSongChart(src.songId, user)

    const copy = await this.prisma.songChart.create({
      data: {
        songId: src.songId,
        name: dto.name?.trim() ?? `${src.name} copy`,
        speedMultiplier: dto.speedMultiplier ?? src.speedMultiplier,
      },
    })

    const notes = await this.prisma.note.findMany({
      where: { chartId: src.id, deletedAt: null },
    })

    if (notes.length) {
      const batchId = randomUUID()
      const createdNotes = await this.prisma.$transaction(
        notes.map((n) =>
          this.prisma.note.create({
            data: {
              chartId: copy.id,
              songId: src.songId,
              track: n.track,
              time: n.time,
              title: n.title,
              description: n.description,
              noteType: n.noteType,
              duration: n.duration,
              createdBy: user.id,
            },
          }),
        ),
      )

      for (const n of createdNotes) {
        this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
          songId: src.songId,
          noteId: n.id,
          userId: user.id,
          afterState: toNote(n),
          batchId,
          realtimeMode: 'batch',
        } satisfies NoteCreatedEvent)
      }
    }

    await this.analyze.run(copy.id)
    return this.toChart(copy)
  }

  async getSongId(chartId: string): Promise<string> {
    const chart = await this.getChartOrThrow(chartId)
    return chart.songId
  }

  static peakTier(charts: Array<{ computedDifficulty: SongDifficulty; peakDifficultyScore: number }>): SongDifficulty {
    if (!charts.length) return 'EASY'
    return charts.reduce((best, c) =>
      c.peakDifficultyScore > best.peakDifficultyScore ? c : best,
    ).computedDifficulty
  }

  static chartSummary(charts: Array<{ name: string; computedDifficulty: SongDifficulty; peakDifficultyScore: number }>): string | undefined {
    if (!charts.length) return undefined
    if (charts.length === 1) {
      return `${charts[0].name} · ${charts[0].computedDifficulty}`
    }
    return `${charts.length} charts · peak ${ChartsService.peakTier(charts)}`
  }

  private async getChartOrThrow(chartId: string) {
    const chart = await this.prisma.songChart.findUnique({ where: { id: chartId } })
    if (!chart) throw new NotFoundException('Chart not found')
    return chart
  }

  private toChart(c: {
    id: string
    songId: string
    name: string
    speedMultiplier: number
    computedDifficulty: string
    averageDifficultyScore: number
    peakDifficultyScore: number
    factorBreakdown?: unknown
    analyzedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }): SongChart {
    return {
      id: c.id,
      songId: c.songId,
      name: c.name,
      speedMultiplier: c.speedMultiplier,
      computedDifficulty: c.computedDifficulty as SongDifficulty,
      averageDifficultyScore: c.averageDifficultyScore,
      peakDifficultyScore: c.peakDifficultyScore,
      factorBreakdown: (c.factorBreakdown as SongChart['factorBreakdown']) ?? null,
      analyzedAt: c.analyzedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }
  }
}
