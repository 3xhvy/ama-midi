import { BadRequestException } from '@nestjs/common'
import { SongsService } from '../songs.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import { ChartsService } from '../../charts/charts.service'
import { ChartAnalyzeService } from '../../charts/chart-analyze.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  song: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  sectionMarker: { findMany: jest.fn(), createMany: jest.fn() },
  notePattern: { findMany: jest.fn(), createMany: jest.fn() },
  note: { findMany: jest.fn(), createMany: jest.fn() },
  projectMember: { findFirst: jest.fn() },
}

const access = {
  assertCanCreateSong: jest.fn(),
  assertCanViewSong: jest.fn(),
  assertCanViewProject: jest.fn(),
  getAccessibleSongWhere: jest.fn(),
}

const templates = { materialize: jest.fn() }
const charts = { createDefaultChart: jest.fn() }
const analyze = { run: jest.fn() }

const user: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'Composer',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

const songRow = {
  id: 'song1',
  projectId: 'project1',
  name: 'New Song',
  category: 'PROTOTYPE' as const,
  status: 'DRAFT' as const,
  createdBy: 'u1',
  assignedComposerId: null,
  assignedQaId: null,
  sourceSongId: null,
  archivedAt: null,
  bpm: 120,
  timeSignature: '4/4',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  creator: { name: 'Composer', avatarUrl: null },
  assignedComposer: null,
  assignedQa: null,
  charts: [{
    id: 'chart1',
    songId: 'song1',
    name: 'Main',
    speedMultiplier: 1,
    computedDifficulty: 'NORMAL' as const,
    averageDifficultyScore: 0,
    peakDifficultyScore: 0,
    analyzedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }],
  _count: { notes: 0 },
}

describe('SongsService project flow', () => {
  let service: SongsService

  beforeEach(() => {
    service = new SongsService(
      prisma as unknown as PrismaService,
      access as unknown as ProjectAccessService,
      templates as never,
      charts as unknown as ChartsService,
      analyze as unknown as ChartAnalyzeService,
    )
    jest.clearAllMocks()
    charts.createDefaultChart.mockResolvedValue({ id: 'chart1', songId: 'song1', name: 'Main' })
    prisma.song.findUnique.mockResolvedValue(songRow)
  })

  it('creates blank song in a project', async () => {
    prisma.song.create.mockResolvedValue({ ...songRow, charts: [] })

    const result = await service.createInProject('project1', {
      name: 'New Song',
      category: 'PROTOTYPE',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'BLANK',
    }, user)

    expect(access.assertCanCreateSong).toHaveBeenCalledWith('project1', user)
    expect(charts.createDefaultChart).toHaveBeenCalledWith('song1')
    expect(result.projectId).toBe('project1')
  })

  it('rejects import without source song', async () => {
    await expect(service.createInProject('project1', {
      name: 'Imported',
      category: 'PROTOTYPE',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'IMPORT',
    }, user)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('materializes template when startType is TEMPLATE', async () => {
    prisma.song.create.mockResolvedValue({ ...songRow, charts: [] })

    await service.createInProject('project1', {
      name: 'Tap Starter',
      category: 'PROTOTYPE',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'TEMPLATE',
      templateId: 'tap-starter',
    }, user)

    expect(templates.materialize).toHaveBeenCalledWith('tap-starter', 'song1', 'chart1', 'u1')
    expect(analyze.run).toHaveBeenCalledWith('chart1')
  })
})
