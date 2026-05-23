import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import type { AuthUser, Project } from '@ama-midi/shared'

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async findAll(user: AuthUser): Promise<Project[]> {
    const rows = await this.prisma.project.findMany({
      where: user.role === 'ADMIN' ? {} : { members: { some: { userId: user.id } } },
      include: { _count: { select: { songs: true, members: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map(this.toProject)
  }

  async findOne(projectId: string, user: AuthUser): Promise<Project> {
    await this.access.assertCanViewProject(projectId, user)
    const row = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { _count: { select: { songs: true, members: true } } },
    })
    if (!row) throw new NotFoundException('Project not found')
    return this.toProject(row)
  }

  async create(dto: CreateProjectDto, user: AuthUser): Promise<Project> {
    const row = await this.prisma.project.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        ownerId: user.id,
        members: {
          create: { userId: user.id, permission: 'ADMIN', songScope: 'ALL_SONGS' },
        },
      },
      include: { _count: { select: { songs: true, members: true } } },
    })
    return this.toProject(row)
  }

  async update(projectId: string, dto: UpdateProjectDto, user: AuthUser): Promise<Project> {
    await this.access.assertProjectAdmin(projectId, user)
    const row = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.status !== undefined ? {
          status: dto.status,
          archivedAt: dto.status === 'ARCHIVED' ? new Date() : null,
        } : {}),
      },
      include: { _count: { select: { songs: true, members: true } } },
    })
    return this.toProject(row)
  }

  private toProject(row: {
    id: string
    name: string
    description: string | null
    status: Project['status']
    ownerId: string
    createdAt: Date
    updatedAt: Date
    archivedAt: Date | null
    _count?: { songs: number; members: number }
  }): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      ownerId: row.ownerId,
      songCount: row._count?.songs ?? 0,
      memberCount: row._count?.members ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() ?? null,
    }
  }
}
