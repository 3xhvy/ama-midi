import { Module } from '@nestjs/common'
import { EditorCommandService } from './editor-command.service'
import { EditorCommandController } from './editor-command.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [EditorCommandService],
  controllers: [EditorCommandController],
  exports: [EditorCommandService],
})
export class EditorCommandModule {}
