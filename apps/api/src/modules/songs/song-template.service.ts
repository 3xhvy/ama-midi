import { BadRequestException, Injectable } from '@nestjs/common'
import { getSongTemplate } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class SongTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async materialize(templateId: string, songId: string, userId: string): Promise<void> {
    const template = getSongTemplate(templateId)
    if (!template) throw new BadRequestException(`Unknown template: ${templateId}`)

    if (template.sections?.length) {
      await this.prisma.sectionMarker.createMany({
        data: template.sections.map((s) => ({
          songId,
          time: s.time,
          label: s.label,
          color: s.color ?? '#6C63FF',
          createdBy: userId,
        })),
      })
    }

    if (template.patterns?.length) {
      await this.prisma.notePattern.createMany({
        data: template.patterns.map((p) => ({
          songId,
          name: p.name,
          notes: p.notes as object,
          createdBy: userId,
        })),
      })
    }

    if (template.notes?.length) {
      await this.prisma.note.createMany({
        data: template.notes.map((n) => ({
          songId,
          track: n.track,
          time: n.time,
          title: n.title ?? '',
          description: '',
          noteType: n.noteType,
          duration: n.duration ?? null,
          createdBy: userId,
        })),
      })
    }
  }
}
