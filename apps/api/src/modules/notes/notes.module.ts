import { Module } from '@nestjs/common'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { NoteQueryService } from './note-query.service'
import { NoteCopyService } from './note-copy.service'

@Module({
  imports: [ProjectAccessModule],
  controllers: [NotesController],
  providers: [NotesService, NoteQueryService, NoteCopyService],
})
export class NotesModule {}
