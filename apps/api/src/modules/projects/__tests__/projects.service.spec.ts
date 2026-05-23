import { ProjectsService } from '../projects.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  project: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  projectMember: {
    create: jest.fn(),
  },
}

const access = {
  assertCanViewProject: jest.fn(),
  assertProjectAdmin: jest.fn(),
}

const user: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'User',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('ProjectsService', () => {
  let service: ProjectsService

  beforeEach(() => {
    service = new ProjectsService(prisma as unknown as PrismaService, access as unknown as ProjectAccessService)
    jest.clearAllMocks()
  })

  it('creates project and admin membership for creator', async () => {
    const row = {
      id: 'project1',
      name: 'Game A',
      description: null,
      status: 'ACTIVE',
      ownerId: 'u1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      archivedAt: null,
      _count: { songs: 0, members: 1 },
    }
    prisma.project.create.mockResolvedValue(row)

    const result = await service.create({ name: 'Game A' }, user)

    expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Game A',
        ownerId: 'u1',
        members: { create: { userId: 'u1', permission: 'ADMIN', songScope: 'ALL_SONGS' } },
      }),
    }))
    expect(result.name).toBe('Game A')
    expect(result.memberCount).toBe(1)
  })

  it('lists projects visible to non-admin through membership', async () => {
    prisma.project.findMany.mockResolvedValue([])

    await service.findAll(user)

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ members: { some: { userId: 'u1' } } }),
    }))
  })
})
