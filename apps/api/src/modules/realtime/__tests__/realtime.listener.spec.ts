import { RealtimeListener } from '../realtime.listener'

describe('RealtimeListener', () => {
  const gateway = { broadcastToSong: jest.fn(), server: { to: jest.fn() } }
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Huy', avatarUrl: null }),
    },
  }

  beforeEach(() => jest.clearAllMocks())

  it('wraps note-created payload with actor', async () => {
    const listener = new RealtimeListener(gateway as any, prisma as any)

    await listener.onNoteCreated({
      songId: 'song-1',
      noteId: 'note-1',
      userId: 'u1',
      afterState: { id: 'note-1', chartId: 'chart-1' } as any,
    })

    expect(gateway.broadcastToSong).toHaveBeenCalledWith('song-1', 'note-created', {
      actor: { id: 'u1', name: 'Huy', avatarUrl: null },
      data: { id: 'note-1', chartId: 'chart-1' },
    })
  })

  it('falls back when actor lookup fails', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null)
    const listener = new RealtimeListener(gateway as any, prisma as any)

    await listener.onNotesBatchApplied({
      songId: 'song-1',
      batchId: 'batch-1',
      created: [],
      deletedIds: [],
      actorId: 'missing',
    })

    expect(gateway.broadcastToSong).toHaveBeenCalledWith('song-1', 'notes-batch-applied', {
      actor: { id: 'missing', name: 'Someone', avatarUrl: null },
      data: expect.objectContaining({ batchId: 'batch-1' }),
    })
  })
})
