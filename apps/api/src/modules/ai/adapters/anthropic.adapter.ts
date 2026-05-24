import { Injectable } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, LLMMessage } from './llm-adapter.interface'

@Injectable()
export class AnthropicAdapter implements LLMAdapter {
  private readonly client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  async complete(opts: {
    system: string
    messages: LLMMessage[]
    maxTokens: number
  }): Promise<string> {
    const message = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
    })

    return message.content[0]?.type === 'text' ? message.content[0].text : ''
  }
}
