import { BadRequestException, NotFoundException } from '@nestjs/common'
import { BackingTrackService } from '../backing-track.service'
import { FileService } from '../../file/file.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'

const prisma = {
  song: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

const access = {
  assertCanEditSongChart: jest.fn().mockResolvedValue(undefined),
  assertCanViewSong: jest.fn().mockResolvedValue(undefined),
}

const fileService = {
  upload: jest.fn().mockResolvedValue(undefined),
  getPresignedUrl: jest.fn().mockResolvedValue('https://r2.example.com/presigned?token=x'),
  delete: jest.fn().mockResolvedValue(undefined),
  backingTrackKey: jest.fn((id: string) => `backing-tracks/${id}`),
}

const user = { id: 'user-1', email: 'a@b.com', role: 'COMPOSER' } as any

describe('BackingTrackService', () => {
  let service: BackingTrackService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new BackingTrackService(
      prisma as unknown as PrismaService,
      access as unknown as ProjectAccessService,
      fileService as unknown as FileService,
    )
  })

  describe('upload', () => {
    it('throws BadRequestException when no file provided', async () => {
      await expect(service.upload('song-1', null as any, user)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws BadRequestException for unsupported mime type', async () => {
      const file = { buffer: Buffer.from(''), mimetype: 'application/pdf', size: 100, originalname: 'x.pdf' }
      await expect(service.upload('song-1', file, user)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws BadRequestException when file exceeds 50 MB', async () => {
      const file = { buffer: Buffer.alloc(1), mimetype: 'audio/mpeg', size: 51 * 1024 * 1024, originalname: 'big.mp3' }
      await expect(service.upload('song-1', file, user)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws NotFoundException when song does not exist', async () => {
      prisma.song.findUnique.mockResolvedValue(null)
      const file = { buffer: Buffer.from('data'), mimetype: 'audio/mpeg', size: 100, originalname: 'track.mp3' }
      await expect(service.upload('song-1', file, user)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('uploads to FileService and updates DB on success', async () => {
      prisma.song.findUnique.mockResolvedValue({ id: 'song-1' })
      prisma.song.update.mockResolvedValue({})
      const file = { buffer: Buffer.from('audio'), mimetype: 'audio/mpeg', size: 1000, originalname: 'track.mp3' }

      const result = await service.upload('song-1', file, user)

      expect(fileService.upload).toHaveBeenCalledWith('backing-tracks/song-1', file.buffer, 'audio/mpeg')
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: 'song-1' },
        data: { backingTrackFileName: 'track.mp3', backingTrackUrl: null },
      })
      expect(result).toEqual({ backingTrackFileName: 'track.mp3', backingTrackUrl: null })
    })
  })

  describe('stream', () => {
    it('throws NotFoundException when song has no backing track', async () => {
      prisma.song.findUnique.mockResolvedValue({ backingTrackFileName: null, backingTrackUrl: null })
      await expect(service.stream('song-1', user)).rejects.toBeInstanceOf(NotFoundException)
    })

    it('returns presigned URL for uploaded file', async () => {
      prisma.song.findUnique.mockResolvedValue({ backingTrackFileName: 'track.mp3', backingTrackUrl: null })
      const result = await service.stream('song-1', user)
      expect(fileService.getPresignedUrl).toHaveBeenCalledWith('backing-tracks/song-1', 3600)
      expect(result).toEqual({ redirectUrl: 'https://r2.example.com/presigned?token=x' })
    })

    it('returns external URL when backingTrackUrl is set', async () => {
      prisma.song.findUnique.mockResolvedValue({ backingTrackFileName: null, backingTrackUrl: 'https://cdn.example.com/track.mp3' })
      const result = await service.stream('song-1', user)
      expect(fileService.getPresignedUrl).not.toHaveBeenCalled()
      expect(result).toEqual({ redirectUrl: 'https://cdn.example.com/track.mp3' })
    })
  })

  describe('remove', () => {
    it('calls FileService.delete and clears DB fields', async () => {
      prisma.song.update.mockResolvedValue({})
      await service.remove('song-1', user)
      expect(fileService.delete).toHaveBeenCalledWith('backing-tracks/song-1')
      expect(prisma.song.update).toHaveBeenCalledWith({
        where: { id: 'song-1' },
        data: { backingTrackUrl: null, backingTrackFileName: null },
      })
    })
  })
})
