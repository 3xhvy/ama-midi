import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ChartsController } from './charts.controller'
import { ChartsService } from './charts.service'
import { ChartAnalyzeService } from './chart-analyze.service'

@Module({
  imports: [PrismaModule, ProjectAccessModule],
  controllers: [ChartsController],
  providers: [ChartsService, ChartAnalyzeService],
  exports: [ChartsService, ChartAnalyzeService],
})
export class ChartsModule {}
