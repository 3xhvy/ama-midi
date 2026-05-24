import { Test } from '@nestjs/testing'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AiChartService } from '../ai-chart.service'
import { ChartContextService } from '../chart-context.service'
import { ChartApplyPreviewService } from '../chart-apply-preview.service'
import { LLM_ADAPTER, type LLMAdapter } from '../adapters/llm-adapter.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import { EditorCommandService } from '../../editor-commands/editor-command.service'
import type { AuthUser } from '@ama-midi/shared'

const songId = 'song-1'
const chartId = 'chart-1'

const mockUser: AuthUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: false,
}

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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(({ data }: { data: { track: number; time: number } }) =>
        Promise.resolve({
          id: `note-${data.track}`,
          chartId,
          songId,
          track: data.track,
          time: data.time,
          title: 'AI Chart',
          description: '',
          noteType: 'TAP',
          duration: null,
          createdBy: mockUser.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { name: 'Test User', avatarUrl: null },
        }),
      ),
    },
    sectionMarker: {
      findMany: jest.fn().mockResolvedValue([
        { time: 0, label: 'Intro', color: '#10B981' },
      ]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
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
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma))
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
        { provide: ProjectAccessService, useValue: { assertCanEditSongChart: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: EditorCommandService, useValue: { record: jest.fn().mockResolvedValue({ id: 'cmd-mock' }) } },
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

  it('keeps HOLD notes and normalizes lowercase or duration-only rows', async () => {
    ;(llm.complete as jest.Mock).mockResolvedValueOnce(JSON.stringify({
      notes: [
        { track: 2, time: 1.0, noteType: 'hold', duration: 1.5, title: 'Pad' },
        { track: 3, time: 2.0, duration: 0.8, title: 'Duration only' },
        { track: 4, time: 3.0, noteType: 'HOLD', title: 'Missing duration' },
      ],
      sections: [],
    }))

    const result = await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })

    expect(result.notes).toEqual([
      { track: 2, time: 1, noteType: 'HOLD', duration: 1.5, title: 'Pad' },
      { track: 3, time: 2, noteType: 'HOLD', duration: 0.8, title: 'Duration only' },
      { track: 4, time: 3, noteType: 'HOLD', duration: 0.5, title: 'Missing duration' },
    ])
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

  it('returns a generic message when the LLM provider fails', async () => {
    ;(llm.complete as jest.Mock).mockRejectedValueOnce(new Error('OpenAI-compatible LLM failed: 429 insufficient_quota'))

    await expect(service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })).rejects.toThrow('AI chart scale failed — try again in a moment.')
  })

  it('uses updateMany (not per-note updates) when replacing existing notes', async () => {
    const updateManySpy = prisma.note.updateMany
    const updateSpy = prisma.note.update

    prisma.note.findMany.mockResolvedValueOnce([
      {
        id: 'existing-1',
        chartId,
        songId,
        track: 1,
        time: 1,
        title: 'Existing',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Other', avatarUrl: null },
      },
    ])
    prisma.$transaction.mockImplementationOnce(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma))

    await service.applyChart(songId, mockUser, {
      chartId,
      notes: [{ track: 1, time: 5.0, noteType: 'TAP' as const }],
      replaceExisting: true,
    })

    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['existing-1'] } },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    )
    const deletionCalls = (updateSpy as jest.Mock).mock.calls.filter(
      ([args]) => args?.data?.deletedAt != null,
    )
    expect(deletionCalls).toHaveLength(0)
  })
})
