import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { UpdateSongDto } from './dto/update-song.dto'
import { CreateProjectSongDto } from './dto/create-project-song.dto'
import type { AuthUser, Song } from '@ama-midi/shared'

@Injectable()
export class SongsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
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
      difficulty: dto.difficulty,
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

    if (dto.import) await this.copyImportedData(row.id, dto.import)
    return this.toSong(row)
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
      difficulty: 'NORMAL',
      bpm: 120,
      timeSignature: '4/4',
      startType: 'BLANK',
    }, user)
  }

  async update(id: string, dto: UpdateSongDto, user: AuthUser): Promise<Song> {
    await this.access.assertCanEditSong(id, user)

    const s = await this.prisma.song.update({
      where: { id },
      data: { ...dto },
      include: this.songInclude(),
    })
    return this.toSong(s)
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    await this.access.assertCanEditSong(id, user)
    await this.prisma.song.delete({ where: { id } })
  }

  private async copyImportedData(targetSongId: string, options: NonNullable<CreateProjectSongDto['import']>) {
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

  private songInclude() {
    return {
      creator: { select: { name: true, avatarUrl: true } },
      assignedComposer: { select: { name: true } },
      assignedQa: { select: { name: true } },
      _count: { select: { notes: { where: { deletedAt: null } } } },
    } as const
  }

  private toSong(s: {
    id: string
    projectId: string
    name: string
    category: Song['category']
    status: Song['status']
    difficulty: Song['difficulty']
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
    assignedComposer?: { name: string } | null
    assignedQa?: { name: string } | null
    _count: { notes: number }
  }): Song {
    return {
      id: s.id,
      projectId: s.projectId,
      name: s.name,
      category: s.category,
      status: s.status,
      difficulty: s.difficulty,
      assignedComposerId: s.assignedComposerId,
      assignedComposerName: s.assignedComposer?.name ?? null,
      assignedQaId: s.assignedQaId,
      assignedQaName: s.assignedQa?.name ?? null,
      sourceSongId: s.sourceSongId,
      archivedAt: s.archivedAt?.toISOString() ?? null,
      createdBy: s.createdBy,
      creatorName: s.creator.name,
      creatorAvatarUrl: s.creator.avatarUrl ?? undefined,
      noteCount: s._count.notes,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      bpm: s.bpm,
      timeSignature: s.timeSignature,
    }
  }
}
