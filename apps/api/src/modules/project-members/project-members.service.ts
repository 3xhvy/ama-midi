import { BadRequestException, Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { AddProjectMemberDto } from './dto/add-project-member.dto'
import { UpdateProjectMemberDto } from './dto/update-project-member.dto'
import type { AuthUser, ProjectMember } from '@ama-midi/shared'

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly emitter: EventEmitter2,
  ) {}

  async list(projectId: string, user: AuthUser): Promise<ProjectMember[]> {
    await this.access.assertCanViewProject(projectId, user)
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        selectedSongs: { select: { songId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(this.toMember)
  }

  async add(projectId: string, dto: AddProjectMemberDto, user: AuthUser): Promise<ProjectMember> {
    await this.access.assertProjectAdmin(projectId, user)
    await this.assertValidScope(projectId, dto.songScope, dto.songIds)

    const row = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        permission: dto.permission,
        songScope: dto.songScope,
        selectedSongs: dto.songScope === 'SELECTED_SONGS'
          ? { createMany: { data: dto.songIds!.map((songId) => ({ songId })) } }
          : undefined,
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        selectedSongs: { select: { songId: true } },
      },
    })
    this.emitter.emit('project.member.updated', { projectId, memberId: row.id })
    return this.toMember(row)
  }

  async update(projectId: string, memberId: string, dto: UpdateProjectMemberDto, user: AuthUser): Promise<ProjectMember> {
    await this.access.assertProjectAdmin(projectId, user)
    const nextScope = dto.songScope
    await this.assertValidScope(projectId, nextScope, dto.songIds)

    await this.prisma.projectMemberSongAccess.deleteMany({ where: { projectMemberId: memberId } })
    const row = await this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        ...(dto.permission ? { permission: dto.permission } : {}),
        ...(dto.songScope ? { songScope: dto.songScope } : {}),
        ...(dto.songScope === 'SELECTED_SONGS' ? {
          selectedSongs: { createMany: { data: dto.songIds!.map((songId) => ({ songId })) } },
        } : {}),
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        selectedSongs: { select: { songId: true } },
      },
    })
    this.emitter.emit('project.member.updated', { projectId, memberId: row.id })
    return this.toMember(row)
  }

  async remove(projectId: string, memberId: string, user: AuthUser): Promise<void> {
    await this.access.assertProjectAdmin(projectId, user)
    await this.prisma.projectMember.delete({ where: { id: memberId } })
    this.emitter.emit('project.member.removed', { projectId, memberId })
  }

  private async assertValidScope(projectId: string, scope?: string, songIds?: string[]) {
    if (scope !== 'SELECTED_SONGS') return
    if (!songIds || songIds.length === 0) throw new BadRequestException('Selected song scope requires songs')
    const count = await this.prisma.song.count({ where: { projectId, id: { in: songIds } } })
    if (count !== songIds.length) throw new BadRequestException('Selected songs must belong to project')
  }

  private toMember(row: {
    id: string
    projectId: string
    userId: string
    permission: ProjectMember['permission']
    songScope: ProjectMember['songScope']
    createdAt: Date
    updatedAt: Date
    user: { name: string; avatarUrl: string | null }
    selectedSongs: { songId: string }[]
  }): ProjectMember {
    return {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      userName: row.user.name,
      userAvatarUrl: row.user.avatarUrl ?? undefined,
      permission: row.permission,
      songScope: row.songScope,
      selectedSongIds: row.selectedSongs.map((s) => s.songId),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
