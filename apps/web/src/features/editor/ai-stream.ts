import type { AiStreamEvent, AiStreamRequest } from '@ama-midi/shared'

const BASE = import.meta.env.VITE_API_URL ?? ''

export function parseSseChunk(
  buffer: string,
  chunk: string,
): { events: AiStreamEvent[]; buffer: string } {
  const combined = buffer + chunk
  const parts = combined.split('\n\n')
  const nextBuffer = parts.pop() ?? ''
  const events: AiStreamEvent[] = []
  for (const part of parts) {
    const line = part.split('\n').find((l) => l.startsWith('data: '))
    if (!line) continue
    events.push(JSON.parse(line.slice(6)) as AiStreamEvent)
  }
  return { events, buffer: nextBuffer }
}

export async function streamAiRequest(
  token: string | null,
  songId: string,
  body: AiStreamRequest,
  opts: {
    signal?: AbortSignal
    onEvent: (event: AiStreamEvent) => void
  },
): Promise<AiStreamEvent> {
  const res = await fetch(`${BASE}/songs/${songId}/ai/stream`, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: body.action, payload: stripAction(body) }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { message?: string }
    const fallback = res.status >= 500 ? 'AI request failed — try again in a moment.' : res.statusText
    throw new Error(typeof errBody.message === 'string' ? errBody.message : fallback)
  }

  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastResult: AiStreamEvent | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const parsed = parseSseChunk(buffer, decoder.decode(value, { stream: true }))
    buffer = parsed.buffer
    for (const event of parsed.events) {
      opts.onEvent(event)
      if (event.type === 'error') throw new Error(event.message)
      if (event.type === 'result') lastResult = event
    }
  }

  if (!lastResult || lastResult.type !== 'result') {
    throw new Error('Connection closed early')
  }
  return lastResult
}

function stripAction(body: AiStreamRequest): Record<string, unknown> {
  const { action, ...rest } = body as AiStreamRequest & Record<string, unknown>
  return rest
}
