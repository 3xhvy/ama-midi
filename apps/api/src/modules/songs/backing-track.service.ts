import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common'
import { createReadStream, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { AuthUser } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'

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
  private readonly uploadDir: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {
    this.uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'backing-tracks')
    mkdirSync(this.uploadDir, { recursive: true })
  }

  private filePath(songId: string): string {
    return join(this.uploadDir, `${songId}.audio`)
  }

  async upload(songId: string, file: UploadedAudioFile, user: AuthUser) {
    await this.access.assertCanEditSongChart(songId, user)

    if (!file) throw new BadRequestException('No file uploaded')
    if (file.size > MAX_BYTES) throw new BadRequestException('File exceeds 50 MB limit')
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Unsupported audio format — use MP3, WAV, or OGG')
    }

    const song = await this.prisma.song.findUnique({ where: { id: songId } })
    if (!song) throw new NotFoundException('Song not found')

    this.removeStoredFile(songId)

    const { writeFileSync } = await import('fs')
    writeFileSync(this.filePath(songId), file.buffer)

    await this.prisma.song.update({
      where: { id: songId },
      data: {
        backingTrackFileName: file.originalname,
        backingTrackUrl: null,
      },
    })

    return {
      backingTrackFileName: file.originalname,
      backingTrackUrl: null,
    }
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

    this.removeStoredFile(songId)

    await this.prisma.song.update({
      where: { id: songId },
      data: {
        backingTrackUrl: url?.trim() || null,
        backingTrackFileName: null,
      },
    })

    return {
      backingTrackUrl: url?.trim() || null,
      backingTrackFileName: null,
    }
  }

  async stream(songId: string, user: AuthUser): Promise<StreamableFile> {
    await this.access.assertCanViewSong(songId, user)

    const path = this.filePath(songId)
    if (!existsSync(path)) throw new NotFoundException('No uploaded backing track')

    const song = await this.prisma.song.findUnique({
      where: { id: songId },
      select: { backingTrackFileName: true },
    })
    if (!song?.backingTrackFileName) throw new NotFoundException('No uploaded backing track')

    const stream = createReadStream(path)
    const ext = song.backingTrackFileName.split('.').pop()?.toLowerCase()
    const type =
      ext === 'wav' ? 'audio/wav'
      : ext === 'ogg' ? 'audio/ogg'
      : 'audio/mpeg'

    return new StreamableFile(stream, { type })
  }

  async remove(songId: string, user: AuthUser) {
    await this.access.assertCanEditSongChart(songId, user)
    this.removeStoredFile(songId)
    await this.prisma.song.update({
      where: { id: songId },
      data: { backingTrackUrl: null, backingTrackFileName: null },
    })
    return { ok: true }
  }

  private removeStoredFile(songId: string) {
    const path = this.filePath(songId)
    if (existsSync(path)) unlinkSync(path)
  }
}
