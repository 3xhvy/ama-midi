import { Module } from '@nestjs/common'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ChartsModule } from '../charts/charts.module'
import { EditorCommandModule } from '../editor-commands/editor-command.module'
import { NotesController } from './notes.controller'
import { NotesService } from './notes.service'
import { NoteQueryService } from './note-query.service'
import { NoteCopyService } from './note-copy.service'

@Module({
  imports: [ProjectAccessModule, ChartsModule, EditorCommandModule],
  controllers: [NotesController],
  providers: [NotesService, NoteQueryService, NoteCopyService],
  exports: [EditorCommandModule],
})
export class NotesModule {}
