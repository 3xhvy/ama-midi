import { Test } from '@nestjs/testing'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AiChartService } from '../ai-chart.service'
import { ChartContextService } from '../chart-context.service'
import { ChartApplyPreviewService } from '../chart-apply-preview.service'
import { LLM_ADAPTER, type LLMAdapter } from '../adapters/llm-adapter.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'

const songId = 'song-1'
const chartId = 'chart-1'

function makePrisma() {
  return {
    song: {
      findUnique: jest.fn().mockResolvedValue({
        id: songId,
        name: 'Scale Song',
        bpm: 120,
        timeSignature: '4/4',
        category: 'EDM',
      }),
    },
    songChart: {
      findFirst: jest.fn().mockResolvedValue({
        id: chartId,
        name: 'Hard Chart',
        songId,
        speedMultiplier: 1,
        computedDifficulty: 'HARD',
        averageDifficultyScore: 10,
        peakDifficultyScore: 18,
        updatedAt: new Date('2026-05-01T12:00:00.000Z'),
      }),
      findUnique: jest.fn(),
    },
    note: {
      findMany: jest.fn().mockResolvedValue([
        { track: 1, time: 1.04, noteType: 'TAP', duration: null, title: 'Kick' },
        { track: 4, time: 1.54, noteType: 'HOLD', duration: 0.5, title: 'Hold' },
      ]),
    },
    sectionMarker: {
      findMany: jest.fn().mockResolvedValue([
        { time: 0, label: 'Intro', color: '#10B981' },
      ]),
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
      findMany: jest.fn().mockResolvedValue([
        { code: 'HIGH_DENSITY', severity: 'WARN', message: 'Elevated density' },
      ]),
    },
    $transaction: jest.fn(),
  }
}

describe('AiChartService.scaleChart', () => {
  let service: AiChartService
  let prisma: ReturnType<typeof makePrisma>
  let llm: LLMAdapter

  beforeEach(async () => {
    prisma = makePrisma()
    llm = {
      complete: jest.fn().mockResolvedValue(JSON.stringify({
        notes: [
          { track: 1, time: 2.04, noteType: 'TAP', title: 'Scaled' },
          { track: 9, time: 3, noteType: 'TAP', title: 'Invalid lane' },
        ],
        sections: [{ time: 0, label: 'Intro', color: '#10B981' }],
      })),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiChartService,
        ChartContextService,
        ChartApplyPreviewService,
        { provide: LLM_ADAPTER, useValue: llm },
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectAccessService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()

    service = moduleRef.get(AiChartService)
  })

  it('rejects viewers', async () => {
    await expect(service.scaleChart(songId, 'VIEWER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })).rejects.toThrow(ForbiddenException)
  })

  it('rejects empty source charts', async () => {
    prisma.note.findMany.mockResolvedValueOnce([])

    await expect(service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })).rejects.toThrow(BadRequestException)
  })

  it('sends source notes, analysis, target tier, and instruction to the LLM', async () => {
    await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      instruction: 'reduce doubles',
      snapMode: '0.1s',
    })

    expect(llm.complete).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 8192,
      messages: [expect.objectContaining({ role: 'user', content: expect.stringContaining('reduce doubles') })],
    }))
    const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
    expect(userPrompt).toContain('Target tier: NORMAL')
    expect(userPrompt).toContain('Current notes (chronological)')
    expect(userPrompt).toContain('Density segments')
    expect(userPrompt).toContain('Warnings')
  })

  it('computes local analysis segments when persisted segments are missing', async () => {
    prisma.chartDifficultySegment.findMany.mockResolvedValueOnce([])

    await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })

    const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
    expect(userPrompt).toContain('Density segments')
    expect(userPrompt).toContain('"start":0')
  })

  it('normalizes model output and drops invalid notes', async () => {
    const result = await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })

    expect(result.notes).toEqual([{ track: 1, time: 2, noteType: 'TAP', duration: undefined, title: 'Scaled' }])
    expect(result.sections).toEqual([{ time: 0, label: 'Intro', color: '#10B981' }])
  })

  it('returns empty preview for invalid model JSON', async () => {
    ;(llm.complete as jest.Mock).mockResolvedValueOnce('not json')

    const result = await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })

    expect(result).toEqual({ notes: [], sections: [] })
  })

  it('reports provider quota errors clearly', async () => {
    ;(llm.complete as jest.Mock).mockRejectedValueOnce(new Error('OpenAI-compatible LLM failed: 429 insufficient_quota'))

    await expect(service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })).rejects.toThrow('AI provider quota or rate limit reached')
  })
})
