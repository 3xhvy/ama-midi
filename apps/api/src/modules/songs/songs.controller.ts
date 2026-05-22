import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SongsService } from './songs.service'
import { UpdateSongDto } from './dto/update-song.dto'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs')
@UseGuards(AuthGuard('jwt'))
export class SongsController {
  constructor(private readonly songs: SongsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.songs.findAll(req.user as AuthUser)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.songs.findOne(id)
  }

  @Post()
  create(@Body('name') name: string, @Req() req: Request) {
    return this.songs.create(name, req.user as AuthUser)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSongDto, @Req() req: Request) {
    return this.songs.update(id, dto, req.user as AuthUser)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.songs.remove(id, req.user as AuthUser)
  }
}
