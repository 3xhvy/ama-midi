import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '@ama-midi/shared'

type Permission = 'READ' | 'EDIT' | 'ADMIN'
type Scope = 'ALL_SONGS' | 'SELECTED_SONGS' | 'NO_SONGS'

interface Membership {
  permission: Permission
  songScope: Scope
  selectedSongs: { songId: string }[]
}

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertProjectAdmin(projectId: string, user: AuthUser): Promise<void> {
    if (user.role === 'ADMIN') return
    const membership = await this.getMembership(projectId, user.id)
    if (membership.permission !== 'ADMIN') throw new ForbiddenException()
  }

  async assertCanViewProject(projectId: string, user: AuthUser): Promise<void> {
    if (user.role === 'ADMIN') return
    await this.getMembership(projectId, user.id)
  }

  async assertCanCreateSong(projectId: string, user: AuthUser): Promise<void> {
    if (user.role === 'ADMIN') return
    const membership = await this.getMembership(projectId, user.id)
    const canCreate = membership.songScope === 'ALL_SONGS' && ['EDIT', 'ADMIN'].includes(membership.permission)
    if (!canCreate) throw new ForbiddenException()
  }

  async assertCanViewSong(songId: string, user: AuthUser) {
    const song = await this.getSong(songId)
    if (user.role === 'ADMIN') return song
    const membership = await this.getMembership(song.projectId, user.id)
    if (!this.isSongInScope(song.id, membership)) throw new ForbiddenException()
    return song
  }

  async assertCanEditSong(songId: string, user: AuthUser) {
    const song = await this.assertCanViewSong(songId, user)
    if (user.role === 'ADMIN') return song
    const membership = await this.getMembership(song.projectId, user.id)
    if (!['EDIT', 'ADMIN'].includes(membership.permission)) throw new ForbiddenException()
    return song
  }

  async getAccessibleSongWhere(projectId: string, user: AuthUser) {
    if (user.role === 'ADMIN') return { projectId }
    const membership = await this.getMembership(projectId, user.id)
    if (membership.songScope === 'ALL_SONGS') return { projectId }
    if (membership.songScope === 'NO_SONGS') return { projectId, id: { in: [] } }
    return { projectId, id: { in: membership.selectedSongs.map((s) => s.songId) } }
  }

  private async getSong(songId: string) {
    const song = await this.prisma.song.findUnique({
      where: { id: songId },
      select: { id: true, projectId: true },
    })
    if (!song) throw new NotFoundException('Song not found')
    return song
  }

  private async getMembership(projectId: string, userId: string): Promise<Membership> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { selectedSongs: { select: { songId: true } } },
    })
    if (!membership) throw new ForbiddenException()
    return membership as Membership
  }

  private isSongInScope(songId: string, membership: Membership): boolean {
    if (membership.songScope === 'ALL_SONGS') return true
    if (membership.songScope === 'NO_SONGS') return false
    return membership.selectedSongs.some((s) => s.songId === songId)
  }
}
