import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PatternPasteService } from '../pattern-paste.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
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

const patternRow = {
  id:        'pattern-1',
  name:      'Kick Pattern',
  notes:     [
    { track: 1, timeOffset: 0, noteType: 'TAP' },
    { track: 2, timeOffset: 0.5, noteType: 'TAP' },
  ],
  createdBy: 'user-1',
  songId:    null,
  createdAt: new Date('2026-05-23T10:00:00.000Z'),
  updatedAt: new Date('2026-05-23T12:00:00.000Z'),
}

describe('PatternPasteService', () => {
  let service: PatternPasteService
  let prisma: {
    notePattern: { findUnique: jest.Mock }
    note: {
      findMany: jest.Mock
      findFirst: jest.Mock
      create: jest.Mock
      update: jest.Mock
    }
    $transaction: jest.Mock
  }
  let eventEmitter: { emit: jest.Mock }
  let mockAccess: { assertCanEditSongChart: jest.Mock }

  beforeEach(async () => {
    prisma = {
      notePattern: { findUnique: jest.fn() },
      note: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma)),
    }
    eventEmitter = { emit: jest.fn() }
    mockAccess = { assertCanEditSongChart: jest.fn() }

    const module = await Test.createTestingModule({
      providers: [
        PatternPasteService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ProjectAccessService, useValue: mockAccess },
      ],
    }).compile()

    service = module.get(PatternPasteService)
    prisma.notePattern.findUnique.mockResolvedValue(patternRow)
  })

  describe('previewPaste', () => {
    it('previews all notes as creatable when no existing note overlaps', async () => {
      const preview = await service.previewPaste('pattern-1', { songId: 'song-1', startTime: 10 }, mockUser)

      expect(mockAccess.assertCanEditSongChart).toHaveBeenCalledWith('song-1', mockUser)
      expect(preview.summary.totalPatternNotes).toBe(2)
      expect(preview.summary.creatableNotes).toBe(2)
      expect(preview.summary.conflictCount).toBe(0)
      expect(preview.creatable).toHaveLength(2)
    })

    it('returns conflict details including existing note creator fields', async () => {
      prisma.note.findMany.mockResolvedValue([
        {
          id: 'existing-1',
          songId: 'song-1',
          track: 1,
          time: 10,
          title: 'Existing Tap',
          description: 'desc',
          noteType: 'TAP',
          duration: null,
          createdBy: 'user-2',
          createdAt: new Date('2026-05-20T10:00:00.000Z'),
          updatedAt: new Date('2026-05-20T10:00:00.000Z'),
          creator: { name: 'Other Composer', avatarUrl: 'https://avatar.test/a.png' },
        },
      ])

      const preview = await service.previewPaste('pattern-1', { songId: 'song-1', startTime: 10 }, mockUser)

      expect(preview.summary.conflictCount).toBe(1)
      expect(preview.conflicts[0]).toMatchObject({
        conflictId: 'existing-1',
        existingNote: {
          id: 'existing-1',
          title: 'Existing Tap',
          creatorName: 'Other Composer',
          creatorAvatarUrl: 'https://avatar.test/a.png',
          createdBy: 'user-2',
        },
      })
    })

    it('returns latest patternVersion from pattern updatedAt', async () => {
      const preview = await service.previewPaste('pattern-1', { songId: 'song-1', startTime: 10 }, mockUser)
      expect(preview.patternVersion).toBe('2026-05-23T12:00:00.000Z')
    })

    it('uses existing note id as stable conflictId', async () => {
      prisma.note.findMany.mockResolvedValue([
        {
          id: 'stable-id',
          songId: 'song-1',
          track: 1,
          time: 10,
          title: 'Tap',
          description: '',
          noteType: 'TAP',
          duration: null,
          createdBy: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { name: 'Other' },
        },
      ])

      const preview = await service.previewPaste('pattern-1', { songId: 'song-1', startTime: 10 }, mockUser)

      expect(preview.conflicts[0].conflictId).toBe('stable-id')
    })

    it('rejects patterns larger than 500 notes', async () => {
      prisma.notePattern.findUnique.mockResolvedValue({
        ...patternRow,
        notes: Array.from({ length: 501 }, (_, i) => ({
          track: 1,
          timeOffset: i * 0.1,
          noteType: 'TAP',
        })),
      })

      await expect(
        service.previewPaste('pattern-1', { songId: 'song-1', startTime: 0 }, mockUser),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })

  describe('applyPaste', () => {
    const patternVersion = patternRow.updatedAt.toISOString()

    it('applies safe notes and skips conflicts marked KEEP_EXISTING', async () => {
      prisma.note.findMany.mockResolvedValue([
        {
          id: 'existing-1',
          songId: 'song-1',
          track: 1,
          time: 10,
          title: 'Existing',
          description: '',
          noteType: 'TAP',
          duration: null,
          createdBy: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { name: 'Other' },
        },
      ])
      prisma.note.create.mockImplementation(({ data }: any) => Promise.resolve({
        id: `created-${data.track}`,
        songId: data.songId,
        track: data.track,
        time: data.time,
        title: data.title,
        description: data.description,
        noteType: data.noteType,
        duration: data.duration,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Test User' },
      }))

      const result = await service.applyPaste('pattern-1', {
        songId: 'song-1',
        startTime: 10,
        patternVersion,
        resolutions: [{ conflictId: 'existing-1', action: 'KEEP_EXISTING' }],
      }, mockUser)

      expect(result.createdCount).toBe(1)
      expect(result.replacedCount).toBe(0)
      expect(result.skippedCount).toBe(1)
      expect(prisma.note.update).not.toHaveBeenCalled()
    })

    it('soft-deletes conflicting notes and creates replacements for REPLACE_WITH_PATTERN', async () => {
      prisma.note.findMany.mockResolvedValue([
        {
          id: 'existing-1',
          songId: 'song-1',
          track: 1,
          time: 10,
          title: 'Existing',
          description: '',
          noteType: 'TAP',
          duration: null,
          createdBy: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { name: 'Other' },
        },
      ])
      prisma.note.findFirst.mockResolvedValue({
        id: 'existing-1',
        songId: 'song-1',
        track: 1,
        time: 10,
        title: 'Existing',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Other' },
      })
      prisma.note.create.mockImplementation(({ data }: any) => Promise.resolve({
        id: `created-${data.track}`,
        songId: data.songId,
        track: data.track,
        time: data.time,
        title: data.title,
        description: data.description,
        noteType: data.noteType,
        duration: data.duration,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Test User' },
      }))

      const result = await service.applyPaste('pattern-1', {
        songId: 'song-1',
        startTime: 10,
        patternVersion,
        resolutions: [{ conflictId: 'existing-1', action: 'REPLACE_WITH_PATTERN' }],
      }, mockUser)

      expect(result.replacedCount).toBe(1)
      expect(prisma.note.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'existing-1' } }),
      )
      expect(result.createdCount).toBe(2)
    })

    it('returns 409 with fresh preview when patternVersion changes', async () => {
      await expect(
        service.applyPaste('pattern-1', {
          songId: 'song-1',
          startTime: 10,
          patternVersion: 'stale-version',
          resolutions: [],
        }, mockUser),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'PATTERN_VERSION_CHANGED',
          preview: expect.objectContaining({ patternId: 'pattern-1' }),
        }),
      })
    })

    it('returns 409 with fresh preview when current conflict ids differ from requested resolutions', async () => {
      prisma.note.findMany.mockResolvedValue([
        {
          id: 'existing-1',
          songId: 'song-1',
          track: 1,
          time: 10,
          title: 'Existing',
          description: '',
          noteType: 'TAP',
          duration: null,
          createdBy: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { name: 'Other' },
        },
      ])

      await expect(
        service.applyPaste('pattern-1', {
          songId: 'song-1',
          startTime: 10,
          patternVersion,
          resolutions: [{ conflictId: 'wrong-id', action: 'KEEP_EXISTING' }],
        }, mockUser),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'CONFLICTS_CHANGED',
          preview: expect.objectContaining({ patternId: 'pattern-1' }),
        }),
      })
    })

    it('emits one batch applied event with created notes and deleted ids', async () => {
      prisma.note.findMany.mockResolvedValue([
        {
          id: 'existing-1',
          songId: 'song-1',
          track: 1,
          time: 10,
          title: 'Existing',
          description: '',
          noteType: 'TAP',
          duration: null,
          createdBy: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { name: 'Other' },
        },
      ])
      prisma.note.findFirst.mockResolvedValue({
        id: 'existing-1',
        songId: 'song-1',
        track: 1,
        time: 10,
        title: 'Existing',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Other' },
      })
      prisma.note.create.mockImplementation(({ data }: any) => Promise.resolve({
        id: `created-${data.track}`,
        songId: data.songId,
        track: data.track,
        time: data.time,
        title: data.title,
        description: data.description,
        noteType: data.noteType,
        duration: data.duration,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { name: 'Test User' },
      }))

      await service.applyPaste('pattern-1', {
        songId: 'song-1',
        startTime: 10,
        patternVersion,
        resolutions: [{ conflictId: 'existing-1', action: 'REPLACE_WITH_PATTERN' }],
      }, mockUser)

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTE_EVENTS.BATCH_APPLIED,
        expect.objectContaining({
          songId: 'song-1',
          deletedIds: ['existing-1'],
          created: expect.any(Array),
          actorId: mockUser.id,
        }),
      )
    })
  })
})
