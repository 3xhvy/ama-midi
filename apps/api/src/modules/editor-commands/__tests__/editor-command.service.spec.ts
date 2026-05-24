import { Test } from '@nestjs/testing'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { EditorCommandService } from '../editor-command.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('EditorCommandService', () => {
  let service: EditorCommandService
  let prisma: any

  const mockCommand = {
    id: 'cmd-1',
    songId: 'song-1',
    chartId: 'chart-1',
    commandType: 'SINGLE_NOTE_CREATED',
    userId: 'user-1',
    summary: { track: 3, time: 4.0 },
    undoable: true,
    isCompensation: false,
    undoneByCommandId: null,
    createdAt: new Date(),
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EditorCommandService,
        {
          provide: PrismaService,
          useValue: {
            editorCommand: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            editorEvent: {
              findMany: jest.fn(),
              create: jest.fn(),
            },
            note: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            sectionMarker: {
              delete: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile()

    service = module.get(EditorCommandService)
    prisma = module.get(PrismaService)
  })

  describe('record', () => {
    it('creates a command row with defaults', async () => {
      prisma.editorCommand.create.mockResolvedValue(mockCommand)
      const result = await service.record({
        songId: 'song-1',
        chartId: 'chart-1',
        commandType: 'SINGLE_NOTE_CREATED',
        userId: 'user-1',
        summary: { track: 3, time: 4.0 },
      })
      expect(prisma.editorCommand.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          songId: 'song-1',
          chartId: 'chart-1',
          commandType: 'SINGLE_NOTE_CREATED',
          undoable: true,
          isCompensation: false,
        }),
      })
      expect(result.id).toBe('cmd-1')
    })
  })

  describe('findUndoStack', () => {
    it('returns undoable, non-compensated, non-undone commands for the user', async () => {
      prisma.editorCommand.findMany.mockResolvedValue([mockCommand])
      const result = await service.findUndoStack('chart-1', 'user-1')
      expect(prisma.editorCommand.findMany).toHaveBeenCalledWith({
        where: {
          chartId: 'chart-1',
          userId: 'user-1',
          undoable: true,
          isCompensation: false,
          undoneByCommandId: null,
        },
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toHaveLength(1)
    })

    it('returns empty array when nothing to undo', async () => {
      prisma.editorCommand.findMany.mockResolvedValue([])
      const result = await service.findUndoStack('chart-1', 'user-1')
      expect(result).toHaveLength(0)
    })
  })

  describe('previewUndo', () => {
    it('throws NotFoundException when stack is empty', async () => {
      prisma.editorCommand.findMany.mockResolvedValue([])
      await expect(service.previewUndo('chart-1', 'user-1')).rejects.toThrow(NotFoundException)
    })

    it('returns preview with empty conflicts when no NOTE_DELETED mutations', async () => {
      prisma.editorCommand.findMany.mockResolvedValue([mockCommand])
      prisma.editorEvent.findMany.mockResolvedValue([])
      const result = await service.previewUndo('chart-1', 'user-1')
      expect(result.commandId).toBe('cmd-1')
      expect(result.conflicts).toHaveLength(0)
    })

    it('returns conflicts when a restored note slot is occupied', async () => {
      const deletedMutation = {
        id: 'ev-1',
        commandId: 'cmd-1',
        entityId: 'note-deleted-1',
        eventType: 'NOTE_DELETED',
        beforeState: { id: 'note-deleted-1', track: 3, time: 4.0, chartId: 'chart-1', title: 'A', description: '', noteType: 'TAP' },
      }
      const occupant = {
        id: 'note-occupant',
        track: 3,
        time: 4.0,
        title: 'B',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Other', avatarUrl: null },
      }

      prisma.editorCommand.findMany.mockResolvedValue([mockCommand])
      prisma.editorEvent.findMany.mockResolvedValue([deletedMutation])
      prisma.note.findFirst.mockResolvedValue(occupant)

      const result = await service.previewUndo('chart-1', 'user-1')
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].conflictId).toBe('note-occupant')
      expect(result.conflicts[0].track).toBe(3)
    })

    it('returns no conflict when the slot is free', async () => {
      const deletedMutation = {
        id: 'ev-1',
        commandId: 'cmd-1',
        entityId: 'note-deleted-1',
        eventType: 'NOTE_DELETED',
        beforeState: { id: 'note-deleted-1', track: 3, time: 4.0, chartId: 'chart-1', title: 'A', description: '', noteType: 'TAP' },
      }

      prisma.editorCommand.findMany.mockResolvedValue([mockCommand])
      prisma.editorEvent.findMany.mockResolvedValue([deletedMutation])
      prisma.note.findFirst.mockResolvedValue(null)

      const result = await service.previewUndo('chart-1', 'user-1')
      expect(result.conflicts).toHaveLength(0)
    })
  })

  describe('applyUndo', () => {
    it('throws NotFoundException when commandId not found', async () => {
      prisma.editorCommand.findUnique.mockResolvedValue(null)
      await expect(service.applyUndo('chart-1', 'user-1', 'missing-id', [])).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when command already undone', async () => {
      prisma.editorCommand.findUnique.mockResolvedValue({ ...mockCommand, undoneByCommandId: 'already-undone' })
      await expect(service.applyUndo('chart-1', 'user-1', 'cmd-1', [])).rejects.toThrow(NotFoundException)
    })

    it('soft-deletes a created note for SINGLE_NOTE_CREATED undo', async () => {
      const createdMutation = {
        id: 'ev-1', commandId: 'cmd-1', entityId: 'note-1',
        entityType: 'NOTE', eventType: 'NOTE_CREATED',
        songId: 'song-1', beforeState: null,
        afterState: { id: 'note-1', songId: 'song-1', chartId: 'chart-1', track: 3, time: 4.0 },
      }
      const existingNote = {
        id: 'note-1', songId: 'song-1', chartId: 'chart-1', track: 3, time: 4.0,
        title: 'A', description: '', noteType: 'TAP', duration: null,
        createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date(),
        creator: { name: 'Huy', avatarUrl: null },
      }
      const undoCommand = { id: 'cmd-undo-1', songId: 'song-1', chartId: 'chart-1', commandType: 'UNDO', userId: 'user-1', summary: {}, undoable: false, isCompensation: true, undoneByCommandId: null, createdAt: new Date() }

      prisma.editorCommand.findUnique.mockResolvedValue(mockCommand)
      prisma.editorEvent.findMany.mockResolvedValue([createdMutation])
      prisma.note.findFirst.mockResolvedValue(existingNote)
      prisma.note.update.mockResolvedValue({ ...existingNote, deletedAt: new Date() })
      prisma.editorCommand.create.mockResolvedValue(undoCommand)
      prisma.editorCommand.update.mockResolvedValue({})
      prisma.editorEvent.create.mockResolvedValue({})

      const result = await service.applyUndo('chart-1', 'user-1', 'cmd-1', [])
      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { deletedAt: expect.any(Date) },
      })
      expect(result.commandType).toBe('UNDO')
    })
  })
})
