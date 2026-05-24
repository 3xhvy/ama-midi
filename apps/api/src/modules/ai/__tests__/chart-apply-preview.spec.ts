import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ConflictException } from '@nestjs/common'
import { ChartApplyPreviewService } from '../chart-apply-preview.service'
import { ChartContextService } from '../chart-context.service'
import { AiChartService } from '../ai-chart.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import { LLM_ADAPTER } from '../adapters/llm-adapter.interface'
import type { AuthUser } from '@ama-midi/shared'

const mockUser: AuthUser = {
  id:              'user-1',
  email:           'test@test.com',
  name:            'Test User',
  role:            'COMPOSER',
  profileComplete: true,
  tourComplete:    false,
}

const chartContextFixture = {
  song: {
    name: 'Test Song',
    bpm: 120,
    timeSignature: '4/4',
    category: 'POP',
  },
  chart: {
    id: 'chart-1',
    name: 'Main',
    noteCount: 1,
    computedDifficulty: 'NORMAL',
    speedMultiplier: 1,
    averageDifficultyScore: 2,
    peakDifficultyScore: 4,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  notes: [{ track: 1, time: 0, noteType: 'TAP' as const, title: 'Kick' }],
  sections: [],
  segments: [],
  warnings: [],
  occupied: [{ track: 1, time: 0 }],
}

describe('ChartApplyPreviewService', () => {
  let service: ChartApplyPreviewService
  let prisma: {
    note: { findMany: jest.Mock }
  }
  let chartContext: {
    loadChartContext: jest.Mock
    previewVersion: jest.Mock
  }

  beforeEach(async () => {
    prisma = {
      note: { findMany: jest.fn().mockResolvedValue([]) },
    }
    chartContext = {
      loadChartContext: jest.fn().mockResolvedValue(chartContextFixture),
      previewVersion: jest.fn().mockReturnValue('2026-01-01T00:00:00.000Z:1'),
    }

    const module = await Test.createTestingModule({
      providers: [
        ChartApplyPreviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChartContextService, useValue: chartContext },
      ],
    }).compile()

    service = module.get(ChartApplyPreviewService)
  })

  it('classifies creatable vs conflict for merge mode', async () => {
    prisma.note.findMany.mockResolvedValue([
      {
        id: 'existing-1',
        songId: 'song-1',
        track: 1,
        time: 0,
        title: 'Existing Tap',
        description: 'desc',
        noteType: 'TAP',
        duration: null,
        createdBy: 'user-2',
        createdAt: new Date('2026-05-20T10:00:00.000Z'),
        creator: { name: 'Other Composer', avatarUrl: 'https://avatar.test/a.png' },
      },
    ])

    const preview = await service.buildPreview('song-1', 'chart-1', [
      { track: 1, time: 0, noteType: 'TAP' },
      { track: 2, time: 1, noteType: 'TAP' },
    ], false)

    expect(preview.summary.conflictCount).toBe(1)
    expect(preview.summary.creatableNotes).toBe(1)
    expect(preview.conflicts[0]).toMatchObject({
      conflictId: 'existing-1',
      track: 1,
      time: 0,
      existingNote: {
        id: 'existing-1',
        title: 'Existing Tap',
        creatorName: 'Other Composer',
        creatorAvatarUrl: 'https://avatar.test/a.png',
      },
    })
    expect(preview.creatable[0]).toMatchObject({ track: 2, time: 1 })
    expect(preview.previewVersion).toBe('2026-01-01T00:00:00.000Z:1')
  })

  it('returns all incoming notes as creatable when replaceExisting is true', async () => {
    const preview = await service.buildPreview('song-1', 'chart-1', [
      { track: 1, time: 0, noteType: 'TAP' },
      { track: 2, time: 1, noteType: 'TAP' },
    ], true)

    expect(preview.replaceExisting).toBe(true)
    expect(preview.summary.conflictCount).toBe(0)
    expect(preview.summary.creatableNotes).toBe(2)
    expect(preview.conflicts).toHaveLength(0)
    expect(preview.creatable).toHaveLength(2)
  })
})

describe('AiChartService applyChart merge resolutions', () => {
  let service: AiChartService
  let prisma: {
    songChart: { findFirst: jest.Mock }
    note: {
      findMany: jest.Mock
      findFirst: jest.Mock
      create: jest.Mock
      update: jest.Mock
    }
    sectionMarker: { createMany: jest.Mock }
    $transaction: jest.Mock
  }
  let chartContext: {
    loadChartContext: jest.Mock
    previewVersion: jest.Mock
  }
  let chartApplyPreview: ChartApplyPreviewService
  let eventEmitter: { emit: jest.Mock }
  let mockAccess: { assertCanEditSongChart: jest.Mock }

  beforeEach(async () => {
    prisma = {
      songChart: { findFirst: jest.fn().mockResolvedValue({ id: 'chart-1' }) },
      note: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sectionMarker: { createMany: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma)),
    }
    chartContext = {
      loadChartContext: jest.fn().mockResolvedValue(chartContextFixture),
      previewVersion: jest.fn().mockReturnValue('2026-01-01T00:00:00.000Z:1'),
    }
    eventEmitter = { emit: jest.fn() }
    mockAccess = { assertCanEditSongChart: jest.fn() }

    const module = await Test.createTestingModule({
      providers: [
        AiChartService,
        ChartApplyPreviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChartContextService, useValue: chartContext },
        { provide: ProjectAccessService, useValue: mockAccess },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: LLM_ADAPTER, useValue: { complete: jest.fn() } },
      ],
    }).compile()

    service = module.get(AiChartService)
    chartApplyPreview = module.get(ChartApplyPreviewService)
  })

  it('apply respects KEEP_EXISTING and REPLACE_WITH_PATTERN resolutions', async () => {
    const existingNote = {
      id: 'existing-1',
      chartId: 'chart-1',
      songId: 'song-1',
      track: 1,
      time: 0,
      title: 'Existing',
      description: '',
      noteType: 'TAP',
      duration: null,
      createdBy: 'user-2',
      createdAt: new Date('2026-05-20T10:00:00.000Z'),
      updatedAt: new Date('2026-05-20T10:00:00.000Z'),
      creator: { name: 'Other' },
    }

    prisma.note.findMany.mockResolvedValue([existingNote])
    prisma.note.findFirst.mockResolvedValue(existingNote)
    prisma.note.create.mockImplementation(({ data }: { data: { track: number } }) =>
      Promise.resolve({
        id: `created-${data.track}`,
        chartId: 'chart-1',
        songId: 'song-1',
        track: data.track,
        time: data.track === 1 ? 0 : 1,
        title: 'AI Chart',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Test User' },
      }),
    )

    const preview = await chartApplyPreview.buildPreview('song-1', 'chart-1', [
      { track: 1, time: 0, noteType: 'TAP', title: 'Incoming conflict' },
      { track: 2, time: 1, noteType: 'TAP', title: 'Incoming creatable' },
    ], false)

    const result = await service.applyChart('song-1', mockUser, {
      chartId: 'chart-1',
      replaceExisting: false,
      previewVersion: preview.previewVersion,
      notes: [
        { track: 1, time: 0, noteType: 'TAP', title: 'Incoming conflict' },
        { track: 2, time: 1, noteType: 'TAP', title: 'Incoming creatable' },
      ],
      resolutions: [
        { conflictId: 'existing-1', action: 'KEEP_EXISTING' },
      ],
    })

    expect(mockAccess.assertCanEditSongChart).toHaveBeenCalledWith('song-1', mockUser)
    expect(prisma.note.update).not.toHaveBeenCalled()
    expect(prisma.note.create).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      createdCount: 1,
      replacedCount: 0,
      skippedCount: 1,
    })
  })

  it('soft-deletes and replaces when resolution is REPLACE_WITH_PATTERN', async () => {
    const existingNote = {
      id: 'existing-1',
      chartId: 'chart-1',
      songId: 'song-1',
      track: 1,
      time: 0,
      title: 'Existing',
      description: '',
      noteType: 'TAP',
      duration: null,
      createdBy: 'user-2',
      createdAt: new Date('2026-05-20T10:00:00.000Z'),
      updatedAt: new Date('2026-05-20T10:00:00.000Z'),
      creator: { name: 'Other' },
    }

    prisma.note.findMany.mockResolvedValue([existingNote])
    prisma.note.findFirst.mockResolvedValue(existingNote)
    prisma.note.create.mockImplementation(({ data }: { data: { track: number } }) =>
      Promise.resolve({
        id: `created-${data.track}`,
        chartId: 'chart-1',
        songId: 'song-1',
        track: data.track,
        time: 0,
        title: 'AI Chart',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Test User' },
      }),
    )

    const preview = await chartApplyPreview.buildPreview('song-1', 'chart-1', [
      { track: 1, time: 0, noteType: 'TAP', title: 'Replacement' },
    ], false)

    const result = await service.applyChart('song-1', mockUser, {
      chartId: 'chart-1',
      replaceExisting: false,
      previewVersion: preview.previewVersion,
      notes: [{ track: 1, time: 0, noteType: 'TAP', title: 'Replacement' }],
      resolutions: [{ conflictId: 'existing-1', action: 'REPLACE_WITH_PATTERN' }],
    })

    expect(prisma.note.update).toHaveBeenCalledWith({
      where: { id: 'existing-1' },
      data: { deletedAt: expect.any(Date) },
    })
    expect(prisma.note.create).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      createdCount: 1,
      replacedCount: 1,
      skippedCount: 0,
    })
  })

  it('throws ConflictException with fresh preview when previewVersion is stale', async () => {
    chartContext.previewVersion.mockReturnValue('2026-01-02T00:00:00.000Z:2')

    await expect(
      service.applyChart('song-1', mockUser, {
        chartId: 'chart-1',
        replaceExisting: false,
        previewVersion: '2026-01-01T00:00:00.000Z:1',
        notes: [{ track: 2, time: 1, noteType: 'TAP' }],
        resolutions: [],
      }),
    ).rejects.toThrow(ConflictException)
  })
})
