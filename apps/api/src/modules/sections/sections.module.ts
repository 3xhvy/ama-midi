import { Module } from '@nestjs/common'
import { SectionsController } from './sections.controller'
import { SectionsService } from './sections.service'
import { SectionsListener } from './sections.listener'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { EditorCommandModule } from '../editor-commands/editor-command.module'

@Module({
  imports:     [PrismaModule, ProjectAccessModule, RealtimeModule, EditorCommandModule],
  controllers: [SectionsController],
  providers:   [SectionsService, SectionsListener],
})
export class SectionsModule {}
