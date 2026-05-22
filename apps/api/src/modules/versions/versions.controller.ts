import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { VersionsService } from './versions.service'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs/:songId/versions')
@UseGuards(AuthGuard('jwt'))
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Post()
  create(
    @Param('songId') songId: string,
    @Body('name') name: string,
    @Req() req: Request,
  ) {
    return this.versions.createSnapshot(songId, name || 'Snapshot', (req.user as AuthUser).id)
  }

  @Get()
  list(@Param('songId') songId: string) {
    return this.versions.listSnapshots(songId)
  }

  @Post(':versionId/restore')
  restore(
    @Param('songId') songId: string,
    @Param('versionId') versionId: string,
    @Req() req: Request,
  ) {
    return this.versions.restoreSnapshot(songId, versionId, (req.user as AuthUser).id)
  }
}
