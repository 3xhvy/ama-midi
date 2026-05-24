import { ConflictException, NotFoundException } from '@nestjs/common'
import { Prisma } from '../../../generated/prisma/client'
import { mapPrismaToHttpException } from '../prisma-error.util'

describe('mapPrismaToHttpException', () => {
  it('maps P2002 to POSITION_TAKEN conflict', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
    })
    const mapped = mapPrismaToHttpException(err)
    expect(mapped).toBeInstanceOf(ConflictException)
    expect(mapped!.getResponse()).toEqual({ error: 'POSITION_TAKEN' })
  })

  it('maps P2025 to not found', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: 'test',
    })
    expect(mapPrismaToHttpException(err)).toBeInstanceOf(NotFoundException)
  })

  it('returns null for unknown errors', () => {
    expect(mapPrismaToHttpException(new Error('boom'))).toBeNull()
  })
})
