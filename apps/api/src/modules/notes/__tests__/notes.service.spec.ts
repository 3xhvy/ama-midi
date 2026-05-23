import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { NotesService } from '../notes.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const mockUser: AuthUser = {
  id:              'user-1',
  email:           'test@test.com',
  name:            'Test User',
  role:            'COMPOSER',
  profileComplete: true,
  tourComplete:    false,
}

describe('NotesService', () => {
  let service: NotesService
  let prisma: {
    note: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock }
    noteEvent: { findFirst: jest.Mock }
  }
  let eventEmitter: { emit: jest.Mock }
  let mockAccess: { assertCanViewSong: jest.Mock; assertCanEditSong: jest.Mock }

  beforeEach(async () => {
    prisma = {
      note: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      noteEvent: {
        findFirst: jest.fn(),
      },
    }
    eventEmitter = { emit: jest.fn() }
    mockAccess = { assertCanViewSong: jest.fn(), assertCanEditSong: jest.fn() }

    const module = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ProjectAccessService, useValue: mockAccess },
      ],
    }).compile()

    service = module.get(NotesService)
  })

  describe('create', () => {
    it('checks edit access before creating a note', async () => {
      mockAccess.assertCanEditSong.mockResolvedValue({ id: 'song1', projectId: 'project1' })
      prisma.note.create.mockResolvedValue({
        id: 'n1',
        songId: 'song1',
        track: 1,
        time: 1,
        title: 'Tap',
        description: '',
        createdBy: 'u1',
        creator: { name: 'Composer' },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await service.create('song1', { track: 1, time: 1, title: 'Tap' }, mockUser)

      expect(mockAccess.assertCanEditSong).toHaveBeenCalledWith('song1', mockUser)
    })

    it('rounds time to 1 decimal place before insert', async () => {
      const mockNote = {
        id: 'n1', songId: 's1', track: 1, time: 1.2, title: 'T',
        description: '', createdBy: 'user-1',
        createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Test User' },
      }
      prisma.note.create.mockResolvedValue(mockNote)

      await service.create('s1', { track: 1, time: 1.15, title: 'T' }, mockUser)

      expect(prisma.note.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ time: 1.2 }),
        }),
      )
    })

    it('throws 409 on duplicate position (P2002)', async () => {
      prisma.note.create.mockRejectedValue({ code: 'P2002' })
      await expect(service.create('s1', { track: 1, time: 5.0, title: 'T' }, mockUser))
        .rejects.toThrow(ConflictException)
    })

    it('emits note.created event on successful create', async () => {
      const mockNote = {
        id: 'n1', songId: 's1', track: 1, time: 5.0, title: 'T',
        description: '', createdBy: 'user-1',
        createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Test User' },
      }
      prisma.note.create.mockResolvedValue(mockNote)

      await service.create('s1', { track: 1, time: 5.0, title: 'T' }, mockUser)

      expect(eventEmitter.emit).toHaveBeenCalledWith('note.created', expect.objectContaining({
        songId: 's1',
        noteId: 'n1',
        userId: 'user-1',
      }))
    })

    it('rejects HOLD note without duration', async () => {
      await expect(service.create('s1', {
        track: 1, time: 0, title: 'x', noteType: 'HOLD',
      } as any, mockUser)).rejects.toThrow('HOLD notes require duration')
    })

    it('emits note.deleted event with beforeState on delete', async () => {
      const mockNote = {
        id: 'n1', songId: 's1', track: 1, time: 5.0, title: 'T',
        description: '', createdBy: 'user-1',
        createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Test User' },
      }
      prisma.note.findFirst.mockResolvedValue(mockNote)
      prisma.note.update.mockResolvedValue({ ...mockNote, deletedAt: new Date() })

      await service.softDelete('s1', 'n1', mockUser)

      expect(eventEmitter.emit).toHaveBeenCalledWith('note.deleted', expect.objectContaining({
        songId: 's1',
        noteId: 'n1',
        beforeState: expect.objectContaining({ id: 'n1', track: 1, time: 5.0 }),
      }))
    })
  })

  describe('undo', () => {
    it('finds and deletes last NOTE_CREATED by current user', async () => {
      const mockEvent = { id: 'e1', noteId: 'n1', songId: 's1', eventType: 'NOTE_CREATED' }
      const mockNote = {
        id: 'n1', songId: 's1', track: 1, time: 5.0, title: 'T',
        description: '', createdBy: 'user-1',
        createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Test User' },
        deletedAt: null,
      }
      prisma.noteEvent.findFirst.mockResolvedValue(mockEvent)
      prisma.note.findFirst
        .mockResolvedValueOnce(mockNote)
        .mockResolvedValueOnce(mockNote)
      prisma.note.update.mockResolvedValue({ ...mockNote, deletedAt: new Date() })

      await service.undo('s1', mockUser)

      expect(prisma.note.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'n1' }, data: { deletedAt: expect.any(Date) } }),
      )
    })

    it('throws NotFoundException when nothing to undo', async () => {
      prisma.noteEvent.findFirst.mockResolvedValue(null)
      await expect(service.undo('s1', mockUser)).rejects.toThrow(NotFoundException)
    })
  })
})
