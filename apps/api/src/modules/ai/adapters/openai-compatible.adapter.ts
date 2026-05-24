import { Injectable, Logger } from '@nestjs/common'
import type { LLMAdapter, LLMMessage } from './llm-adapter.interface'

interface OpenAICompatibleResponse {
  choices?: Array<{ message?: { content?: string } }>
}

@Injectable()
export class OpenAICompatibleAdapter implements LLMAdapter {
  private readonly logger = new Logger(OpenAICompatibleAdapter.name)
  private readonly base = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  private readonly apiKey = process.env.OPENAI_API_KEY ?? ''
  private readonly model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  async complete(opts: {
    system: string
    messages: LLMMessage[]
    maxTokens: number
  }): Promise<string> {
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: opts.system },
          ...opts.messages,
        ],
        max_tokens: opts.maxTokens,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      this.logger.error(`LLM provider error ${res.status}`, text.slice(0, 500))
      throw new Error('LLM provider request failed')
    }

    const data = await res.json() as OpenAICompatibleResponse
    return data.choices?.[0]?.message?.content ?? ''
  }
}
