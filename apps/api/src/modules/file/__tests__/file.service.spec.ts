import { FileService } from '../file.service'
import type { IStorageAdapter } from '../adapters/storage.interface'

function mockAdapter(): jest.Mocked<IStorageAdapter> {
  return {
    upload: jest.fn().mockResolvedValue(undefined),
    getPresignedUrl: jest.fn().mockResolvedValue('https://example.com/presigned'),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
  }
}

describe('FileService', () => {
  let adapter: jest.Mocked<IStorageAdapter>
  let service: FileService

  beforeEach(() => {
    adapter = mockAdapter()
    service = new FileService(adapter)
  })

  it('upload delegates to adapter with correct args', async () => {
    const buf = Buffer.from('audio')
    await service.upload('backing-tracks/song-1', buf, 'audio/mpeg')
    expect(adapter.upload).toHaveBeenCalledWith('backing-tracks/song-1', buf, 'audio/mpeg')
  })

  it('getPresignedUrl delegates to adapter with default ttl', async () => {
    const url = await service.getPresignedUrl('backing-tracks/song-1')
    expect(adapter.getPresignedUrl).toHaveBeenCalledWith('backing-tracks/song-1', 3600)
    expect(url).toBe('https://example.com/presigned')
  })

  it('getPresignedUrl passes custom ttl', async () => {
    await service.getPresignedUrl('backing-tracks/song-1', 7200)
    expect(adapter.getPresignedUrl).toHaveBeenCalledWith('backing-tracks/song-1', 7200)
  })

  it('delete delegates to adapter', async () => {
    await service.delete('backing-tracks/song-1')
    expect(adapter.delete).toHaveBeenCalledWith('backing-tracks/song-1')
  })

  it('backingTrackKey returns correct key format', () => {
    expect(service.backingTrackKey('song-abc')).toBe('backing-tracks/song-abc')
  })
})
