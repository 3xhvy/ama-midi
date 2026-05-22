import { Module } from '@nestjs/common'
import { SectionsController } from './sections.controller'
import { SectionsService } from './sections.service'
import { SectionsListener } from './sections.listener'
import { PrismaModule } from '../prisma/prisma.module'
import { RealtimeModule } from '../realtime/realtime.module'

@Module({
  imports:     [PrismaModule, RealtimeModule],
  controllers: [SectionsController],
  providers:   [SectionsService, SectionsListener],
})
export class SectionsModule {}
