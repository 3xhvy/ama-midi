import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req, HttpCode } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Throttle } from '@nestjs/throttler'
import { NotesService } from './notes.service'
import { NoteQueryService } from './note-query.service'
import { CreateNoteDto } from './dto/create-note.dto'
import { UpdateNoteDto } from './dto/update-note.dto'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs/:songId')
@UseGuards(AuthGuard('jwt'))
export class NotesController {
  constructor(
    private readonly notes: NotesService,
    private readonly query: NoteQueryService,
  ) {}

  @Get('notes')
  findAll(
    @Param('songId') songId: string,
    @Query('timeFrom') timeFrom?: string,
    @Query('timeTo') timeTo?: string,
  ) {
    return this.query.findBySong(songId, {
      timeFrom: timeFrom !== undefined ? parseFloat(timeFrom) : undefined,
      timeTo: timeTo !== undefined ? parseFloat(timeTo) : undefined,
    })
  }

  @Post('notes')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  create(
    @Param('songId') songId: string,
    @Body() body: CreateNoteDto,
    @Req() req: Request,
  ) {
    return this.notes.create(songId, body, req.user as AuthUser)
  }

  @Patch('notes/:noteId')
  updateNote(
    @Param('songId') _songId: string,
    @Param('noteId') noteId: string,
    @Body() body: UpdateNoteDto,
    @Req() req: Request,
  ) {
    return this.notes.update(noteId, body, req.user as AuthUser)
  }

  @Delete('notes/:noteId')
  @HttpCode(204)
  remove(
    @Param('songId') songId: string,
    @Param('noteId') noteId: string,
    @Req() req: Request,
  ) {
    return this.notes.softDelete(songId, noteId, req.user as AuthUser)
  }

  @Post('events/undo')
  undo(@Param('songId') songId: string, @Req() req: Request) {
    return this.notes.undo(songId, req.user as AuthUser)
  }

  @Get('events')
  getEvents(
    @Param('songId') songId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notes.getEvents(songId, cursor, parseInt(limit || '50', 10))
  }
}
