export const LLM_ADAPTER = Symbol('LLM_ADAPTER')

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  complete(opts: {
    system: string
    messages: LLMMessage[]
    maxTokens: number
  }): Promise<string>
}
