import type { Response } from 'express'
import type { AiStreamEvent } from '@ama-midi/shared'

export function initSse(res: Response): void {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
}

export function writeSse(res: Response, event: AiStreamEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
  const flush = (res as Response & { flush?: () => void }).flush
  flush?.()
}

export function endSse(res: Response): void {
  res.end()
}
