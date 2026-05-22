import { Module } from '@nestjs/common'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { NoteQueryService } from './note-query.service'

@Module({
  controllers: [NotesController],
  providers: [NotesService, NoteQueryService],
})
export class NotesModule {}
