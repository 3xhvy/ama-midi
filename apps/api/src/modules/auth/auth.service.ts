import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '@ama-midi/shared'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async findOrCreateUser(profile: {
    googleId: string
    email: string
    name: string
    avatarUrl?: string
  }): Promise<AuthUser> {
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } })

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      })
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role as AuthUser['role'],
    }
  }

  signToken(user: AuthUser): string {
    return this.jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role })
  }
}
