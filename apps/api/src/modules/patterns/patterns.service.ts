import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { CreatePatternDto } from './dto/create-pattern.dto'
import type { AuthUser, NotePattern, PatternNote } from '@ama-midi/shared'

@Injectable()
export class PatternsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async list(userId: string): Promise<NotePattern[]> {
    const rows = await this.prisma.notePattern.findMany({
      where:   { OR: [{ createdBy: userId }, { songId: null }] },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(this.toDomain)
  }

  async create(user: AuthUser, dto: CreatePatternDto): Promise<NotePattern> {
    if (dto.songId) await this.access.assertCanEditSongChart(dto.songId, user)
    for (const n of dto.notes) {
      if (n.noteType === 'HOLD' && (n.duration == null || n.duration <= 0)) {
        throw new BadRequestException('HOLD notes in pattern require duration > 0')
      }
    }
    const row = await this.prisma.notePattern.create({
      data: {
        name:      dto.name,
        notes:     dto.notes as unknown as object,
        songId:    dto.songId ?? null,
        createdBy: user.id,
      },
    })
    return this.toDomain(row)
  }

  async delete(userId: string, id: string): Promise<void> {
    const row = await this.prisma.notePattern.findUnique({ where: { id } })
    if (!row) throw new NotFoundException()
    if (row.createdBy !== userId) throw new ForbiddenException()
    await this.prisma.notePattern.delete({ where: { id } })
  }

  private toDomain = (row: any): NotePattern => ({
    id:        row.id,
    name:      row.name,
    notes:     row.notes as PatternNote[],
    createdBy: row.createdBy,
    songId:    row.songId,
    createdAt: row.createdAt.toISOString(),
  })
}
