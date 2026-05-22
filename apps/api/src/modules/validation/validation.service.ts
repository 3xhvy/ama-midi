import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
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

  constructor(private readonly prisma: PrismaService) {}

  async validateSong(songId: string) {
    const notes = await this.prisma.note.findMany({
      where: { songId, deletedAt: null },
      include: { creator: { select: { name: true } } },
    })

    const mappedNotes = notes.map((n) => ({
      id: n.id,
      songId: n.songId,
      track: n.track,
      time: n.time,
      title: n.title,
      description: n.description,
      color: n.color,
      createdBy: n.createdBy,
      creatorName: n.creator.name,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
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
