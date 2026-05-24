import { Test } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AiService } from '../ai.service'
import { AiChartService } from '../ai-chart.service'
import { ChartContextService } from '../chart-context.service'
import { ChartApplyPreviewService } from '../chart-apply-preview.service'
import { LLM_ADAPTER } from '../adapters/llm-adapter.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import { EditorCommandService } from '../../editor-commands/editor-command.service'
import { ChartAnalyzeService } from '../../charts/chart-analyze.service'
import type { AuthUser } from '@ama-midi/shared'

const user: AuthUser = {
  id: 'user-1',
  email: 'user@test.com',
  name: 'User',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('AI authorization', () => {
  const prisma = {
    song: { findUnique: jest.fn() },
    songChart: { findFirst: jest.fn() },
    note: { findMany: jest.fn() },
    sectionMarker: { findMany: jest.fn() },
    chartDifficultySegment: { findMany: jest.fn() },
    chartValidationWarning: { findMany: jest.fn() },
  }
  const access = { assertCanEditSongChart: jest.fn() }
  const llm = { complete: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    access.assertCanEditSongChart.mockRejectedValue(new ForbiddenException())
  })

  it('checks song edit access before AI note suggestions load chart context', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        ChartContextService,
        { provide: LLM_ADAPTER, useValue: llm },
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectAccessService, useValue: access },
      ],
    }).compile()

    await expect(moduleRef.get(AiService).suggestNotes('song-1', user, {
      chartId: 'chart-1',
      mode: 'fill_track',
      playheadTime: 1,
      snapMode: '0.1s',
      targetTrack: 1,
    })).rejects.toBeInstanceOf(ForbiddenException)

    expect(access.assertCanEditSongChart).toHaveBeenCalledWith('song-1', user)
    expect(prisma.song.findUnique).not.toHaveBeenCalled()
  })

  it('checks song edit access before AI chart generation loads chart context', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiChartService,
        ChartContextService,
        ChartApplyPreviewService,
        { provide: LLM_ADAPTER, useValue: llm },
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectAccessService, useValue: access },
        { provide: EditorCommandService, useValue: { record: jest.fn() } },
        { provide: ChartAnalyzeService, useValue: { scheduleRun: jest.fn(), run: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()

    await expect(moduleRef.get(AiChartService).generateChart('song-1', user, {
      chartId: 'chart-1',
      description: 'make it harder',
      snapMode: '0.1s',
      replaceExisting: false,
    })).rejects.toBeInstanceOf(ForbiddenException)

    expect(access.assertCanEditSongChart).toHaveBeenCalledWith('song-1', user)
    expect(prisma.song.findUnique).not.toHaveBeenCalled()
  })
})
