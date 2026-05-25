import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { R2StorageAdapter } from '../adapters/r2.adapter'

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3')
  return { ...actual, S3Client: jest.fn() }
})
jest.mock('@aws-sdk/s3-request-presigner')

const mockSend = jest.fn()
;(S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }))
;(getSignedUrl as jest.Mock).mockResolvedValue('https://r2.example.com/presigned')

describe('R2StorageAdapter', () => {
  let adapter: R2StorageAdapter

  beforeEach(() => {
    jest.clearAllMocks()
    adapter = new R2StorageAdapter({
      endpoint: 'https://account.r2.cloudflarestorage.com',
      bucket: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    })
  })

  it('upload sends PutObjectCommand with correct params', async () => {
    mockSend.mockResolvedValue({})
    await adapter.upload('backing-tracks/song-1', Buffer.from('data'), 'audio/mpeg')

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call).toBeInstanceOf(PutObjectCommand)
    expect(call.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'backing-tracks/song-1',
      ContentType: 'audio/mpeg',
    })
    expect(call.input.Body).toBeInstanceOf(Buffer)
  })

  it('getPresignedUrl calls getSignedUrl with GetObjectCommand and default ttl 3600', async () => {
    const url = await adapter.getPresignedUrl('backing-tracks/song-1')
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(GetObjectCommand),
      { expiresIn: 3600 },
    )
    expect(url).toBe('https://r2.example.com/presigned')
  })

  it('getPresignedUrl respects custom ttl', async () => {
    await adapter.getPresignedUrl('backing-tracks/song-1', 7200)
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(GetObjectCommand),
      { expiresIn: 7200 },
    )
  })

  it('delete sends DeleteObjectCommand', async () => {
    mockSend.mockResolvedValue({})
    await adapter.delete('backing-tracks/song-1')

    const call = mockSend.mock.calls[0][0]
    expect(call).toBeInstanceOf(DeleteObjectCommand)
    expect(call.input).toMatchObject({ Bucket: 'test-bucket', Key: 'backing-tracks/song-1' })
  })

  it('exists returns true when HeadObject succeeds', async () => {
    mockSend.mockResolvedValue({})
    expect(await adapter.exists('backing-tracks/song-1')).toBe(true)
  })

  it('exists returns false when HeadObject throws NotFound', async () => {
    const err = Object.assign(new Error('not found'), { name: 'NotFound' })
    mockSend.mockRejectedValue(err)
    expect(await adapter.exists('backing-tracks/song-1')).toBe(false)
  })

  it('delete is a no-op when object does not exist (NoSuchKey)', async () => {
    const err = Object.assign(new Error('no such key'), { name: 'NoSuchKey' })
    mockSend.mockRejectedValue(err)
    await expect(adapter.delete('backing-tracks/song-1')).resolves.toBeUndefined()
  })

  it('delete rethrows unexpected errors', async () => {
    const err = Object.assign(new Error('access denied'), { name: 'AccessDenied' })
    mockSend.mockRejectedValue(err)
    await expect(adapter.delete('backing-tracks/song-1')).rejects.toThrow('access denied')
  })
})
