import { NotFoundException } from '@nestjs/common'
import { UndoService } from '../undo.service'

describe('UndoService', () => {
  const editorEvents = {
    findLatestUndoable: jest.fn(),
    findUndoableBatch: jest.fn(),
    markUndone: jest.fn(),
    record: jest.fn(),
  }
  const prisma = {
    songChart: { findUnique: jest.fn().mockResolvedValue({ songId: 'song-1' }) },
    note: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    sectionMarker: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), delete: jest.fn() },
  }
  const events = { emit: jest.fn() }
  const access = { assertCanEditSongChart: jest.fn() }
  const analyze = { run: jest.fn() }

  beforeEach(() => jest.clearAllMocks())

  it('reverts a note update using beforeState', async () => {
    prisma.songChart.findUnique.mockResolvedValue({ songId: 'song-1' })
    editorEvents.findLatestUndoable.mockResolvedValue({
      id: 'event-1',
      songId: 'song-1',
      chartId: 'chart-1',
      entityType: 'NOTE',
      entityId: 'note-1',
      eventType: 'NOTE_UPDATED',
      beforeState: {
        id: 'note-1',
        chartId: 'chart-1',
        songId: 'song-1',
        track: 2,
        time: 4,
        title: 'Before',
        description: '',
        noteType: 'TAP',
        createdBy: 'user-1',
      },
      batchId: null,
    })
    prisma.note.findFirst.mockResolvedValue({ id: 'note-1', chartId: 'chart-1', songId: 'song-1', createdBy: 'user-1' })
    prisma.note.update.mockResolvedValue({
      id: 'note-1',
      chartId: 'chart-1',
      songId: 'song-1',
      track: 2,
      time: 4,
      title: 'Before',
      description: '',
      noteType: 'TAP',
      duration: null,
      createdBy: 'user-1',
      createdAt: new Date('2026-05-24T10:00:00Z'),
      updatedAt: new Date('2026-05-24T10:00:01Z'),
      creator: { name: 'Huy', avatarUrl: null },
    })
    editorEvents.record.mockResolvedValue({ id: 'undo-event-1' })

    const service = new UndoService(prisma as any, editorEvents as any, events as any, access as any, analyze as any)

    await service.undo('chart-1', { id: 'user-1', role: 'ADMIN', email: 'a@test.com', name: 'Huy' } as any)

    expect(prisma.note.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'note-1' },
      data: expect.objectContaining({ title: 'Before', description: '', noteType: 'TAP' }),
    }))
    expect(editorEvents.markUndone).toHaveBeenCalledWith(['event-1'], 'undo-event-1')
  })

  it('throws when there is no undoable event', async () => {
    prisma.songChart.findUnique.mockResolvedValue({ songId: 'song-1' })
    editorEvents.findLatestUndoable.mockResolvedValue(null)
    const service = new UndoService(prisma as any, editorEvents as any, events as any, access as any, analyze as any)

    await expect(service.undo('chart-1', { id: 'user-1' } as any)).rejects.toBeInstanceOf(NotFoundException)
  })
})
