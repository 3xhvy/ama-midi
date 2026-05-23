import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'
import { BoundaryRule } from './rules/boundary.rule'
import { GapRule } from './rules/gap.rule'
import { DensityRule } from './rules/density.rule'
import { EmptyTrackRule } from './rules/empty-track.rule'
import type { ValidationRule } from './validation-rule.interface'

@Injectable()
export class ValidationService {
  private rules: ValidationRule[] = [
    new BoundaryRule(),
    new GapRule(),
    new DensityRule(),
    new EmptyTrackRule(),
  ]

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async validateSong(songId: string, user: AuthUser) {
    await this.access.assertCanViewSong(songId, user)
    const notes = await this.prisma.note.findMany({
      where: { songId, deletedAt: null },
      include: { creator: { select: { name: true } } },
    })

    const mappedNotes = notes.map((n) => ({
      id: n.id,
      songId: n.songId,
      chartId: n.chartId,
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

    const issues = this.rules.flatMap((rule) => {
      try {
        return rule.run(mappedNotes)
      } catch {
        return []
      }
    })

    const errors = issues.filter((i) => i.severity === 'error').length
    const warnings = issues.filter((i) => i.severity === 'warning').length

    return { summary: { errors, warnings }, issues }
  }
}
