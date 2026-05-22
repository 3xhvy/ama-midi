import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { AuthUser } from '@ama-midi/shared'

interface JwtPayload {
  sub: string
  email: string
  role: string
  name?: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    })
  }

  validate(payload: JwtPayload): AuthUser {
    // JWT is already cryptographically verified — no DB lookup needed
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      role: payload.role as AuthUser['role'],
    }
  }
}
