import { ForbiddenException } from '@nestjs/common'
import { SongsService } from '../songs.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  song: { findUnique: jest.fn(), update: jest.fn() },
}

const access = {
  assertCanViewSong: jest.fn(),
  getProjectPermission: jest.fn(),
}

const composer: AuthUser = {
  id: 'c1',
  email: 'c@example.com',
  name: 'Composer',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('SongsService status workflow', () => {
  let service: SongsService

  beforeEach(() => {
    service = new SongsService(prisma as unknown as PrismaService, access as unknown as ProjectAccessService)
    jest.clearAllMocks()
    access.assertCanViewSong.mockResolvedValue({ id: 'song1', projectId: 'p1' })
    access.getProjectPermission.mockResolvedValue('EDIT')
  })

  it('returns composer transitions for draft songs', async () => {
    prisma.song.findUnique.mockResolvedValue({
      status: 'DRAFT',
      projectId: 'p1',
      assignedComposerId: 'c1',
      assignedQaId: 'q1',
      createdBy: 'c1',
    })

    const workflow = await service.getWorkflow('song1', composer)
    expect(workflow.status).toBe('DRAFT')
    expect(workflow.allowedTransitions).toEqual(['IN_REVIEW'])
    expect(workflow.canEditChart).toBe(true)
    expect(workflow.readOnlyReason).toBeNull()
  })

  it('transitions draft to in review for assigned composer', async () => {
    prisma.song.findUnique.mockResolvedValue({
      status: 'DRAFT',
      projectId: 'p1',
      assignedComposerId: 'c1',
      assignedQaId: 'q1',
      createdBy: 'c1',
    })
    prisma.song.update.mockResolvedValue({
      id: 'song1',
      projectId: 'p1',
      name: 'Song',
      category: 'PROTOTYPE',
      status: 'IN_REVIEW',
      difficulty: 'NORMAL',
      assignedComposerId: 'c1',
      assignedQaId: 'q1',
      sourceSongId: null,
      archivedAt: null,
      createdBy: 'c1',
      bpm: 120,
      timeSignature: '4/4',
      createdAt: new Date(),
      updatedAt: new Date(),
      creator: { name: 'Composer', avatarUrl: null },
      assignedComposer: { name: 'Composer' },
      assignedQa: { name: 'QA' },
      _count: { notes: 0 },
    })

    const result = await service.transitionStatus('song1', { status: 'IN_REVIEW' }, composer)
    expect(result.status).toBe('IN_REVIEW')
  })

  it('rejects composer approving their own song', async () => {
    prisma.song.findUnique.mockResolvedValue({
      status: 'IN_REVIEW',
      projectId: 'p1',
      assignedComposerId: 'c1',
      assignedQaId: 'q1',
      createdBy: 'c1',
    })

    await expect(
      service.transitionStatus('song1', { status: 'APPROVED' }, composer),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
