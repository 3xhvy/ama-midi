jest.mock('ioredis', () => {
  const mockInstance = {
    set:  jest.fn().mockResolvedValue('OK'),
    del:  jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    mget: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
  }
  const MockRedis = jest.fn().mockImplementation(() => mockInstance)
  return { __esModule: true, default: MockRedis }
})

import Redis from 'ioredis'
import { CursorService, type StoredCursor } from '../cursor.service'

const getInstance = () => (Redis as jest.MockedClass<typeof Redis>).mock.results[0].value

const cursor: StoredCursor = {
  userId: 'user-1',
  name:   'Alice',
  title:  'Composer',
  track:  3,
  time:   42.5,
}

describe('CursorService', () => {
  let service: CursorService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CursorService()
  })

  describe('setCursor', () => {
    it('writes JSON to Redis with 5s TTL', async () => {
      await service.setCursor('song-1', 'user-1', cursor)
      expect(getInstance().set).toHaveBeenCalledWith(
        'cursor:song-1:user-1',
        JSON.stringify(cursor),
        'EX',
        5,
      )
    })
  })

  describe('getCursors', () => {
    it('returns empty array when no keys exist', async () => {
      getInstance().keys.mockResolvedValue([])
      const result = await service.getCursors('song-1')
      expect(result).toEqual([])
    })

    it('returns parsed cursors for all keys in song', async () => {
      getInstance().keys.mockResolvedValue(['cursor:song-1:user-1', 'cursor:song-1:user-2'])
      getInstance().mget.mockResolvedValue([
        JSON.stringify(cursor),
        JSON.stringify({ ...cursor, userId: 'user-2', name: 'Bob' }),
      ])
      const result = await service.getCursors('song-1')
      expect(result).toHaveLength(2)
      expect(result[0].userId).toBe('user-1')
      expect(result[1].userId).toBe('user-2')
    })

    it('filters out null values (TTL-expired keys)', async () => {
      getInstance().keys.mockResolvedValue(['cursor:song-1:user-1', 'cursor:song-1:user-2'])
      getInstance().mget.mockResolvedValue([JSON.stringify(cursor), null])
      const result = await service.getCursors('song-1')
      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe('user-1')
    })
  })

  describe('deleteCursor', () => {
    it('deletes the correct Redis key', async () => {
      await service.deleteCursor('song-1', 'user-1')
      expect(getInstance().del).toHaveBeenCalledWith('cursor:song-1:user-1')
    })
  })

  describe('onModuleDestroy', () => {
    it('quits the Redis connection', async () => {
      await service.onModuleDestroy()
      expect(getInstance().quit).toHaveBeenCalled()
    })
  })
})
