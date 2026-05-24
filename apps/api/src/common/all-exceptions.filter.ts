import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { mapPrismaToHttpException } from './prisma-error.util'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    // Global HTTP filters must not call switchToHttp() on WebSocket/RPC contexts —
    // that breaks Socket.io handlers (presence, cursors, live note sync).
    if (host.getType() !== 'http') {
      this.logger.error(
        `${host.getType()} handler error`,
        exception instanceof Error ? exception.stack : String(exception),
      )
      return
    }

    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()
    const isProd = process.env.NODE_ENV === 'production'

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      if (typeof body === 'string') {
        return res.status(status).json({
          statusCode: status,
          message: body,
          error: HttpStatus[status] ?? 'Error',
        })
      }
      return res.status(status).json(body)
    }

    this.logger.error(
      `${req.method} ${req.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    )

    const prismaMapped = mapPrismaToHttpException(exception)
    if (prismaMapped) {
      const status = prismaMapped.getStatus()
      const body = prismaMapped.getResponse()
      return res.status(status).json(
        typeof body === 'string'
          ? { statusCode: status, message: body, error: HttpStatus[status] ?? 'Error' }
          : body,
      )
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProd
        ? 'Internal server error'
        : (exception instanceof Error ? exception.message : 'Internal server error'),
      error: 'Internal Server Error',
    })
  }
}
