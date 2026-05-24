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
    email:    string
    name:     string
    avatarUrl?: string
  }): Promise<AuthUser> {
    const user = await this.prisma.user.upsert({
      where:  { email: profile.email },
      update: { avatarUrl: profile.avatarUrl ?? null },
      create: {
        email:    profile.email,
        name:     profile.name,
        avatarUrl: profile.avatarUrl,
      },
    })

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

  signToken(user: AuthUser): string {
    return this.jwt.sign({
      sub:        user.id,
      email:      user.email,
      name:       user.name,
      role:       user.role,
      title:      user.title,
      department: user.department,
      tokenVersion: user.tokenVersion ?? 0,
    })
  }

  async revokeUserTokens(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data:  { tokenVersion: { increment: 1 } },
    })
  }
}
