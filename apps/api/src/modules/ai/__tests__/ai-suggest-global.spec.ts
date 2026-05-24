import { Test } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { AI_STREAM_STEPS } from '@ama-midi/shared'
import { AiService } from '../ai.service'
import { ChartContextService } from '../chart-context.service'
import { LLM_ADAPTER, type LLMAdapter } from '../adapters/llm-adapter.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'

const songId = 'song-1'
const chartId = 'chart-1'

function makePrisma() {
  return {
    song: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Suggest Song',
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
        computedDifficulty: 'NORMAL',
        averageDifficultyScore: 8,
        peakDifficultyScore: 12,
        updatedAt: new Date('2026-05-01T12:00:00.000Z'),
      }),
    },
    note: {
      findMany: jest.fn().mockResolvedValue([
        { track: 1, time: 1, noteType: 'TAP', duration: null, title: null },
        { track: 2, time: 1.5, noteType: 'TAP', duration: null, title: null },
        { track: 3, time: 2, noteType: 'TAP', duration: null, title: null },
        { track: 4, time: 2.5, noteType: 'TAP', duration: null, title: null },
        { track: 1, time: 3, noteType: 'TAP', duration: null, title: null },
      ]),
    },
    sectionMarker: {
      findMany: jest.fn().mockResolvedValue([
        { time: 0, label: 'Intro', color: '#10B981' },
        { time: 2, label: 'Verse', color: '#6C63FF' },
      ]),
    },
    chartDifficultySegment: {
      findMany: jest.fn().mockResolvedValue([
        {
          startTimeMs: 0,
          endTimeMs: 5000,
          notesPerSecond: 2,
          difficultyLevel: 'NORMAL',
          difficultyScore: 8,
        },
      ]),
    },
    chartValidationWarning: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  }
}

describe('AiService.suggestNotes global context', () => {
  let service: AiService
  let prisma: ReturnType<typeof makePrisma>
  let llm: LLMAdapter

  beforeEach(async () => {
    prisma = makePrisma()
    llm = {
      complete: jest.fn().mockResolvedValue(JSON.stringify([
        { track: 1, time: 3.5 },
        { track: 2, time: 4 },
      ])),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        ChartContextService,
        { provide: LLM_ADAPTER, useValue: llm },
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectAccessService, useValue: { assertCanEditSongChart: jest.fn() } },
      ],
    }).compile()

    service = moduleRef.get(AiService)
  })

  it('includes analysis segments in the prompt when segments exist', async () => {
    await service.suggestNotes(songId, 'COMPOSER', {
      chartId,
      mode: 'fill_track',
      targetTrack: 1,
      playheadTime: 2,
      snapMode: '0.1s',
    })

    const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
    expect(userPrompt).toContain('Analysis segments')
    expect(userPrompt).not.toContain('Density profile')
  })

  it('includes section info when section markers exist', async () => {
    await service.suggestNotes(songId, 'COMPOSER', {
      chartId,
      mode: 'fill_track',
      targetTrack: 1,
      playheadTime: 2.5,
      snapMode: '0.1s',
    })

    const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
    expect(userPrompt).toContain('Current section')
    expect(userPrompt).toContain('All sections')
    expect(userPrompt).toContain('Verse')
  })

  it('computes local analysis segments when persisted segments are missing', async () => {
    prisma.chartDifficultySegment.findMany.mockResolvedValueOnce([])

    await service.suggestNotes(songId, 'COMPOSER', {
      chartId,
      mode: 'fill_track',
      targetTrack: 1,
      playheadTime: 2,
      snapMode: '0.1s',
    })

    const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
    expect(userPrompt).toContain('Analysis segments')
    expect(userPrompt).toContain('"start":0')
  })

  it('throws ServiceUnavailableException when LLM.complete rejects', async () => {
    ;(llm.complete as jest.Mock).mockRejectedValueOnce(new Error('network error'))

    await expect(
      service.suggestNotes(songId, 'COMPOSER', {
        chartId,
        mode: 'fill_track',
        targetTrack: 1,
        playheadTime: 2,
        snapMode: '0.1s',
      }),
    ).rejects.toThrow('AI suggestion failed')
  })

  it('rejects refine_pattern with fewer than 2 selected notes', async () => {
    await expect(service.suggestNotes(songId, 'COMPOSER', {
      chartId,
      mode: 'refine_pattern',
      playheadTime: 2,
      snapMode: '0.1s',
      selectedNotes: [{ track: 1, time: 1 }],
    })).rejects.toThrow(BadRequestException)
  })

  it('allows replacement at selected track+time in refine_pattern post-process', async () => {
    ;(llm.complete as jest.Mock).mockResolvedValueOnce(JSON.stringify([
      { track: 1, time: 1 },
      { track: 2, time: 1.5 },
    ]))

    const result = await service.suggestNotes(songId, 'COMPOSER', {
      chartId,
      mode: 'refine_pattern',
      playheadTime: 2,
      snapMode: '0.1s',
      selectedNotes: [
        { track: 1, time: 1 },
        { track: 2, time: 1.5 },
      ],
    })

    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        { track: 1, time: 1 },
        { track: 2, time: 1.5 },
      ]),
    )
  })

  it('emits load_context through ready step IDs via onProgress', async () => {
    const stepIds: string[] = []
    const onProgress = jest.fn((event: { stepId: string }) => {
      stepIds.push(event.stepId)
    })

    await service.suggestNotes(songId, 'COMPOSER', {
      chartId,
      mode: 'fill_track',
      targetTrack: 1,
      playheadTime: 2,
      snapMode: '0.1s',
    }, onProgress)

    expect(stepIds).toEqual(
      expect.arrayContaining(AI_STREAM_STEPS['suggest-notes'].map((s) => s.stepId)),
    )
    expect(stepIds[0]).toBe('load_context')
    expect(stepIds[stepIds.length - 1]).toBe('ready')
  })
})
