import { BadRequestException } from '@nestjs/common'
import { SongsService } from '../songs.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
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

const user: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'Composer',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('SongsService project flow', () => {
  let service: SongsService

  beforeEach(() => {
    service = new SongsService(prisma as unknown as PrismaService, access as unknown as ProjectAccessService)
    jest.clearAllMocks()
  })

  it('creates blank song in a project', async () => {
    const row = {
      id: 'song1',
      projectId: 'project1',
      name: 'New Song',
      category: 'PROTOTYPE',
      status: 'DRAFT',
      difficulty: 'NORMAL',
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
      _count: { notes: 0 },
    }
    prisma.song.create.mockResolvedValue(row)

    const result = await service.createInProject('project1', {
      name: 'New Song',
      category: 'PROTOTYPE',
      difficulty: 'NORMAL',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'BLANK',
    }, user)

    expect(access.assertCanCreateSong).toHaveBeenCalledWith('project1', user)
    expect(result.projectId).toBe('project1')
  })

  it('rejects import without source song', async () => {
    await expect(service.createInProject('project1', {
      name: 'Imported',
      category: 'PROTOTYPE',
      difficulty: 'NORMAL',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'IMPORT',
    }, user)).rejects.toBeInstanceOf(BadRequestException)
  })
})
