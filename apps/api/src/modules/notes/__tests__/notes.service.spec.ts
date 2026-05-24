import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { NotesService } from '../notes.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import { ChartAnalyzeService } from '../../charts/chart-analyze.service'
import { EditorCommandService } from '../../editor-commands/editor-command.service'
import { NOTE_EVENTS } from '@ama-midi/shared'
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
    note: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock }
    noteEvent: { findFirst: jest.Mock; findMany: jest.Mock }
    songChart: { findUnique: jest.Mock }
  }
  let eventEmitter: { emit: jest.Mock }
  let mockAccess: { assertCanViewSong: jest.Mock; assertCanEditSong: jest.Mock; assertCanEditSongChart: jest.Mock }
  let mockAnalyze: { run: jest.Mock }

  beforeEach(async () => {
    prisma = {
      note: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      noteEvent: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      songChart: {
        findUnique: jest.fn().mockResolvedValue({ songId: 's1' }),
      },
    }
    eventEmitter = { emit: jest.fn() }
    mockAnalyze = { run: jest.fn().mockResolvedValue(undefined) }
    mockAccess = {
      assertCanViewSong: jest.fn(),
      assertCanEditSong: jest.fn(),
      assertCanEditSongChart: jest.fn(),
    }

    const module = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ProjectAccessService, useValue: mockAccess },
        { provide: ChartAnalyzeService, useValue: mockAnalyze },
        { provide: EditorCommandService, useValue: { record: jest.fn().mockResolvedValue({ id: 'cmd-mock' }) } },
      ],
    }).compile()

    service = module.get(NotesService)
  })

  describe('create', () => {
    it('checks edit access before creating a note', async () => {
      mockAccess.assertCanEditSong.mockResolvedValue({ id: 'song1', projectId: 'project1' })
      prisma.note.create.mockResolvedValue({
        id: 'n1',
        chartId: 'c1',
        songId: 's1',
        track: 1,
        time: 1,
        title: 'Tap',
        description: '',
        createdBy: 'u1',
        creator: { name: 'Composer' },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await service.create('c1', { track: 1, time: 1, title: 'Tap' }, mockUser)

      expect(mockAccess.assertCanEditSongChart).toHaveBeenCalledWith('s1', mockUser)
    })

    it('rounds time to 1 decimal place before insert', async () => {
      const mockNote = {
        id: 'n1', chartId: 'c1', songId: 's1', track: 1, time: 1.2, title: 'T',
        description: '', createdBy: 'user-1',
        createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Test User' },
      }
      prisma.note.create.mockResolvedValue(mockNote)

      await service.create('c1', { track: 1, time: 1.15, title: 'T' }, mockUser)

      expect(prisma.note.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ time: 1.2 }),
        }),
      )
    })

    it('throws 409 on duplicate position (P2002)', async () => {
      prisma.note.create.mockRejectedValue({ code: 'P2002' })
      await expect(service.create('c1', { track: 1, time: 5.0, title: 'T' }, mockUser))
        .rejects.toThrow(ConflictException)
    })

    it('emits note.created event on successful create', async () => {
      const mockNote = {
        id: 'n1', chartId: 'c1', songId: 's1', track: 1, time: 5.0, title: 'T',
        description: '', createdBy: 'user-1',
        createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Test User' },
      }
      prisma.note.create.mockResolvedValue(mockNote)

      await service.create('c1', { track: 1, time: 5.0, title: 'T' }, mockUser)

      expect(eventEmitter.emit).toHaveBeenCalledWith('note.created', expect.objectContaining({
        songId: 's1',
        noteId: 'n1',
        userId: 'user-1',
      }))
    })

    it('rejects HOLD note without duration', async () => {
      await expect(service.create('c1', {
        track: 1, time: 0, title: 'x', noteType: 'HOLD',
      } as any, mockUser)).rejects.toThrow('HOLD notes require duration')
    })

    it('throws 409 when HOLD span overlaps an existing note', async () => {
      prisma.note.findMany.mockResolvedValue([
        { time: 5.0, noteType: 'TAP', duration: null },
      ])

      await expect(service.create('c1', {
        track: 1,
        time: 4.0,
        title: 'Hold',
        noteType: 'HOLD',
        duration: 2.0,
      }, mockUser)).rejects.toThrow(ConflictException)

      expect(prisma.note.create).not.toHaveBeenCalled()
    })

    it('emits note.deleted event with beforeState on delete', async () => {
      const mockNote = {
        id: 'n1', chartId: 'c1', songId: 's1', track: 1, time: 5.0, title: 'T',
        description: '', createdBy: 'user-1',
        createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Test User' },
      }
      prisma.note.findFirst.mockResolvedValue(mockNote)
      prisma.note.update.mockResolvedValue({ ...mockNote, deletedAt: new Date() })

      await service.softDelete('c1', 'n1', mockUser)

      expect(eventEmitter.emit).toHaveBeenCalledWith('note.deleted', expect.objectContaining({
        songId: 's1',
        noteId: 'n1',
        beforeState: expect.objectContaining({ id: 'n1', track: 1, time: 5.0 }),
      }))
    })
  })

  describe('undo (legacy — removed)', () => {
    it.skip('finds and deletes last NOTE_CREATED by current user', async () => {
      const mockEvent = { id: 'e1', noteId: 'n1', songId: 's1', eventType: 'NOTE_CREATED', batchId: null }
      const mockNote = {
        id: 'n1', chartId: 'c1', songId: 's1', track: 1, time: 5.0, title: 'T',
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

      await (service as any).undo('c1', mockUser)

      expect(prisma.note.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'n1' }, data: { deletedAt: expect.any(Date) } }),
      )
    })

    it.skip('throws NotFoundException when nothing to undo', async () => {
      prisma.noteEvent.findFirst.mockResolvedValue(null)
      await expect((service as any).undo('s1', mockUser)).rejects.toThrow(NotFoundException)
    })

    it.skip('undo reverts every created note in the latest batch', async () => {
      prisma.noteEvent.findFirst.mockResolvedValue({
        id: 'e-batch',
        batchId: 'batch-1',
        eventType: 'NOTE_CREATED',
        noteId: 'n2',
      })
      prisma.noteEvent.findMany.mockResolvedValue([
        {
          id: 'e2',
          eventType: 'NOTE_CREATED',
          noteId: 'n2',
          batchId: 'batch-1',
          beforeState: null,
        },
        {
          id: 'e1',
          eventType: 'NOTE_CREATED',
          noteId: 'n1',
          batchId: 'batch-1',
          beforeState: null,
        },
      ])
      const mockNote = {
        id: 'n1',
        chartId: 'c1',
        songId: 's1',
        track: 1,
        time: 5.0,
        title: 'T',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Test User' },
      }
      prisma.note.findFirst
        .mockResolvedValueOnce({ ...mockNote, id: 'n2' })
        .mockResolvedValueOnce({ ...mockNote, id: 'n1' })

      await (service as any).undo('c1', mockUser)

      expect(prisma.note.update).toHaveBeenCalledTimes(2)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTE_EVENTS.BATCH_APPLIED,
        expect.objectContaining({
          songId: 's1',
          created: [],
          deletedIds: ['n2', 'n1'],
          actorId: mockUser.id,
        }),
      )
    })

    it.skip('undo restores notes deleted by a replacement batch', async () => {
      prisma.noteEvent.findFirst.mockResolvedValue({
        id: 'e-batch',
        batchId: 'batch-1',
        eventType: 'NOTE_DELETED',
        noteId: 'old-1',
      })
      prisma.noteEvent.findMany.mockResolvedValue([
        {
          id: 'e2',
          eventType: 'NOTE_DELETED',
          noteId: 'old-1',
          batchId: 'batch-1',
          beforeState: {
            track: 1,
            time: 5.0,
            title: 'Restored',
            noteType: 'TAP',
            createdBy: 'user-2',
          },
        },
      ])
      prisma.note.findMany.mockResolvedValue([])
      prisma.note.create.mockResolvedValue({
        id: 'restored-1',
        chartId: 'c1',
        songId: 's1',
        track: 1,
        time: 5.0,
        title: 'Restored',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Other' },
      })

      await (service as any).undo('c1', mockUser)

      expect(prisma.note.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Restored', track: 1, time: 5.0 }),
        }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTE_EVENTS.BATCH_APPLIED,
        expect.objectContaining({
          songId: 's1',
          created: [
            expect.objectContaining({
              id: 'restored-1',
              track: 1,
              time: 5.0,
            }),
          ],
          deletedIds: [],
          actorId: mockUser.id,
        }),
      )
    })

    it.skip('undo keeps single-note undo behavior when latest event has no batchId', async () => {
      const mockEvent = { id: 'e1', noteId: 'n1', songId: 's1', eventType: 'NOTE_CREATED', batchId: null }
      const mockNote = {
        id: 'n1', chartId: 'c1', songId: 's1', track: 1, time: 5.0, title: 'T',
        description: '', createdBy: 'user-1', noteType: 'TAP', duration: null,
        createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Test User' },
        deletedAt: null,
      }
      prisma.noteEvent.findFirst.mockResolvedValue(mockEvent)
      prisma.note.findFirst
        .mockResolvedValueOnce(mockNote)
        .mockResolvedValueOnce(mockNote)
      prisma.note.update.mockResolvedValue({ ...mockNote, deletedAt: new Date() })

      await (service as any).undo('c1', mockUser)

      expect(prisma.noteEvent.findMany).not.toHaveBeenCalled()
      expect(prisma.note.update).toHaveBeenCalledTimes(1)
    })
  })
})
