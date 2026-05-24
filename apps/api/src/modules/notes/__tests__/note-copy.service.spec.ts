import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { NoteCopyPreviewDto } from '../dto/note-copy.dto'
import { NoteCopyService } from '../note-copy.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import { ChartAnalyzeService } from '../../charts/chart-analyze.service'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { AuthUser } from '@ama-midi/shared'

const mockUser: AuthUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: false,
}

const songId = 'song-1'
const chartId = 'chart-1'
const updatedAt = new Date('2026-05-24T12:00:00.000Z')

function makeNote(overrides: Partial<{
  id: string
  track: number
  time: number
  title: string
  noteType: string
  duration: number | null
}> = {}) {
  return {
    id: overrides.id ?? 'note-a',
    chartId,
    songId,
    track: overrides.track ?? 1,
    time: overrides.time ?? 5.0,
    title: overrides.title ?? 'Tap',
    description: '',
    noteType: overrides.noteType ?? 'TAP',
    duration: overrides.duration ?? null,
    createdBy: 'user-1',
    createdAt: updatedAt,
    updatedAt,
    creator: { name: 'Test User', avatarUrl: null },
  }
}

describe('NoteCopyPreviewDto repeat validation', () => {
  it('accepts REPEAT_INTERVAL with repeat count and interval', async () => {
    const dto = plainToInstance(NoteCopyPreviewDto, {
      noteIds: ['a', 'b'],
      operation: 'COPY',
      mode: 'REPEAT_INTERVAL',
      repeatCount: 3,
      repeatInterval: 4.0,
    })

    await expect(validate(dto)).resolves.toHaveLength(0)
  })

  it('rejects REPEAT_INTERVAL without repeat parameters', async () => {
    const dto = plainToInstance(NoteCopyPreviewDto, {
      noteIds: ['a', 'b'],
      operation: 'COPY',
      mode: 'REPEAT_INTERVAL',
    })

    const errors = await validate(dto)
    expect(errors.map((error) => error.property).sort()).toEqual(['repeatCount', 'repeatInterval'])
  })
})

describe('NoteCopyService', () => {
  let service: NoteCopyService
  let prisma: {
    note: {
      findMany: jest.Mock
      findFirst: jest.Mock
      create: jest.Mock
      update: jest.Mock
    }
    $transaction: jest.Mock
    songChart: { findUnique: jest.Mock }
  }
  let eventEmitter: { emit: jest.Mock }
  let mockAccess: { assertCanEditSongChart: jest.Mock }
  let mockAnalyze: { run: jest.Mock }

  beforeEach(async () => {
    prisma = {
      note: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<void>) => callback(prisma)),
      songChart: {
        findUnique: jest.fn().mockResolvedValue({ songId }),
      },
    }
    eventEmitter = { emit: jest.fn() }
    mockAccess = { assertCanEditSongChart: jest.fn() }
    mockAnalyze = { run: jest.fn().mockResolvedValue(undefined) }

    const module = await Test.createTestingModule({
      providers: [
        NoteCopyService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ProjectAccessService, useValue: mockAccess },
        { provide: ChartAnalyzeService, useValue: mockAnalyze },
      ],
    }).compile()

    service = module.get(NoteCopyService)
  })

  function mockSelection(notes: ReturnType<typeof makeNote>[], existing: ReturnType<typeof makeNote>[] = []) {
    prisma.note.findMany.mockImplementation(async (args: { where?: { id?: { in?: string[] }; track?: { in?: number[] }; chartId?: string } }) => {
      if (args.where?.id?.in) {
        return notes.filter((note) => args.where!.id!.in!.includes(note.id))
      }
      if (args.where?.track?.in) {
        return existing.filter((note) => args.where!.track!.in!.includes(note.track))
      }
      return []
    })
  }

  describe('previewCopy', () => {
    it('TIME_SHIFT +2.0s moves all times and preserves tracks', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 5.0 }),
        makeNote({ id: 'b', track: 3, time: 10.0 }),
      ]
      mockSelection(notes)

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'TIME_SHIFT',
        timeDelta: 2.0,
      }, mockUser)

      expect(preview.creatable).toHaveLength(2)
      expect(preview.creatable[0]).toMatchObject({ track: 1, time: 7.0, sourceNoteId: 'a' })
      expect(preview.creatable[1]).toMatchObject({ track: 3, time: 12.0, sourceNoteId: 'b' })
      expect(preview.conflicts).toHaveLength(0)
    })

    it('TRACK_SHIFT targetTrack=3 with minTrack=1 applies delta +2', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 5.0 }),
        makeNote({ id: 'b', track: 2, time: 8.0 }),
      ]
      mockSelection(notes)

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'TRACK_SHIFT',
        targetTrack: 3,
      }, mockUser)

      expect(preview.creatable).toHaveLength(2)
      expect(preview.creatable[0]).toMatchObject({ track: 3, time: 5.0 })
      expect(preview.creatable[1]).toMatchObject({ track: 4, time: 8.0 })
    })

    it('TRACK_SHIFT rejects when any track exceeds 8', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 5.0 }),
        makeNote({ id: 'b', track: 7, time: 8.0 }),
      ]
      mockSelection(notes)

      await expect(service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'TRACK_SHIFT',
        targetTrack: 3,
      }, mockUser)).rejects.toThrow(BadRequestException)
    })

    it('TRACK_TIME_ANCHOR anchors earliest note to target track and time', async () => {
      const notes = [
        makeNote({ id: 'a', track: 2, time: 10.0 }),
        makeNote({ id: 'b', track: 4, time: 15.0 }),
      ]
      mockSelection(notes)

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'TRACK_TIME_ANCHOR',
        anchorTrack: 1,
        anchorTime: 0.0,
      }, mockUser)

      expect(preview.creatable[0]).toMatchObject({ track: 1, time: 0.0 })
      expect(preview.creatable[1]).toMatchObject({ track: 3, time: 5.0 })
    })

    it('MOVE excludes source IDs from overlap detection', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 5.0 }),
        makeNote({ id: 'b', track: 2, time: 8.0 }),
      ]
      mockSelection(notes, notes)

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'MOVE',
        mode: 'TIME_SHIFT',
        timeDelta: 0,
      }, mockUser)

      expect(preview.creatable).toHaveLength(2)
      expect(preview.conflicts).toHaveLength(0)
    })

    it('throws UnprocessableEntityException on internal collision', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 5.0, noteType: 'HOLD', duration: 10.0 }),
        makeNote({ id: 'b', track: 1, time: 10.0 }),
      ]
      mockSelection(notes)

      await expect(service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'TIME_SHIFT',
        timeDelta: 0,
      }, mockUser)).rejects.toThrow(UnprocessableEntityException)
    })

    it('REPEAT_INTERVAL creates multiple interval copies on the same tracks', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0, title: 'Kick' }),
        makeNote({ id: 'b', track: 3, time: 1.5, title: 'Snare' }),
      ]
      mockSelection(notes)

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 3,
        repeatInterval: 4.0,
      }, mockUser)

      expect(preview.mode).toBe('REPEAT_INTERVAL')
      expect(preview.creatable).toHaveLength(6)
      expect(preview.creatable.map((slot) => ({ id: slot.sourceNoteId, track: slot.track, time: slot.time }))).toEqual([
        { id: 'a', track: 1, time: 5.0 },
        { id: 'b', track: 3, time: 5.5 },
        { id: 'a', track: 1, time: 9.0 },
        { id: 'b', track: 3, time: 9.5 },
        { id: 'a', track: 1, time: 13.0 },
        { id: 'b', track: 3, time: 13.5 },
      ])
      expect(preview.summary.totalNotes).toBe(6)
    })

    it('REPEAT_INTERVAL detects conflicts with existing destination notes', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 1.5 }),
      ]
      const existing = [makeNote({ id: 'ex-1', track: 1, time: 5.0, title: 'Existing' })]
      mockSelection(notes, existing)

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 1,
        repeatInterval: 4.0,
      }, mockUser)

      expect(preview.creatable).toHaveLength(1)
      expect(preview.conflicts).toHaveLength(1)
      expect(preview.conflicts[0]).toMatchObject({ conflictId: 'ex-1', sourceNoteId: 'a', track: 1, time: 5.0 })
    })

    it('REPEAT_INTERVAL rejects MOVE operation', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 1.5 }),
      ]
      mockSelection(notes)

      await expect(service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'MOVE',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 2,
        repeatInterval: 4.0,
      }, mockUser)).rejects.toThrow(BadRequestException)
    })

    it('REPEAT_INTERVAL rejects generated slots above the copy cap', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 1.5 }),
      ]
      mockSelection(notes)

      await expect(service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 251,
        repeatInterval: 0.1,
      }, mockUser)).rejects.toThrow(BadRequestException)
    })

    it('REPEAT_INTERVAL rejects repeated hold notes that end after timeline max', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 298.0, noteType: 'HOLD', duration: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 298.5 }),
      ]
      mockSelection(notes)

      await expect(service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 1,
        repeatInterval: 1.5,
      }, mockUser)).rejects.toThrow(BadRequestException)
    })

    it('REPEAT_INTERVAL selection version changes when repeat parameters change', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 1.0 }),
        makeNote({ id: 'b', track: 2, time: 1.5 }),
      ]
      mockSelection(notes)

      const first = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 2,
        repeatInterval: 4.0,
      }, mockUser)
      const second = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'COPY',
        mode: 'REPEAT_INTERVAL',
        repeatCount: 3,
        repeatInterval: 4.0,
      }, mockUser)

      expect(first.selectionVersion).not.toBe(second.selectionVersion)
    })
  })

  describe('applyCopy', () => {
    it('MOVE with KEEP_EXISTING does not delete the source note', async () => {
      const notes = [
        makeNote({ id: 'a', track: 1, time: 5.0 }),
        makeNote({ id: 'b', track: 2, time: 8.0 }),
      ]
      const existing = [
        makeNote({ id: 'ex-1', track: 3, time: 5.0, title: 'Existing' }),
      ]
      mockSelection(notes, [...notes, ...existing])

      const preview = await service.previewCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'MOVE',
        mode: 'TRACK_SHIFT',
        targetTrack: 3,
      }, mockUser)

      expect(preview.conflicts).toHaveLength(1)
      expect(preview.conflicts[0].sourceNoteId).toBe('a')

      prisma.note.findFirst.mockImplementation(async (args: { where: { id: string } }) => {
        const all = [...notes, ...existing]
        return all.find((note) => note.id === args.where.id) ?? null
      })

      prisma.note.create.mockResolvedValue({
        id: 'new-b',
        songId,
        track: 4,
        time: 8.0,
        title: 'Tap',
        description: '',
        noteType: 'TAP',
        duration: null,
        createdBy: mockUser.id,
        createdAt: updatedAt,
        updatedAt,
        creator: { name: 'Test User', avatarUrl: null },
      })

      const result = await service.applyCopy(chartId, {
        noteIds: ['a', 'b'],
        operation: 'MOVE',
        mode: 'TRACK_SHIFT',
        targetTrack: 3,
        selectionVersion: preview.selectionVersion,
        resolutions: [{ conflictId: 'ex-1', action: 'KEEP_EXISTING' }],
      }, mockUser)

      expect(result.movedCount).toBe(1)
      expect(result.createdCount).toBe(1)
      expect(prisma.note.update).toHaveBeenCalledTimes(1)
      expect(prisma.note.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b' } }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTE_EVENTS.DELETED,
        expect.objectContaining({ noteId: 'b' }),
      )
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        NOTE_EVENTS.DELETED,
        expect.objectContaining({ noteId: 'a' }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        NOTE_EVENTS.BATCH_APPLIED,
        expect.objectContaining({ songId }),
      )
    })
  })
})
