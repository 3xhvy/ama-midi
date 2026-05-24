import { EditorEventService } from '../editor-event.service'

describe('EditorEventService', () => {
  const prisma = {
    editorEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any

  beforeEach(() => jest.clearAllMocks())

  it('writes a note created event as undoable', async () => {
    prisma.editorEvent.create.mockResolvedValue({ id: 'event-1' })
    const service = new EditorEventService(prisma)

    await service.record({
      songId: 'song-1',
      chartId: 'chart-1',
      entityType: 'NOTE',
      entityId: 'note-1',
      eventType: 'NOTE_CREATED',
      userId: 'user-1',
      afterState: { id: 'note-1' },
      undoable: true,
    })

    expect(prisma.editorEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        songId: 'song-1',
        chartId: 'chart-1',
        entityType: 'NOTE',
        entityId: 'note-1',
        eventType: 'NOTE_CREATED',
        userId: 'user-1',
        afterState: { id: 'note-1' },
        undoable: true,
      }),
    })
  })

  it('finds latest undoable event for a user', async () => {
    prisma.editorEvent.findMany.mockResolvedValue([{ id: 'event-1', batchId: null }])
    const service = new EditorEventService(prisma)

    const result = await service.findLatestUndoable('song-1', 'user-1', 'chart-1')

    expect(result?.id).toBe('event-1')
    expect(prisma.editorEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        songId: 'song-1',
        userId: 'user-1',
        chartId: 'chart-1',
        undoable: true,
        undoneByEventId: null,
      }),
      orderBy: { createdAt: 'desc' },
      take: 1,
    }))
  })
})
