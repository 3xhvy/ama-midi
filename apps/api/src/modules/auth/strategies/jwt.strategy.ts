import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthUser } from '@ama-midi/shared'

interface JwtPayload {
  sub:         string
  email:       string
  role:        string
  name?:       string
  title?:      string
  department?: string
  tokenVersion?: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    })
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Fetch fresh profile data from DB so profileComplete/tourComplete are always current
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
      throw new UnauthorizedException()
    }
    return {
      id:              user.id,
      email:           user.email,
      name:            user.name,
      avatarUrl:       user.avatarUrl ?? undefined,
      role:            user.role as AuthUser['role'],
      title:           user.title ?? undefined,
      department:      user.department ?? undefined,
      profileComplete: user.profileComplete,
      tourComplete:    user.tourComplete,
      tokenVersion:    user.tokenVersion,
    }
  }
}
