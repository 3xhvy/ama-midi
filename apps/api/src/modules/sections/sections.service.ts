import { Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { EditorCommandService } from '../editor-commands/editor-command.service'
import type { AuthUser, SectionMarker } from '@ama-midi/shared'
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto'

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly access: ProjectAccessService,
    private readonly editorCommands: EditorCommandService,
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
    await this.access.assertCanEditSongChart(songId, user)
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
    await this.editorCommands.record({
      songId,
      commandType: 'SECTION_CREATED',
      userId: user.id,
      summary: { sectionId: dom.id, label: dom.label, time: dom.time },
    })
    this.events.emit('section.created', { songId, userId: user.id, section: dom })
    return dom
  }

  async update(songId: string, id: string, dto: UpdateSectionDto, user: AuthUser): Promise<SectionMarker> {
    await this.access.assertCanEditSongChart(songId, user)
    const existing = await this.prisma.sectionMarker.findUnique({ where: { id } })
    if (!existing || existing.songId !== songId) throw new NotFoundException()
    const row = await this.prisma.sectionMarker.update({
      where:   { id },
      data:    { label: dto.label, color: dto.color },
      include: { creator: { select: { name: true } } },
    })
    const dom = this.toDomain(row)
    await this.editorCommands.record({
      songId,
      commandType: 'SECTION_UPDATED',
      userId: user.id,
      summary: { sectionId: id, label: dto.label, color: dto.color },
    })
    this.events.emit('section.updated', { songId, userId: user.id, beforeState: this.toDomain(existing), section: dom })
    return dom
  }

  async delete(songId: string, id: string, user: AuthUser): Promise<void> {
    await this.access.assertCanEditSongChart(songId, user)
    const existing = await this.prisma.sectionMarker.findUnique({ where: { id } })
    if (!existing || existing.songId !== songId) throw new NotFoundException()
    await this.prisma.sectionMarker.delete({ where: { id } })
    await this.editorCommands.record({
      songId,
      commandType: 'SECTION_DELETED',
      userId: user.id,
      summary: { sectionId: id, label: existing.label, time: existing.time },
    })
    this.events.emit('section.deleted', { songId, userId: user.id, beforeState: this.toDomain(existing), id })
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
