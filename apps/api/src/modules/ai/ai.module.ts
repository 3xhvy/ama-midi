import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiChartService } from './ai-chart.service'
import { ChartContextService } from './chart-context.service'
import { ChartApplyPreviewService } from './chart-apply-preview.service'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { EditorCommandModule } from '../editor-commands/editor-command.module'
import { LLM_ADAPTER } from './adapters/llm-adapter.interface'
import { AnthropicAdapter } from './adapters/anthropic.adapter'
import { OpenAICompatibleAdapter } from './adapters/openai-compatible.adapter'

export function getLLMAdapterClass(provider = process.env.LLM_PROVIDER) {
  const normalized = provider?.toLowerCase()
  if (normalized === 'openai' || normalized === 'deepseek') return OpenAICompatibleAdapter
  return AnthropicAdapter
}

@Module({
  imports: [ProjectAccessModule, EditorCommandModule],
  controllers: [AiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: getLLMAdapterClass() },
    AiService,
    AiChartService,
    ChartContextService,
    ChartApplyPreviewService,
  ],
})
export class AiModule {}
