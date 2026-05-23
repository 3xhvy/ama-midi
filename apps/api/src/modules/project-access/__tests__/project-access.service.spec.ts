import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { ProjectAccessService } from '../project-access.service'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  projectMember: { findUnique: jest.fn() },
  song: { findUnique: jest.fn() },
}

const admin: AuthUser = {
  id: 'admin',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  profileComplete: true,
  tourComplete: true,
}

const composer: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'Composer',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('ProjectAccessService', () => {
  let service: ProjectAccessService

  beforeEach(() => {
    service = new ProjectAccessService(prisma as unknown as PrismaService)
    jest.clearAllMocks()
  })

  it('allows platform admin to manage any project', async () => {
    await expect(service.assertProjectAdmin('project1', admin)).resolves.toBeUndefined()
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled()
  })

  it('allows edit when member has EDIT and ALL_SONGS', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song1', projectId: 'project1' })
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u1',
      permission: 'EDIT',
      songScope: 'ALL_SONGS',
      selectedSongs: [],
    })

    await expect(service.assertCanEditSong('song1', composer)).resolves.toEqual({ id: 'song1', projectId: 'project1' })
  })

  it('denies edit when member has READ and ALL_SONGS', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song1', projectId: 'project1' })
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u1',
      permission: 'READ',
      songScope: 'ALL_SONGS',
      selectedSongs: [],
    })

    await expect(service.assertCanEditSong('song1', composer)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('allows selected scoped song only when song is in allowlist', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song1', projectId: 'project1' })
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u1',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      selectedSongs: [{ songId: 'song1' }],
    })

    await expect(service.assertCanViewSong('song1', composer)).resolves.toEqual({ id: 'song1', projectId: 'project1' })
  })

  it('denies selected scoped song when song is not in allowlist', async () => {
    prisma.song.findUnique.mockResolvedValue({ id: 'song2', projectId: 'project1' })
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 'pm1',
      projectId: 'project1',
      userId: 'u1',
      permission: 'READ',
      songScope: 'SELECTED_SONGS',
      selectedSongs: [{ songId: 'song1' }],
    })

    await expect(service.assertCanViewSong('song2', composer)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('throws not found for missing song', async () => {
    prisma.song.findUnique.mockResolvedValue(null)
    await expect(service.assertCanViewSong('missing', composer)).rejects.toBeInstanceOf(NotFoundException)
  })
})
