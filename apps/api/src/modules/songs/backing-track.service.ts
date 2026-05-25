import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { AuthUser } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { FileService } from '../file/file.service'

const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
])

const MAX_BYTES = 50 * 1024 * 1024

interface UploadedAudioFile {
  buffer: Buffer
  mimetype: string
  size: number
  originalname: string
}

@Injectable()
export class BackingTrackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly fileService: FileService,
  ) {}

  async upload(songId: string, file: UploadedAudioFile, user: AuthUser) {
    await this.access.assertCanEditSongChart(songId, user)

    if (!file) throw new BadRequestException('No file uploaded')
    if (file.size > MAX_BYTES) throw new BadRequestException('File exceeds 50 MB limit')
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Unsupported audio format — use MP3, WAV, or OGG')
    }

    const song = await this.prisma.song.findUnique({ where: { id: songId } })
    if (!song) throw new NotFoundException('Song not found')

    const key = this.fileService.backingTrackKey(songId)
    await this.fileService.upload(key, file.buffer, file.mimetype)

    await this.prisma.song.update({
      where: { id: songId },
      data: { backingTrackFileName: file.originalname, backingTrackUrl: null },
    })

    return { backingTrackFileName: file.originalname, backingTrackUrl: null }
  }

  async setExternalUrl(songId: string, url: string | null, user: AuthUser) {
    await this.access.assertCanEditSongChart(songId, user)

    if (url !== null && url.trim()) {
      try {
        const parsed = new URL(url.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new BadRequestException('URL must use http or https')
        }
      } catch (e) {
        if (e instanceof BadRequestException) throw e
        throw new BadRequestException('Invalid URL')
      }
    }

    const key = this.fileService.backingTrackKey(songId)
    await this.fileService.delete(key)

    await this.prisma.song.update({
      where: { id: songId },
      data: { backingTrackUrl: url?.trim() || null, backingTrackFileName: null },
    })

    return { backingTrackUrl: url?.trim() || null, backingTrackFileName: null }
  }

  /**
   * Returns a URL for the backing track.
   * For uploaded files: generates a presigned R2 URL (or local path in dev).
   * For external URLs: returns the external URL directly.
   * Controller redirects (302) to this URL.
   */
  async stream(songId: string, user: AuthUser): Promise<{ redirectUrl: string }> {
    await this.access.assertCanViewSong(songId, user)

    const song = await this.prisma.song.findUnique({
      where: { id: songId },
      select: { backingTrackFileName: true, backingTrackUrl: true },
    })

    if (!song?.backingTrackFileName && !song?.backingTrackUrl) {
      throw new NotFoundException('No backing track')
    }

    if (song.backingTrackUrl) {
      return { redirectUrl: song.backingTrackUrl }
    }

    const key = this.fileService.backingTrackKey(songId)
    const redirectUrl = await this.fileService.getPresignedUrl(key, 3600)
    return { redirectUrl }
  }

  async remove(songId: string, user: AuthUser) {
    await this.access.assertCanEditSongChart(songId, user)

    const key = this.fileService.backingTrackKey(songId)
    await this.fileService.delete(key)

    await this.prisma.song.update({
      where: { id: songId },
      data: { backingTrackUrl: null, backingTrackFileName: null },
    })

    return { ok: true }
  }
}
