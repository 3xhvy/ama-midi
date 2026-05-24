import { Module } from '@nestjs/common'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ChartsModule } from '../charts/charts.module'
import { UndoModule } from '../undo/undo.module'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { NoteQueryService } from './note-query.service'
import { NoteCopyService } from './note-copy.service'

@Module({
  imports: [ProjectAccessModule, ChartsModule, UndoModule],
  controllers: [NotesController],
  providers: [NotesService, NoteQueryService, NoteCopyService],
})
export class NotesModule {}
