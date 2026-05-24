import { Module } from '@nestjs/common'
import { EditorCommandService } from './editor-command.service'
import { EditorCommandController } from './editor-command.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessModule } from '../project-access/project-access.module'

@Module({
  imports: [PrismaModule, ProjectAccessModule],
  providers: [EditorCommandService],
  controllers: [EditorCommandController],
  exports: [EditorCommandService],
})
export class EditorCommandModule {}
