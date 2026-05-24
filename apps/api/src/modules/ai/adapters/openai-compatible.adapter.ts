import { Injectable } from '@nestjs/common'
import type { LLMAdapter, LLMMessage } from './llm-adapter.interface'

interface OpenAICompatibleResponse {
  choices?: Array<{ message?: { content?: string } }>
}

@Injectable()
export class OpenAICompatibleAdapter implements LLMAdapter {
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
      throw new Error(`OpenAI-compatible LLM failed: ${res.status} ${text}`)
    }

    const data = await res.json() as OpenAICompatibleResponse
    return data.choices?.[0]?.message?.content ?? ''
  }
}
