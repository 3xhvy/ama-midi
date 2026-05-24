import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AiService } from '../ai.service'
import { AiChartService } from '../ai-chart.service'
import { ChartContextService } from '../chart-context.service'
import { ChartApplyPreviewService } from '../chart-apply-preview.service'
import { LLM_ADAPTER, type LLMAdapter } from '../adapters/llm-adapter.interface'
import { AnthropicAdapter } from '../adapters/anthropic.adapter'
import { getLLMAdapterClass } from '../ai.module'
import { OpenAICompatibleAdapter } from '../adapters/openai-compatible.adapter'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import { EditorCommandService } from '../../editor-commands/editor-command.service'
import { ChartAnalyzeService } from '../../charts/chart-analyze.service'

const fakeLlm: LLMAdapter = {
  complete: jest.fn(),
}

describe('AI services LLM adapter injection', () => {
  it('constructs AiService with an injected LLM adapter', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: LLM_ADAPTER, useValue: fakeLlm },
        { provide: ChartContextService, useValue: {} },
        { provide: ProjectAccessService, useValue: {} },
      ],
    }).compile()

    expect(moduleRef.get(AiService)).toBeInstanceOf(AiService)
  })

  it('constructs AiChartService with an injected LLM adapter', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiChartService,
        ChartContextService,
        ChartApplyPreviewService,
        { provide: LLM_ADAPTER, useValue: fakeLlm },
        { provide: PrismaService, useValue: {} },
        { provide: ProjectAccessService, useValue: {} },
        { provide: EventEmitter2, useValue: {} },
        { provide: EditorCommandService, useValue: { record: jest.fn().mockResolvedValue({ id: 'cmd-mock' }) } },
        { provide: ChartAnalyzeService, useValue: { scheduleRun: jest.fn(), run: jest.fn() } },
      ],
    }).compile()

    expect(moduleRef.get(AiChartService)).toBeInstanceOf(AiChartService)
  })
})

describe('LLM provider selection', () => {
  it('uses Anthropic by default', () => {
    expect(getLLMAdapterClass(undefined)).toBe(AnthropicAdapter)
  })

  it('uses OpenAI-compatible adapter for openai provider', () => {
    expect(getLLMAdapterClass('openai')).toBe(OpenAICompatibleAdapter)
  })

  it('uses OpenAI-compatible adapter for deepseek provider alias', () => {
    expect(getLLMAdapterClass('deepseek')).toBe(OpenAICompatibleAdapter)
  })
})

describe('OpenAICompatibleAdapter', () => {
  const originalFetch = global.fetch
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OPENAI_BASE_URL: 'https://api.test/v1',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'cheap-model',
    }
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    } as unknown as Response)
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('calls chat completions with system and user messages', async () => {
    const adapter = new OpenAICompatibleAdapter()

    const text = await adapter.complete({
      system: 'System instructions',
      messages: [{ role: 'user', content: 'User prompt' }],
      maxTokens: 123,
    })

    expect(text).toBe('{"ok":true}')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: JSON.stringify({
          model: 'cheap-model',
          messages: [
            { role: 'system', content: 'System instructions' },
            { role: 'user', content: 'User prompt' },
          ],
          max_tokens: 123,
        }),
      }),
    )
  })

  it('throws with response text when provider returns an error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'bad key',
    } as unknown as Response)

    const adapter = new OpenAICompatibleAdapter()

    await expect(adapter.complete({
      system: 'System',
      messages: [{ role: 'user', content: 'Prompt' }],
      maxTokens: 10,
    })).rejects.toThrow('LLM provider request failed')
  })
})
