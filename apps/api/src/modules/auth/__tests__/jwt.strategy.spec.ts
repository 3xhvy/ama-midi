import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from '../strategies/jwt.strategy'
import { PrismaService } from '../../prisma/prisma.service'

describe('JwtStrategy', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret'
  })

  it('rejects a token whose revocation version is older than the user record', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'composer@amanotes.com',
          name: 'Composer',
          avatarUrl: null,
          role: 'COMPOSER',
          title: null,
          department: null,
          profileComplete: true,
          tourComplete: false,
          tokenVersion: 2,
        }),
      },
    }
    const strategy = new JwtStrategy(prisma as unknown as PrismaService)

    await expect(strategy.validate({
      sub: 'user-1',
      email: 'composer@amanotes.com',
      role: 'COMPOSER',
      tokenVersion: 1,
    })).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
