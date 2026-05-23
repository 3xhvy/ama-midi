import { Module } from '@nestjs/common'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { NoteQueryService } from './note-query.service'

@Module({
  imports: [ProjectAccessModule],
  controllers: [NotesController],
  providers: [NotesService, NoteQueryService],
})
export class NotesModule {}
