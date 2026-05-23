import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SectionsService } from './sections.service'
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs/:songId/sections')
@UseGuards(AuthGuard('jwt'))
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get()
  list(@Param('songId') songId: string, @Req() req: Request) {
    return this.sections.list(songId, req.user as AuthUser)
  }

  @Post()
  create(@Req() req: Request, @Param('songId') songId: string, @Body() dto: CreateSectionDto) {
    return this.sections.create(req.user as AuthUser, songId, dto)
  }

  @Patch(':id')
  update(@Param('songId') songId: string, @Param('id') id: string, @Body() dto: UpdateSectionDto, @Req() req: Request) {
    return this.sections.update(songId, id, dto, req.user as AuthUser)
  }

  @Delete(':id')
  remove(@Param('songId') songId: string, @Param('id') id: string, @Req() req: Request) {
    return this.sections.delete(songId, id, req.user as AuthUser)
  }
}
