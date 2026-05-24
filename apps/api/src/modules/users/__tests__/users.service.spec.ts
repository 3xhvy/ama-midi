import { ForbiddenException } from '@nestjs/common'
import { UsersService } from '../users.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  user: { findMany: jest.fn() },
}

const access = {
  assertProjectAdmin: jest.fn(),
}

const projectAdmin: AuthUser = {
  id: 'u1',
  email: 'admin@example.com',
  name: 'Project Admin',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

const platformAdmin: AuthUser = {
  ...projectAdmin,
  id: 'platform-admin',
  role: 'ADMIN',
}

describe('UsersService authorization', () => {
  let service: UsersService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new UsersService(
      prisma as unknown as PrismaService,
      access as unknown as ProjectAccessService,
    )
    prisma.user.findMany.mockResolvedValue([])
  })

  it('requires a project id for non-platform admin user search', async () => {
    await expect(service.search('qa', projectAdmin)).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('requires project admin permission for project-scoped user search', async () => {
    await service.search('qa', projectAdmin, 'project1')

    expect(access.assertProjectAdmin).toHaveBeenCalledWith('project1', projectAdmin)
    expect(prisma.user.findMany).toHaveBeenCalled()
  })

  it('allows platform admins to search globally', async () => {
    await service.search('qa', platformAdmin)

    expect(access.assertProjectAdmin).not.toHaveBeenCalled()
    expect(prisma.user.findMany).toHaveBeenCalled()
  })
})
