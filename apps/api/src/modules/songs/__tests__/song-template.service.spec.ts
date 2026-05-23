import { BadRequestException } from '@nestjs/common'
import type { SongTemplateNote, SongTemplatePattern, SongTemplateSection } from '@ama-midi/shared'
import { getSongTemplate } from '@ama-midi/shared'
import { PrismaService } from '../../prisma/prisma.service'
import { SongTemplateService } from '../song-template.service'

const prisma = {
  sectionMarker: { createMany: jest.fn() },
  notePattern: { createMany: jest.fn() },
  note: { createMany: jest.fn() },
}

describe('SongTemplateService', () => {
  let service: SongTemplateService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new SongTemplateService(prisma as unknown as PrismaService)
    prisma.sectionMarker.createMany.mockResolvedValue({ count: 0 })
    prisma.notePattern.createMany.mockResolvedValue({ count: 0 })
    prisma.note.createMany.mockResolvedValue({ count: 0 })
  })

  describe('materialize — sectioned-layout', () => {
    it('creates section markers for each template section', async () => {
      const template = getSongTemplate('sectioned-layout')!
      await service.materialize('sectioned-layout', 'song-a', 'chart-a', 'user-b')

      expect(prisma.sectionMarker.createMany).toHaveBeenCalledTimes(1)
      expect(prisma.sectionMarker.createMany).toHaveBeenCalledWith({
        data: template.sections!.map((s: SongTemplateSection) => ({
          songId: 'song-a',
          time: s.time,
          label: s.label,
          color: s.color ?? '#6C63FF',
          createdBy: 'user-b',
        })),
      })
      expect(prisma.notePattern.createMany).not.toHaveBeenCalled()
      expect(prisma.note.createMany).not.toHaveBeenCalled()
    })
  })

  describe('materialize — tap-starter', () => {
    it('creates 8 TAP notes spaced by half beats', async () => {
      const template = getSongTemplate('tap-starter')!
      await service.materialize('tap-starter', 'song-a', 'chart-a', 'user-b')

      expect(prisma.note.createMany).toHaveBeenCalledTimes(1)
      expect(prisma.note.createMany).toHaveBeenCalledWith({
        data: template.notes!.map((n: SongTemplateNote) => ({
          chartId: 'chart-a',
          songId: 'song-a',
          track: n.track,
          time: n.time,
          title: n.title ?? '',
          description: '',
          noteType: n.noteType,
          duration: n.duration ?? null,
          createdBy: 'user-b',
        })),
      })
      expect(prisma.note.createMany.mock.calls[0][0].data).toHaveLength(8)
      expect(prisma.sectionMarker.createMany).not.toHaveBeenCalled()
      expect(prisma.notePattern.createMany).not.toHaveBeenCalled()
    })
  })

  describe('materialize — pattern-lab', () => {
    it('creates stored patterns with template note JSON', async () => {
      const template = getSongTemplate('pattern-lab')!
      await service.materialize('pattern-lab', 'song-a', 'chart-a', 'user-b')

      expect(prisma.notePattern.createMany).toHaveBeenCalledTimes(1)
      expect(prisma.notePattern.createMany).toHaveBeenCalledWith({
        data: template.patterns!.map((p: SongTemplatePattern) => ({
          songId: 'song-a',
          name: p.name,
          notes: p.notes as object,
          createdBy: 'user-b',
        })),
      })
      expect(prisma.notePattern.createMany.mock.calls[0][0].data).toHaveLength(2)
      expect(template.patterns!.map((p: SongTemplatePattern) => p.name)).toEqual(['Basic 4-step', 'Hold swell'])
      expect(prisma.note.createMany).not.toHaveBeenCalled()
      expect(prisma.sectionMarker.createMany).not.toHaveBeenCalled()
    })
  })

  describe('materialize — unknown template', () => {
    it('throws BadRequestException and skips persistence', async () => {
      let thrown: BadRequestException | undefined
      try {
        await service.materialize('not-a-real-template', 'song-a', 'chart-a', 'user-b')
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException)
        thrown = e as BadRequestException
      }

      expect(thrown).toBeDefined()
      expect(thrown!.getResponse()).toEqual(
        expect.objectContaining({ message: 'Unknown template: not-a-real-template' }),
      )
      expect(prisma.sectionMarker.createMany).not.toHaveBeenCalled()
      expect(prisma.notePattern.createMany).not.toHaveBeenCalled()
      expect(prisma.note.createMany).not.toHaveBeenCalled()
    })
  })
})
