import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import type { AuthUser, Note } from '@ama-midi/shared'

@Injectable()
export class NoteQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async findBySong(
    songId: string,
    user: AuthUser,
    opts: { timeFrom?: number; timeTo?: number } = {},
  ): Promise<Note[]> {
    await this.access.assertCanViewSong(songId, user)

    const timeFilter =
      opts.timeFrom !== undefined || opts.timeTo !== undefined
        ? {
            time: {
              ...(opts.timeFrom !== undefined ? { gte: opts.timeFrom } : {}),
              ...(opts.timeTo !== undefined ? { lte: opts.timeTo } : {}),
            },
          }
        : {}

    const notes = await this.prisma.note.findMany({
      where: {
        songId,
        deletedAt: null,
        ...timeFilter,
      },
      include: { creator: { select: { name: true } } },
      orderBy: [{ track: 'asc' }, { time: 'asc' }],
    })

    return notes.map((n) => ({
      id: n.id,
      songId: n.songId,
      track: n.track,
      time: n.time,
      title: n.title,
      description: n.description,
      createdBy: n.createdBy,
      creatorName: n.creator.name,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
      noteType: n.noteType as 'TAP' | 'HOLD' | 'SWIPE',
      duration: n.duration ?? undefined,
    }))
  }
}
