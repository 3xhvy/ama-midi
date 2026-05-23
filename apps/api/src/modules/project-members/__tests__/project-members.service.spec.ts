import { BadRequestException } from '@nestjs/common'
import { ProjectMembersService } from '../project-members.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  song: { count: jest.fn() },
  projectMember: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  projectMemberSongAccess: { deleteMany: jest.fn(), createMany: jest.fn() },
}

const access = { assertProjectAdmin: jest.fn() }
const emitter = { emit: jest.fn() }

const admin: AuthUser = {
  id: 'admin',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  profileComplete: true,
  tourComplete: true,
}

describe('ProjectMembersService', () => {
  let service: ProjectMembersService

  beforeEach(() => {
    service = new ProjectMembersService(
      prisma as unknown as PrismaService,
      access as unknown as ProjectAccessService,
      emitter as any,
    )
    jest.clearAllMocks()
  })

  it('requires selected songs when scope is SELECTED_SONGS', async () => {
    await expect(service.add('project1', {
      userId: 'u2',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      songIds: [],
    }, admin)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects selected songs from another project', async () => {
    prisma.song.count.mockResolvedValue(1)
    await expect(service.add('project1', {
      userId: 'u2',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      songIds: ['song1', 'song2'],
    }, admin)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('creates selected song access rows when selected scope is valid', async () => {
    prisma.song.count.mockResolvedValue(2)
    prisma.projectMember.create.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u2',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      user: { name: 'QA', avatarUrl: null },
      selectedSongs: [{ songId: 'song1' }, { songId: 'song2' }],
    })

    const result = await service.add('project1', {
      userId: 'u2',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      songIds: ['song1', 'song2'],
    }, admin)

    expect(result.selectedSongIds).toEqual(['song1', 'song2'])
  })
})
