import { HttpException } from '@nestjs/common'

const GENERIC_AI_FAILURE = 'AI request failed — try again in a moment.'
const GENERIC_REQUEST_FAILURE = 'Request failed — try again in a moment.'

/** Safe client-facing message — never includes stack traces, paths, or provider bodies. */
export function toPublicErrorMessage(error: unknown, fallback = GENERIC_REQUEST_FAILURE): string {
  if (error instanceof HttpException) {
    const body = error.getResponse()
    if (typeof body === 'string' && body.trim()) return body
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message: unknown }).message
      if (typeof message === 'string' && message.trim()) return message
      if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
    }
  }
  return fallback
}

export function toPublicAiErrorMessage(error: unknown): string {
  return toPublicErrorMessage(error, GENERIC_AI_FAILURE)
}
