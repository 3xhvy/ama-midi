import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AiService } from '../ai.service'
import { AiChartService } from '../ai-chart.service'
import { LLM_ADAPTER, type LLMAdapter } from '../adapters/llm-adapter.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'

const fakeLlm: LLMAdapter = {
  complete: jest.fn(),
}

describe('AI services LLM adapter injection', () => {
  it('constructs AiService with an injected LLM adapter', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: LLM_ADAPTER, useValue: fakeLlm },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile()

    expect(moduleRef.get(AiService)).toBeInstanceOf(AiService)
  })

  it('constructs AiChartService with an injected LLM adapter', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiChartService,
        { provide: LLM_ADAPTER, useValue: fakeLlm },
        { provide: PrismaService, useValue: {} },
        { provide: ProjectAccessService, useValue: {} },
        { provide: EventEmitter2, useValue: {} },
      ],
    }).compile()

    expect(moduleRef.get(AiChartService)).toBeInstanceOf(AiChartService)
  })
})
