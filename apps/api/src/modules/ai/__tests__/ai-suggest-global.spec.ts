import { Test } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { AI_STREAM_STEPS } from '@ama-midi/shared'
import { AiService } from '../ai.service'
import { LLM_ADAPTER, type LLMAdapter } from '../adapters/llm-adapter.interface'
import { PrismaService } from '../../prisma/prisma.service'

const songId = 'song-1'
const chartId = 'chart-1'

function makePrisma() {
  return {
    songChart: {
      findFirst: jest.fn().mockResolvedValue({
        id: chartId,
        songId,
        computedDifficulty: 'NORMAL',
        speedMultiplier: 1,
        song: {
          id: songId,
          bpm: 120,
          timeSignature: '4/4',
          category: 'EDM',
        },
      }),
    },
    note: {
      findMany: jest.fn().mockResolvedValue([
        { track: 1, time: 1, noteType: 'TAP' },
        { track: 2, time: 1.5, noteType: 'TAP' },
        { track: 3, time: 2, noteType: 'TAP' },
        { track: 4, time: 2.5, noteType: 'TAP' },
        { track: 1, time: 3, noteType: 'TAP' },
      ]),
    },
    sectionMarker: {
      findMany: jest.fn().mockResolvedValue([
        { time: 0, label: 'Intro' },
        { time: 2, label: 'Verse' },
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
        { provide: LLM_ADAPTER, useValue: llm },
        { provide: PrismaService, useValue: prisma },
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
    expect(userPrompt).toContain('Density profile')
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
    expect(userPrompt).toContain('Density profile')
    expect(userPrompt).toContain('"start":0')
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
