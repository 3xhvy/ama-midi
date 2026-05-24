import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { AllExceptionsFilter } from '../all-exceptions.filter'

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter()

  it('skips WebSocket contexts without calling switchToHttp', () => {
    const host = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('switchToHttp must not be called for ws')
      },
    } as unknown as ArgumentsHost

    expect(() => filter.catch(new Error('socket failure'), host)).not.toThrow()
  })

  it('returns JSON for HTTP HttpException', () => {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))
    const host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'GET', url: '/test' }),
      }),
    } as unknown as ArgumentsHost

    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host)

    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Not found',
      error: 'NOT_FOUND',
    })
  })
})
