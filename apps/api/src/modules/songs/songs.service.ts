import { BadRequestException, Injectable, NotFoundException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { ChartsService } from '../charts/charts.service'
import { ChartAnalyzeService } from '../charts/chart-analyze.service'
import { UpdateSongDto } from './dto/update-song.dto'
import { UpdateSongStatusDto } from './dto/update-song-status.dto'
import { CreateProjectSongDto } from './dto/create-project-song.dto'
import { SongTemplateService } from './song-template.service'
import type { AuthUser, Song, SongChart, SongWorkflowInfo } from '@ama-midi/shared'
import {
  canTransitionSongStatus,
  getAllowedStatusTransitions,
  resolveChartEditAccess,
  resolveSongWorkflowRole,
} from '@ama-midi/shared'

@Injectable()
export class SongsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly templates: SongTemplateService,
    private readonly charts: ChartsService,
    private readonly analyze: ChartAnalyzeService,
  ) {}

  async findAll(user: AuthUser): Promise<Song[]> {
    const songs = await this.prisma.song.findMany({
      include: this.songInclude(),
      orderBy: { updatedAt: 'desc' },
    })

    return songs.map((s) => this.toSong(s))
  }

  async findByProject(projectId: string, user: AuthUser): Promise<Song[]> {
    await this.access.assertCanViewProject(projectId, user)
    const where = await this.access.getAccessibleSongWhere(projectId, user)
    const rows = await this.prisma.song.findMany({
      where,
      include: this.songInclude(),
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map((s) => this.toSong(s))
  }

  async findOne(id: string, user?: AuthUser): Promise<Song> {
    if (user) await this.access.assertCanViewSong(id, user)
    const s = await this.prisma.song.findUnique({
      where: { id },
      include: this.songInclude(),
    })
    if (!s) throw new NotFoundException('Song not found')
    return this.toSong(s)
  }

  async createInProject(projectId: string, dto: CreateProjectSongDto, user: AuthUser): Promise<Song> {
    await this.access.assertCanCreateSong(projectId, user)
    if (dto.startType === 'IMPORT' && !dto.import) throw new BadRequestException('Import options are required')

    const source = dto.import ? await this.access.assertCanViewSong(dto.import.sourceSongId, user) : null
    const createData = {
      projectId,
      name: dto.name.trim(),
      category: dto.category,
      bpm: dto.bpm,
      timeSignature: dto.timeSignature,
      assignedComposerId: dto.assignedComposerId ?? null,
      assignedQaId: dto.assignedQaId ?? null,
      createdBy: user.id,
      sourceSongId: source?.id ?? null,
      importOptions: dto.import ? (dto.import as object) : undefined,
    }

    const row = await this.prisma.song.create({
      data: createData,
      include: this.songInclude(),
    })

    const defaultChart = await this.charts.createDefaultChart(row.id)

    if (dto.startType === 'TEMPLATE') {
      if (!dto.templateId) throw new BadRequestException('templateId is required for TEMPLATE start')
      await this.templates.materialize(dto.templateId, row.id, defaultChart.id, user.id)
      await this.analyze.run(defaultChart.id)
    }

    if (dto.import) {
      await this.copyImportedData(row.id, defaultChart.id, dto.import)
      await this.analyze.run(defaultChart.id)
    }

    const refreshed = await this.prisma.song.findUnique({
      where: { id: row.id },
      include: this.songInclude(),
    })
    return this.toSong(refreshed!)
  }

  async create(name: string, user: AuthUser): Promise<Song> {
    const membership = await this.prisma.projectMember.findFirst({
      where: { userId: user.id, permission: { in: ['EDIT', 'ADMIN'] }, songScope: 'ALL_SONGS' },
      orderBy: { createdAt: 'asc' },
    })
    if (!membership) throw new ForbiddenException('No project available for song creation')

    return this.createInProject(membership.projectId, {
      name,
      category: 'PROTOTYPE',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'BLANK',
    }, user)
  }

  async update(id: string, dto: UpdateSongDto, user: AuthUser): Promise<Song> {
    await this.access.assertCanEditSongChart(id, user)

    const s = await this.prisma.song.update({
      where: { id },
      data: { ...dto },
      include: this.songInclude(),
    })
    return this.toSong(s)
  }

  async getWorkflow(id: string, user: AuthUser): Promise<SongWorkflowInfo> {
    await this.access.assertCanViewSong(id, user)
    const song = await this.prisma.song.findUnique({
      where: { id },
      select: {
        status: true,
        projectId: true,
        assignedComposerId: true,
        assignedQaId: true,
        createdBy: true,
      },
    })
    if (!song) throw new NotFoundException('Song not found')

    const role = await this.resolveWorkflowRole(song, user)
    const projectPermission = await this.access.getProjectPermission(song.projectId, user)
    const { canEditChart, readOnlyReason } = resolveChartEditAccess({
      isPlatformAdmin: user.role === 'ADMIN',
      platformRole: user.role,
      projectPermission,
      songStatus: song.status,
    })
    return {
      status: song.status,
      allowedTransitions: getAllowedStatusTransitions(song.status, role),
      canEditChart,
      readOnlyReason,
    }
  }

  async transitionStatus(id: string, dto: UpdateSongStatusDto, user: AuthUser): Promise<Song> {
    await this.access.assertCanViewSong(id, user)
    const song = await this.prisma.song.findUnique({
      where: { id },
      select: {
        status: true,
        projectId: true,
        assignedComposerId: true,
        assignedQaId: true,
        createdBy: true,
      },
    })
    if (!song) throw new NotFoundException('Song not found')

    const role = await this.resolveWorkflowRole(song, user)
    if (!canTransitionSongStatus(song.status, dto.status, role)) {
      throw new ForbiddenException(`Cannot transition from ${song.status} to ${dto.status}`)
    }

    if (
      (song.status === 'IN_REVIEW' && dto.status === 'APPROVED')
      || (song.status === 'APPROVED' && dto.status === 'PUBLISHED')
    ) {
      const blocking = await this.prisma.chartValidationWarning.findMany({
        where: { chart: { songId: id }, severity: 'ERROR' },
        include: { chart: { select: { name: true } } },
      })
      if (blocking.length) {
        throw new UnprocessableEntityException({ blockingWarnings: blocking })
      }
    }

    const data: { status: typeof dto.status; archivedAt?: Date | null } = { status: dto.status }
    if (dto.status === 'ARCHIVED') data.archivedAt = new Date()
    if (song.status === 'ARCHIVED' && dto.status === 'DRAFT') data.archivedAt = null

    const updated = await this.prisma.song.update({
      where: { id },
      data,
      include: this.songInclude(),
    })
    return this.toSong(updated)
  }

  private async resolveWorkflowRole(
    song: {
      projectId: string
      assignedComposerId: string | null
      assignedQaId: string | null
      createdBy: string
    },
    user: AuthUser,
  ) {
    const projectPermission = await this.access.getProjectPermission(song.projectId, user)
    return resolveSongWorkflowRole({
      userId: user.id,
      isPlatformAdmin: user.role === 'ADMIN',
      projectPermission,
      assignedComposerId: song.assignedComposerId,
      assignedQaId: song.assignedQaId,
      createdBy: song.createdBy,
    })
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    await this.access.assertCanEditSong(id, user)
    await this.prisma.song.delete({ where: { id } })
  }

  private async copyImportedData(
    targetSongId: string,
    targetChartId: string,
    options: NonNullable<CreateProjectSongDto['import']>,
  ) {
    if (options.copySections) {
      const sections = await this.prisma.sectionMarker.findMany({ where: { songId: options.sourceSongId } })
      if (sections.length) {
        await this.prisma.sectionMarker.createMany({
          data: sections.map((s) => ({
            songId: targetSongId,
            time: s.time,
            label: s.label,
            color: s.color,
            createdBy: s.createdBy,
          })),
        })
      }
    }

    if (options.copyPatterns) {
      const patterns = await this.prisma.notePattern.findMany({ where: { songId: options.sourceSongId } })
      if (patterns.length) {
        await this.prisma.notePattern.createMany({
          data: patterns.map((p) => ({
            songId: targetSongId,
            name: p.name,
            notes: p.notes as object,
            createdBy: p.createdBy,
          })),
        })
      }
    }

    if (options.copyNotes) {
      const notes = await this.prisma.note.findMany({ where: { songId: options.sourceSongId, deletedAt: null } })
      if (notes.length) {
        await this.prisma.note.createMany({
          data: notes.map((n) => ({
            chartId: targetChartId,
            songId: targetSongId,
            track: n.track,
            time: n.time,
            title: n.title,
            description: n.description,
            noteType: n.noteType,
            duration: n.duration,
            createdBy: n.createdBy,
          })),
        })
      }
    }
  }

  private normalizeAvatarUrl(url: string | null | undefined): string | undefined {
    const trimmed = url?.trim()
    return trimmed || undefined
  }

  private songInclude() {
    return {
      creator: { select: { name: true, avatarUrl: true } },
      assignedComposer: { select: { name: true, avatarUrl: true } },
      assignedQa: { select: { name: true, avatarUrl: true } },
      charts: { orderBy: { createdAt: 'asc' as const } },
      _count: { select: { notes: { where: { deletedAt: null } } } },
    } as const
  }

  private toSong(s: {
    id: string
    projectId: string
    name: string
    category: Song['category']
    status: Song['status']
    assignedComposerId: string | null
    assignedQaId: string | null
    sourceSongId: string | null
    archivedAt: Date | null
    createdBy: string
    bpm: number
    timeSignature: string
    createdAt: Date
    updatedAt: Date
    creator: { name: string; avatarUrl: string | null }
    assignedComposer?: { name: string; avatarUrl: string | null } | null
    assignedQa?: { name: string; avatarUrl: string | null } | null
    charts?: Array<{
      id: string
      songId: string
      name: string
      speedMultiplier: number
      computedDifficulty: string
      averageDifficultyScore: number
      peakDifficultyScore: number
      analyzedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }>
    _count: { notes: number }
  }): Song {
    const charts: SongChart[] | undefined = s.charts?.map((c) => ({
      id: c.id,
      songId: c.songId,
      name: c.name,
      speedMultiplier: c.speedMultiplier,
      computedDifficulty: c.computedDifficulty as SongChart['computedDifficulty'],
      averageDifficultyScore: c.averageDifficultyScore,
      peakDifficultyScore: c.peakDifficultyScore,
      analyzedAt: c.analyzedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))

    return {
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      category: s.category,
      status: s.status,
      assignedComposerId: s.assignedComposerId,
      assignedComposerName: s.assignedComposer?.name ?? null,
      assignedComposerAvatarUrl: this.normalizeAvatarUrl(s.assignedComposer?.avatarUrl),
      assignedQaId: s.assignedQaId,
      assignedQaName: s.assignedQa?.name ?? null,
      assignedQaAvatarUrl: this.normalizeAvatarUrl(s.assignedQa?.avatarUrl),
      sourceSongId: s.sourceSongId,
      archivedAt: s.archivedAt?.toISOString() ?? null,
      createdBy: s.createdBy,
      creatorName: s.creator.name,
      creatorAvatarUrl: this.normalizeAvatarUrl(s.creator.avatarUrl),
      noteCount: s._count.notes,
      charts,
      chartSummary: charts ? ChartsService.chartSummary(charts) : undefined,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      bpm: s.bpm,
      timeSignature: s.timeSignature,
    }
  }
}
