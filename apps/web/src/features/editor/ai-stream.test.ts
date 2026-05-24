import { describe, it, expect } from 'vitest'
import { parseSseChunk } from './ai-stream'

describe('parseSseChunk', () => {
  it('parses one complete data line', () => {
    const { events } = parseSseChunk('', 'data: {"type":"run","runId":"1","action":"generate-chart"}\n\n')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'run', action: 'generate-chart' })
  })

  it('buffers partial lines across chunks', () => {
    let buffer = ''
    const r1 = parseSseChunk(buffer, 'data: {"type":"step"')
    buffer = r1.buffer
    expect(r1.events).toHaveLength(0)
    const r2 = parseSseChunk(buffer, ',"stepId":"prepare"}\n\n')
    expect(r2.events).toHaveLength(1)
  })
})
