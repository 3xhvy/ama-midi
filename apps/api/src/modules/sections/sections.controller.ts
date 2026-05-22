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
  list(@Param('songId') songId: string) {
    return this.sections.list(songId)
  }

  @Post()
  create(@Req() req: Request, @Param('songId') songId: string, @Body() dto: CreateSectionDto) {
    return this.sections.create((req.user as AuthUser).id, songId, dto)
  }

  @Patch(':id')
  update(@Param('songId') songId: string, @Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.sections.update(songId, id, dto)
  }

  @Delete(':id')
  remove(@Param('songId') songId: string, @Param('id') id: string) {
    return this.sections.delete(songId, id)
  }
}
