import { DashboardService } from '../dashboard.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const prisma = {
  song: { findMany: jest.fn() },
}

const access = {
  assertCanViewSong: jest.fn(),
}

const user: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  name: 'QA',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

const songRow = {
  id: 'song1',
  projectId: 'p1',
  name: 'Neon Rush',
  status: 'IN_REVIEW',
  updatedAt: new Date('2026-05-23T10:00:00Z'),
  assignedComposerId: 'u2',
  assignedQaId: 'u1',
  assignedComposer: { name: 'Composer A' },
  assignedQa: { name: 'QA' },
  project: { name: 'Rhythm Game Q2' },
}

describe('DashboardService', () => {
  let service: DashboardService

  beforeEach(() => {
    service = new DashboardService(
      prisma as unknown as PrismaService,
      access as unknown as ProjectAccessService,
    )
    jest.clearAllMocks()
    access.assertCanViewSong.mockResolvedValue(songRow)
  })

  it('returns needsReview songs assigned to current QA user', async () => {
    prisma.song.findMany.mockImplementation((args: { where?: { status?: string | { in?: string[] } } }) => {
      const status = args.where?.status
      if (typeof status === 'object' && status?.in?.includes('IN_REVIEW')) {
        return Promise.resolve([songRow])
      }
      return Promise.resolve([])
    })

    const feed = await service.getFeed(user)

    expect(feed.needsReview).toHaveLength(1)
    expect(feed.needsReview[0].projectName).toBe('Rhythm Game Q2')
    expect(feed.needsReview[0].status).toBe('IN_REVIEW')
  })

  it('maps assignedToMe without requiring IN_REVIEW status', async () => {
    prisma.song.findMany.mockImplementation((args: { where?: { status?: string | { in?: string[] }; OR?: Record<string, unknown>[] } }) => {
      const status = args.where?.status
      if (typeof status === 'object' && status?.in) return Promise.resolve([])
      const or = args.where?.OR ?? []
      if (or.some((c) => 'assignedComposerId' in c || 'assignedQaId' in c)) {
        return Promise.resolve([{ ...songRow, status: 'DRAFT' }])
      }
      return Promise.resolve([])
    })

    const feed = await service.getFeed(user)

    expect(feed.assignedToMe).toHaveLength(1)
    expect(feed.assignedToMe[0].status).toBe('DRAFT')
  })
})
