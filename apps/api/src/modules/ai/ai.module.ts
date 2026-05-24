import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiChartService } from './ai-chart.service'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { LLM_ADAPTER } from './adapters/llm-adapter.interface'
import { AnthropicAdapter } from './adapters/anthropic.adapter'

@Module({
  imports: [ProjectAccessModule],
  controllers: [AiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: AnthropicAdapter },
    AiService,
    AiChartService,
  ],
})
export class AiModule {}
