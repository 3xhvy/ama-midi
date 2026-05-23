import { Test, TestingModule } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SectionsService } from '../sections.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const mockUser: AuthUser = {
  id: 'user1',
  email: 'u@test.com',
  name: 'User',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

const mockPrisma = {
  sectionMarker: {
    findMany:   jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
    findUnique: jest.fn(),
  },
}

const mockEmitter = { emit: jest.fn() }
const mockAccess = {
  assertCanViewSong: jest.fn(),
  assertCanEditSong: jest.fn(),
}

describe('SectionsService', () => {
  let service: SectionsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectionsService,
        { provide: PrismaService,  useValue: mockPrisma },
        { provide: EventEmitter2,  useValue: mockEmitter },
        { provide: ProjectAccessService, useValue: mockAccess },
      ],
    }).compile()
    service = module.get<SectionsService>(SectionsService)
    jest.clearAllMocks()
  })

  it('list returns all sections for a song', async () => {
    const rows = [
      { id: 's1', songId: 'song1', time: 0,    label: 'Intro',   color: '#6C63FF', createdAt: new Date() },
      { id: 's2', songId: 'song1', time: 30.0, label: 'Verse 1', color: '#06B6D4', createdAt: new Date() },
    ]
    mockPrisma.sectionMarker.findMany.mockResolvedValue(rows)

    const result = await service.list('song1', mockUser)
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('Intro')
    expect(mockPrisma.sectionMarker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { songId: 'song1' } }),
    )
  })

  it('create emits section.created event', async () => {
    const row = { id: 's1', songId: 'song1', time: 0, label: 'Intro', color: '#6C63FF', createdAt: new Date() }
    mockPrisma.sectionMarker.create.mockResolvedValue(row)

    await service.create(mockUser, 'song1', { time: 0, label: 'Intro', color: '#6C63FF' })

    expect(mockEmitter.emit).toHaveBeenCalledWith('section.created', expect.objectContaining({ songId: 'song1' }))
  })

  it('delete emits section.deleted event', async () => {
    const row = { id: 's1', songId: 'song1', time: 0, label: 'Intro', color: '#6C63FF', createdAt: new Date() }
    mockPrisma.sectionMarker.findUnique.mockResolvedValue(row)
    mockPrisma.sectionMarker.delete.mockResolvedValue(row)

    await service.delete('song1', 's1', mockUser)

    expect(mockEmitter.emit).toHaveBeenCalledWith('section.deleted', expect.objectContaining({ songId: 'song1' }))
  })
})
