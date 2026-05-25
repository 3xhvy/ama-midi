import { mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { LocalStorageAdapter } from '../adapters/local.adapter'

const TMP = join(process.cwd(), 'tmp-test-local-adapter')

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter

  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true })
    adapter = new LocalStorageAdapter(TMP)
  })

  afterAll(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('upload writes buffer to disk', async () => {
    await adapter.upload('backing-tracks/song-1', Buffer.from('hello'), 'audio/mpeg')
    const { readFileSync } = await import('fs')
    const content = readFileSync(join(TMP, 'backing-tracks/song-1'))
    expect(content.toString()).toBe('hello')
  })

  it('exists returns true after upload', async () => {
    await adapter.upload('backing-tracks/song-2', Buffer.from('x'), 'audio/mpeg')
    expect(await adapter.exists('backing-tracks/song-2')).toBe(true)
  })

  it('exists returns false for missing key', async () => {
    expect(await adapter.exists('backing-tracks/nope')).toBe(false)
  })

  it('delete removes the file', async () => {
    await adapter.upload('backing-tracks/song-3', Buffer.from('y'), 'audio/mpeg')
    await adapter.delete('backing-tracks/song-3')
    expect(await adapter.exists('backing-tracks/song-3')).toBe(false)
  })

  it('delete is a no-op for missing key', async () => {
    await expect(adapter.delete('backing-tracks/nope')).resolves.toBeUndefined()
  })

  it('getPresignedUrl returns local serve path', async () => {
    const url = await adapter.getPresignedUrl('backing-tracks/song-1')
    expect(url).toBe('/files/local/backing-tracks/song-1')
  })
})
