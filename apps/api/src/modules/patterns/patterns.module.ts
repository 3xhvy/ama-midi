import { Module } from '@nestjs/common'
import { PatternsController } from './patterns.controller'
import { PatternsService } from './patterns.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports:     [PrismaModule],
  controllers: [PatternsController],
  providers:   [PatternsService],
})
export class PatternsModule {}
