import { Module } from '@nestjs/common'
import { PatternsController } from './patterns.controller'
import { PatternsService } from './patterns.service'
import { PatternPasteService } from './pattern-paste.service'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { EditorCommandModule } from '../editor-commands/editor-command.module'

@Module({
  imports:     [PrismaModule, ProjectAccessModule, EditorCommandModule],
  controllers: [PatternsController],
  providers:   [PatternsService, PatternPasteService],
})
export class PatternsModule {}
