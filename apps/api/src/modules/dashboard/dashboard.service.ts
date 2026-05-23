import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import type { AuthUser, DashboardFeed, DashboardSongRow, SongStatus } from '@ama-midi/shared'

type SongWithRelations = {
  id: string
  projectId: string
  name: string
  status: SongStatus
  updatedAt: Date
  assignedComposer?: { name: string } | null
  assignedQa?: { name: string } | null
  project: { name: string }
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async getFeed(user: AuthUser): Promise<DashboardFeed> {
    const [recentCandidates, assignedCandidates, reviewCandidates] = await Promise.all([
      this.prisma.song.findMany({
        where: {
          archivedAt: null,
          OR: [
            { assignedComposerId: user.id },
            { createdBy: user.id },
            { noteEvents: { some: { userId: user.id } } },
          ],
        },
        include: this.include(),
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
      this.prisma.song.findMany({
        where: {
          archivedAt: null,
          OR: [{ assignedComposerId: user.id }, { assignedQaId: user.id }],
        },
        include: this.include(),
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
      this.prisma.song.findMany({
        where: {
          archivedAt: null,
          assignedQaId: user.id,
          status: { in: ['IN_REVIEW', 'NEEDS_FIX'] },
        },
        include: this.include(),
        orderBy: { updatedAt: 'desc' },
        take: 30,
      }),
    ])

    const recentSongs = await this.filterAccessible(user, recentCandidates, 8)
    const assignedToMe = await this.filterAccessible(user, assignedCandidates, 12)
    const needsReview = await this.filterAccessible(user, reviewCandidates, 12)

    return { recentSongs, assignedToMe, needsReview }
  }

  private include() {
    return {
      project: { select: { name: true } },
      assignedComposer: { select: { name: true } },
      assignedQa: { select: { name: true } },
    }
  }

  private toRow(song: SongWithRelations): DashboardSongRow {
    return {
      id: song.id,
      projectId: song.projectId,
      projectName: song.project.name,
      name: song.name,
      status: song.status,
      assignedComposerName: song.assignedComposer?.name ?? null,
      assignedQaName: song.assignedQa?.name ?? null,
      updatedAt: song.updatedAt.toISOString(),
    }
  }

  private async filterAccessible(
    user: AuthUser,
    songs: SongWithRelations[],
    limit: number,
  ): Promise<DashboardSongRow[]> {
    const rows: DashboardSongRow[] = []
    for (const song of songs) {
      if (rows.length >= limit) break
      try {
        await this.access.assertCanViewSong(song.id, user)
        rows.push(this.toRow(song))
      } catch {
        // skip inaccessible songs
      }
    }
    return rows
  }
}
