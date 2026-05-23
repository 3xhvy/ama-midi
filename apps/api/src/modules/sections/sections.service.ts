import { Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import type { AuthUser, SectionMarker } from '@ama-midi/shared'
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto'

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly access: ProjectAccessService,
  ) {}

  async list(songId: string, user: AuthUser): Promise<SectionMarker[]> {
    await this.access.assertCanViewSong(songId, user)
    const rows = await this.prisma.sectionMarker.findMany({
      where:   { songId },
      orderBy: { time: 'asc' },
      include: { creator: { select: { name: true } } },
    })
    return rows.map(this.toDomain)
  }

  async create(user: AuthUser, songId: string, dto: CreateSectionDto): Promise<SectionMarker> {
    await this.access.assertCanEditSong(songId, user)
    const row = await this.prisma.sectionMarker.create({
      data: {
        songId,
        time:      dto.time,
        label:     dto.label,
        color:     dto.color ?? '#6C63FF',
        createdBy: user.id,
      },
      include: { creator: { select: { name: true } } },
    })
    const dom = this.toDomain(row)
    this.events.emit('section.created', { songId, section: dom })
    return dom
  }

  async update(songId: string, id: string, dto: UpdateSectionDto, user: AuthUser): Promise<SectionMarker> {
    await this.access.assertCanEditSong(songId, user)
    const existing = await this.prisma.sectionMarker.findUnique({ where: { id } })
    if (!existing || existing.songId !== songId) throw new NotFoundException()
    const row = await this.prisma.sectionMarker.update({
      where:   { id },
      data:    { label: dto.label, color: dto.color },
      include: { creator: { select: { name: true } } },
    })
    const dom = this.toDomain(row)
    this.events.emit('section.updated', { songId, section: dom })
    return dom
  }

  async delete(songId: string, id: string, user: AuthUser): Promise<void> {
    await this.access.assertCanEditSong(songId, user)
    const existing = await this.prisma.sectionMarker.findUnique({ where: { id } })
    if (!existing || existing.songId !== songId) throw new NotFoundException()
    await this.prisma.sectionMarker.delete({ where: { id } })
    this.events.emit('section.deleted', { songId, id })
  }

  private toDomain = (row: any): SectionMarker => ({
    id:          row.id,
    songId:      row.songId,
    time:        row.time,
    label:       row.label,
    color:       row.color,
    createdBy:   row.createdBy,
    creatorName: row.creator?.name ?? 'Unknown',
    createdAt:   row.createdAt.toISOString(),
  })
}
