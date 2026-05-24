import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, HttpCode } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Throttle } from '@nestjs/throttler'
import { NotesService } from './notes.service'
import { NoteQueryService } from './note-query.service'
import { NoteCopyService } from './note-copy.service'
import { CreateNoteDto } from './dto/create-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'
import { NoteCopyApplyDto, NoteCopyPreviewDto } from './dto/note-copy.dto'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('charts/:chartId')
@UseGuards(AuthGuard('jwt'))
export class NotesController {
  constructor(
    private readonly notes: NotesService,
    private readonly query: NoteQueryService,
    private readonly noteCopy: NoteCopyService,
  ) {}

  @Get('notes')
  findAll(
    @Param('chartId') chartId: string,
    @Req() req: Request,
    @Query('timeFrom') timeFrom?: string,
    @Query('timeTo') timeTo?: string,
  ) {
    return this.query.findByChart(chartId, req.user as AuthUser, {
      timeFrom: timeFrom !== undefined ? parseFloat(timeFrom) : undefined,
      timeTo: timeTo !== undefined ? parseFloat(timeTo) : undefined,
    })
  }

  @Post('notes/copy-preview')
  previewCopy(
    @Param('chartId') chartId: string,
    @Body() body: NoteCopyPreviewDto,
    @Req() req: Request,
  ) {
    return this.noteCopy.previewCopy(chartId, body, req.user as AuthUser)
  }

  @Post('notes/copy-apply')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  applyCopy(
    @Param('chartId') chartId: string,
    @Body() body: NoteCopyApplyDto,
    @Req() req: Request,
  ) {
    return this.noteCopy.applyCopy(chartId, body, req.user as AuthUser)
  }

  @Post('notes')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  create(
    @Param('chartId') chartId: string,
    @Body() body: CreateNoteDto,
    @Req() req: Request,
  ) {
    return this.notes.create(chartId, body, req.user as AuthUser)
  }

  @Patch('notes/:noteId')
  updateNote(
    @Param('chartId') _chartId: string,
    @Param('noteId') noteId: string,
    @Body() body: UpdateNoteDto,
    @Req() req: Request,
  ) {
    return this.notes.update(noteId, body, req.user as AuthUser)
  }

  @Delete('notes/:noteId')
  @HttpCode(204)
  remove(
    @Param('chartId') chartId: string,
    @Param('noteId') noteId: string,
    @Req() req: Request,
  ) {
    return this.notes.softDelete(chartId, noteId, req.user as AuthUser)
  }

  @Post('events/undo')
  @HttpCode(410)
  undoDeprecated() {
    return { message: 'Use POST /charts/:chartId/commands/undo instead', status: 410 }
  }

  @Get('events')
  getEvents(
    @Param('chartId') chartId: string,
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notes.getEvents(chartId, req.user as AuthUser, cursor, parseInt(limit || '50', 10))
  }
}
