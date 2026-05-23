import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiChartService } from './ai-chart.service'
import { ProjectAccessModule } from '../project-access/project-access.module'

@Module({
  imports: [ProjectAccessModule],
  controllers: [AiController],
  providers: [AiService, AiChartService],
})
export class AiModule {}
