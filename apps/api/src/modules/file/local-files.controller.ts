import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common'
import type { Response } from 'express'
import { join } from 'path'
import { existsSync, createReadStream } from 'fs'
import { lookup } from 'mime-types'

/**
 * Serves locally-stored files in dev (when R2 env vars are absent).
 * In production, LocalStorageAdapter is never used — this route is dead.
 * Path mirrors LocalStorageAdapter.getPresignedUrl(): /files/local/:key
 */
@Controller('files/local')
export class LocalFilesController {
  private readonly basePath: string

  constructor() {
    this.basePath = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')
  }

  @Get('*')
  serveFile(@Param('0') key: string, @Res() res: Response) {
    const fullPath = join(this.basePath, key)

    if (!existsSync(fullPath)) {
      throw new NotFoundException('File not found')
    }

    const mimeType = lookup(fullPath) || 'application/octet-stream'
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Cache-Control', 'private, max-age=3600')

    createReadStream(fullPath).pipe(res)
  }
}
