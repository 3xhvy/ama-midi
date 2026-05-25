import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Req,
  UploadedFile, UseInterceptors, Header,
  HttpException, HttpStatus,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { SongsService } from './songs.service'
import { BackingTrackService } from './backing-track.service'
import { UpdateSongDto } from './dto/update-song.dto'
import { UpdateSongStatusDto } from './dto/update-song-status.dto'
import { SetBackingTrackUrlDto } from './dto/set-backing-track-url.dto'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs')
@UseGuards(AuthGuard('jwt'))
export class SongsController {
  constructor(
    private readonly songs: SongsService,
    private readonly backingTrack: BackingTrackService,
  ) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.songs.findAll(req.user as AuthUser)
  }

  @Get(':id/workflow')
  getWorkflow(@Param('id') id: string, @Req() req: Request) {
    return this.songs.getWorkflow(id, req.user as AuthUser)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.songs.findOne(id, req.user as AuthUser)
  }

  @Post()
  create(@Body('name') name: string, @Req() req: Request) {
    return this.songs.create(name, req.user as AuthUser)
  }

  @Patch(':id/status')
  transitionStatus(@Param('id') id: string, @Body() dto: UpdateSongStatusDto, @Req() req: Request) {
    return this.songs.transitionStatus(id, dto, req.user as AuthUser)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSongDto, @Req() req: Request) {
    return this.songs.update(id, dto, req.user as AuthUser)
  }

  @Post(':id/backing-track/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadBackingTrack(
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    @Req() req: Request,
  ) {
    return this.backingTrack.upload(id, file, req.user as AuthUser)
  }

  @Patch(':id/backing-track/url')
  setBackingTrackUrl(
    @Param('id') id: string,
    @Body() dto: SetBackingTrackUrlDto,
    @Req() req: Request,
  ) {
    return this.backingTrack.setExternalUrl(id, dto.url ?? null, req.user as AuthUser)
  }

  @Get(':id/backing-track')
  @Header('Cache-Control', 'no-store')
  async streamBackingTrack(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.backingTrack.stream(id, req.user as AuthUser)
  }

  @Delete(':id/backing-track')
  removeBackingTrack(@Param('id') id: string, @Req() req: Request) {
    return this.backingTrack.remove(id, req.user as AuthUser)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.songs.remove(id, req.user as AuthUser)
  }

  // ── MIDI placeholders ──────────────────────────────────────────────────────

  @Post(':id/midi/import')
  importMidi() {
    throw new HttpException('MIDI import coming soon', HttpStatus.NOT_IMPLEMENTED)
  }

  @Get(':id/midi/export')
  exportMidi() {
    throw new HttpException('MIDI export coming soon', HttpStatus.NOT_IMPLEMENTED)
  }
}
