import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { toPublicAiErrorMessage, toPublicErrorMessage } from '../public-error.util'

describe('toPublicErrorMessage', () => {
  it('returns HttpException message for client errors', () => {
    expect(toPublicErrorMessage(new BadRequestException('Invalid input'))).toBe('Invalid input')
  })

  it('returns generic fallback for unknown errors', () => {
    expect(toPublicErrorMessage(new Error('OpenAI failed: 401 secret'))).toBe(
      'Request failed — try again in a moment.',
    )
  })

  it('uses AI-specific fallback', () => {
    expect(toPublicAiErrorMessage(new ServiceUnavailableException('x'))).toBe('x')
    expect(toPublicAiErrorMessage(new Error('internal'))).toBe(
      'AI request failed — try again in a moment.',
    )
  })
})
