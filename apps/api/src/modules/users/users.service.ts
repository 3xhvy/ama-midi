import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser, UserSearchResult } from '@ama-midi/shared'

interface UpdateProfileDto {
  name?:            string
  title?:           string
  department?:      string
  profileComplete?: boolean
  tourComplete?:    boolean
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string): Promise<UserSearchResult[]> {
    const q = query.trim()
    const rows = await this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      take: 20,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    return rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? undefined,
    }))
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data:  dto,
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
    }
  }
}
