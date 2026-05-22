import { Injectable } from '@nestjs/common'
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
    if (!user) {
      return {
        id:              payload.sub,
        email:           payload.email,
        name:            payload.name ?? payload.email,
        role:            payload.role as AuthUser['role'],
        profileComplete: false,
        tourComplete:    false,
      }
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
    }
  }
}
