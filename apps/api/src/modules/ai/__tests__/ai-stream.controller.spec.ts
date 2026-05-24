import { Test } from '@nestjs/testing'
import { AI_STREAM_STEPS, type AiStreamEvent } from '@ama-midi/shared'
import { AiController } from '../ai.controller'
import { AiService } from '../ai.service'
import { AiChartService } from '../ai-chart.service'
import { AiStreamEnvelopeDto } from '../dto/ai-stream.dto'
import type { Request, Response } from 'express'
import type { AuthUser } from '@ama-midi/shared'

const songId = 'song-1'
const composerUser: AuthUser = {
  id: 'user-1',
  email: 'composer@test.com',
  name: 'Composer',
  role: 'COMPOSER',
  avatarUrl: undefined,
  profileComplete: true,
  tourComplete: true,
}

function makeMockRes() {
  const chunks: string[] = []
  const res = {
    statusCode: 200,
    status(code: number) {
      res.statusCode = code
      return res
    },
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    json: jest.fn(),
    write: jest.fn((chunk: string) => {
      chunks.push(chunk)
      return true
    }),
    end: jest.fn(),
  }
  return { res: res as unknown as Response, chunks, statusCode: () => res.statusCode }
}

function parseSseEvents(chunks: string[]): AiStreamEvent[] {
  return chunks
    .join('')
    .split('\n\n')
    .filter(Boolean)
    .map((block) => JSON.parse(block.replace(/^data: /, '')) as AiStreamEvent)
}

function makeReq(user: AuthUser = composerUser): Request {
  return { user } as unknown as Request
}

const chartId = 'chart-1'

describe('AiController.streamAi', () => {
  let controller: AiController
  let aiChart: { generateChart: jest.Mock; scaleChart: jest.Mock }
  let ai: { suggestNotes: jest.Mock }

  beforeEach(async () => {
    aiChart = {
      generateChart: jest.fn(),
      scaleChart: jest.fn(),
    }
    ai = { suggestNotes: jest.fn() }

    const module = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiChartService, useValue: aiChart },
        { provide: AiService, useValue: ai },
      ],
    }).compile()

    controller = module.get(AiController)
  })

  it('streams generate-chart progress and result over SSE', async () => {
    const chartResult = {
      notes: [{ track: 1, time: 1, noteType: 'TAP' as const }],
      sections: [{ time: 0, label: 'Intro', color: '#10B981' }],
    }

    aiChart.generateChart.mockImplementation(
      async (
        _songId: string,
        _role: string,
        _body: unknown,
        onProgress?: (event: {
          type: 'step'
          stepId: string
          label: string
          status: 'active' | 'done' | 'error'
        }) => void,
      ) => {
        for (const step of AI_STREAM_STEPS['generate-chart']) {
          onProgress?.({ type: 'step', stepId: step.stepId, label: step.label, status: 'active' })
          onProgress?.({ type: 'step', stepId: step.stepId, label: step.label, status: 'done' })
        }
        return chartResult
      },
    )

    const { res, chunks } = makeMockRes()
    const envelope: AiStreamEnvelopeDto = {
      action: 'generate-chart',
      payload: {
        chartId,
        description: 'Upbeat EDM chart',
        snapMode: 'beat',
        replaceExisting: false,
      },
    }

    await controller.streamAi(songId, envelope, makeReq(), res, 'text/event-stream')

    const events = parseSseEvents(chunks)
    expect(events[0]).toMatchObject({ type: 'run', action: 'generate-chart' })
    expect(events[events.length - 1]).toMatchObject({
      type: 'result',
      action: 'generate-chart',
      payload: chartResult,
    })

    const stepEvents = events.filter((e) => e.type === 'step')
    expect(stepEvents.length).toBeGreaterThan(0)
    for (const event of stepEvents) {
      if (event.type === 'step') {
        expect(event.runId).toBe((events[0] as { runId: string }).runId)
      }
    }

    expect(aiChart.generateChart).toHaveBeenCalledWith(
      songId,
      composerUser,
      envelope.payload,
      expect.any(Function),
    )
    expect(res.end).toHaveBeenCalled()
  })

  it('streams scale-chart progress and result over SSE', async () => {
    const chartResult = { notes: [], sections: [] }

    aiChart.scaleChart.mockImplementation(
      async (
        _songId: string,
        _role: string,
        _body: unknown,
        onProgress?: (event: {
          type: 'step'
          stepId: string
          label: string
          status: 'active' | 'done' | 'error'
        }) => void,
      ) => {
        for (const step of AI_STREAM_STEPS['scale-chart']) {
          onProgress?.({ type: 'step', stepId: step.stepId, label: step.label, status: 'active' })
          onProgress?.({ type: 'step', stepId: step.stepId, label: step.label, status: 'done' })
        }
        return chartResult
      },
    )

    const { res, chunks } = makeMockRes()
    const envelope: AiStreamEnvelopeDto = {
      action: 'scale-chart',
      payload: {
        chartId: 'chart-1',
        targetTier: 'NORMAL',
        snapMode: 'beat',
      },
    }

    await controller.streamAi(songId, envelope, makeReq(), res, 'text/event-stream')

    const events = parseSseEvents(chunks)
    expect(events[0]).toMatchObject({ type: 'run', action: 'scale-chart' })
    expect(events[events.length - 1]).toMatchObject({
      type: 'result',
      action: 'scale-chart',
      payload: chartResult,
    })

    const stepIds = events
      .filter((e): e is Extract<AiStreamEvent, { type: 'step' }> => e.type === 'step')
      .map((e) => e.stepId)
    expect(stepIds).toEqual(
      expect.arrayContaining(AI_STREAM_STEPS['scale-chart'].map((s) => s.stepId)),
    )
    expect(res.end).toHaveBeenCalled()
  })

  it('writes error event when service throws', async () => {
    aiChart.generateChart.mockRejectedValue(new Error('Generation failed'))

    const { res, chunks } = makeMockRes()
    const envelope: AiStreamEnvelopeDto = {
      action: 'generate-chart',
      payload: { chartId, description: 'Test', snapMode: '0.1s', replaceExisting: false },
    }

    await controller.streamAi(songId, envelope, makeReq(), res)

    const events = parseSseEvents(chunks)
    expect(events.some((e) => e.type === 'error' && e.message === 'AI request failed — try again in a moment.')).toBe(true)
    expect(res.end).toHaveBeenCalled()
  })

  it('returns 406 when Accept header excludes text/event-stream', async () => {
    const { res, statusCode } = makeMockRes()

    await controller.streamAi(
      songId,
      { action: 'generate-chart', payload: { chartId, description: 'Test', snapMode: '0.1s', replaceExisting: false } },
      makeReq(),
      res,
      'application/json',
    )

    expect(statusCode()).toBe(406)
    expect((res as unknown as { json: jest.Mock }).json).toHaveBeenCalledWith({
      message: 'Accept text/event-stream required',
    })
    expect(aiChart.generateChart).not.toHaveBeenCalled()
  })
})
