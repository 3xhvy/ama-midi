import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '../../generated/prisma/client'

function mapPrismaCode(code: string): HttpException | null {
  switch (code) {
    case 'P2002':
      return new ConflictException({ error: 'POSITION_TAKEN' })
    case 'P2003':
      return new BadRequestException('Invalid reference')
    case 'P2025':
      return new NotFoundException('Not found')
    default:
      return null
  }
}

export function mapPrismaToHttpException(error: unknown): HttpException | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaCode(error.code)
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    if (typeof code === 'string') return mapPrismaCode(code)
  }
  return null
}

/** Map known Prisma errors to HTTP exceptions; rethrow anything else unchanged. */
export function rethrowPrismaAsHttp(error: unknown): never {
  const mapped = mapPrismaToHttpException(error)
  if (mapped) throw mapped
  throw error
}
