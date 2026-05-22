import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser, Song } from '@ama-midi/shared'

@Injectable()
export class SongsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthUser): Promise<Song[]> {
    const songs = await this.prisma.song.findMany({
      include: {
        creator: { select: { name: true, avatarUrl: true } },
        _count: { select: { notes: { where: { deletedAt: null } } } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return songs.map((s) => ({
      id: s.id,
      name: s.name,
      createdBy: s.createdBy,
      creatorName: s.creator.name,
      creatorAvatarUrl: s.creator.avatarUrl ?? undefined,
      noteCount: s._count.notes,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  }

  async findOne(id: string): Promise<Song> {
    const s = await this.prisma.song.findUnique({
      where: { id },
      include: {
        creator: { select: { name: true, avatarUrl: true } },
        _count: { select: { notes: { where: { deletedAt: null } } } },
      },
    })
    if (!s) throw new NotFoundException('Song not found')
    return {
      id: s.id,
      name: s.name,
      createdBy: s.createdBy,
      creatorName: s.creator.name,
      creatorAvatarUrl: s.creator.avatarUrl ?? undefined,
      noteCount: s._count.notes,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }
  }

  async create(name: string, user: AuthUser): Promise<Song> {
    const s = await this.prisma.song.create({
      data: { name, createdBy: user.id },
      include: {
        creator: { select: { name: true, avatarUrl: true } },
        _count: { select: { notes: { where: { deletedAt: null } } } },
      },
    })
    return {
      id: s.id,
      name: s.name,
      createdBy: s.createdBy,
      creatorName: s.creator.name,
      creatorAvatarUrl: s.creator.avatarUrl ?? undefined,
      noteCount: s._count.notes,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }
  }

  async update(id: string, name: string, user: AuthUser): Promise<Song> {
    const existing = await this.prisma.song.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Song not found')
    if (existing.createdBy !== user.id && user.role !== 'ADMIN') throw new ForbiddenException()

    const s = await this.prisma.song.update({
      where: { id },
      data: { name },
      include: {
        creator: { select: { name: true, avatarUrl: true } },
        _count: { select: { notes: { where: { deletedAt: null } } } },
      },
    })
    return {
      id: s.id,
      name: s.name,
      createdBy: s.createdBy,
      creatorName: s.creator.name,
      creatorAvatarUrl: s.creator.avatarUrl ?? undefined,
      noteCount: s._count.notes,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const existing = await this.prisma.song.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Song not found')
    if (existing.createdBy !== user.id && user.role !== 'ADMIN') throw new ForbiddenException()
    await this.prisma.song.delete({ where: { id } })
  }
}
