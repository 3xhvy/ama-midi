import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ChartContextService } from '../chart-context.service'
import { PrismaService } from '../../prisma/prisma.service'

const songId = 'song-1'
const chartId = 'chart-1'
const chartUpdatedAt = new Date('2026-05-01T12:00:00.000Z')

function makePrisma() {
  return {
    song: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Test Song',
        bpm: 120,
        timeSignature: '4/4',
        category: 'EDM',
      }),
    },
    songChart: {
      findFirst: jest.fn().mockResolvedValue({
        id: chartId,
        name: 'Main',
        speedMultiplier: 1,
        computedDifficulty: 'HARD',
        averageDifficultyScore: 10,
        peakDifficultyScore: 18,
        updatedAt: chartUpdatedAt,
      }),
    },
    note: {
      findMany: jest.fn().mockResolvedValue([
        { track: 1, time: 0.5, noteType: 'TAP', duration: null, title: 'Tap' },
        { track: 2, time: 1.0, noteType: 'HOLD', duration: 0.5, title: 'Hold' },
      ]),
    },
    sectionMarker: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    chartDifficultySegment: {
      findMany: jest.fn().mockResolvedValue([
        {
          startTimeMs: 0,
          endTimeMs: 5000,
          notesPerSecond: 2,
          difficultyLevel: 'HARD',
          difficultyScore: 10,
        },
      ]),
    },
    chartValidationWarning: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  }
}

describe('ChartContextService', () => {
  let service: ChartContextService
  let prisma: ReturnType<typeof makePrisma>

  beforeEach(async () => {
    prisma = makePrisma()
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChartContextService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = moduleRef.get(ChartContextService)
  })

  it('maps DB notes to AiChartNote (HOLD includes duration, TAP omits null duration)', async () => {
    const ctx = await service.loadChartContext(songId, chartId)

    expect(ctx.notes[0]).toMatchObject({
      track: 1,
      time: 0.5,
      noteType: 'TAP',
      title: 'Tap',
    })
    expect(ctx.notes[0]).not.toHaveProperty('duration')

    expect(ctx.notes[1]).toMatchObject({
      track: 2,
      time: 1.0,
      noteType: 'HOLD',
      duration: 0.5,
      title: 'Hold',
    })
  })

  it('derives occupied from notes', async () => {
    const ctx = await service.loadChartContext(songId, chartId)

    expect(ctx.occupied).toEqual([
      { track: 1, time: 0.5 },
      { track: 2, time: 1.0 },
    ])
  })

  it('sets noteCount to match notes length', async () => {
    const ctx = await service.loadChartContext(songId, chartId)

    expect(ctx.chart.noteCount).toBe(2)
    expect(ctx.chart.noteCount).toBe(ctx.notes.length)
  })

  it('throws when song is missing', async () => {
    prisma.song.findUnique.mockResolvedValueOnce(null)

    await expect(service.loadChartContext(songId, chartId)).rejects.toThrow(NotFoundException)
  })

  it('throws when chart is missing', async () => {
    prisma.songChart.findFirst.mockResolvedValueOnce(null)

    await expect(service.loadChartContext(songId, chartId)).rejects.toThrow(NotFoundException)
  })

  it('previewVersion combines updatedAt and noteCount', async () => {
    const ctx = await service.loadChartContext(songId, chartId)
    expect(service.previewVersion(ctx)).toBe(`${chartUpdatedAt.toISOString()}:2`)
  })
})
