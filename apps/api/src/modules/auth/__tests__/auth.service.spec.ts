import { JwtService } from '@nestjs/jwt'
import { AuthService } from '../auth.service'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthUser } from '@ama-midi/shared'

describe('AuthService', () => {
  const user: AuthUser = {
    id: 'user-1',
    email: 'composer@amanotes.com',
    name: 'Composer',
    role: 'COMPOSER',
    profileComplete: true,
    tourComplete: false,
    tokenVersion: 3,
  }

  it('signs access tokens with a revocation version and a 24 hour max lifetime', () => {
    const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '24h' } })
    const service = new AuthService({} as PrismaService, jwt)

    const token = service.signToken(user)
    const payload = jwt.decode(token) as { exp: number; iat: number; tokenVersion: number }

    expect(payload.tokenVersion).toBe(3)
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(24 * 60 * 60)
  })

  it('revokes existing access tokens by incrementing the user token version', async () => {
    const prisma = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
    }
    const service = new AuthService(prisma as unknown as PrismaService, {} as JwtService)

    await service.revokeUserTokens('user-1')

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tokenVersion: { increment: 1 } },
    })
  })
})
