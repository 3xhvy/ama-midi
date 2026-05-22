import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NOTE_EVENTS } from '@ama-midi/shared'

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSnapshot(songId: string, name: string, userId: string) {
    const notes = await this.prisma.note.findMany({
      where: { songId, deletedAt: null },
      include: { creator: { select: { name: true } } },
    })

    // Auto-increment versionNum
    const last = await this.prisma.songVersion.findFirst({
      where: { songId },
      orderBy: { versionNum: 'desc' },
    })
    const versionNum = (last?.versionNum ?? 0) + 1

    const snapshot = await this.prisma.songVersion.create({
      data: {
        songId,
        versionNum,
        createdBy: userId,
        snapshot: { name, notes } as object,
      },
    })

    return { ...snapshot, noteCount: notes.length, name }
  }

  async listSnapshots(songId: string) {
    const versions = await this.prisma.songVersion.findMany({
      where: { songId },
      orderBy: { createdAt: 'desc' },
    })

    return versions.map((v) => {
      const snapshotData = v.snapshot as { name?: string; notes?: unknown[] }
      return {
        id: v.id,
        versionNum: v.versionNum,
        name: snapshotData?.name ?? `Version ${v.versionNum}`,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
        noteCount: Array.isArray(snapshotData?.notes) ? snapshotData.notes.length : 0,
      }
    })
  }

  async restoreSnapshot(songId: string, versionId: string, userId: string) {
    const version = await this.prisma.songVersion.findUnique({ where: { id: versionId } })
    if (!version || version.songId !== songId) throw new NotFoundException('Version not found')

    const snapshotData = version.snapshot as { notes?: Array<Record<string, unknown>> }
    const snapshotNotes = snapshotData?.notes ?? []

    const currentNotes = await this.prisma.note.findMany({
      where: { songId, deletedAt: null },
    })

    for (const note of currentNotes) {
      await this.prisma.note.update({ where: { id: note.id }, data: { deletedAt: new Date() } })
      this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
        songId,
        noteId: note.id,
        userId,
        beforeState: {
          id: note.id,
          songId: note.songId,
          track: note.track,
          time: note.time,
          title: note.title,
          description: note.description,
          color: note.color,
          createdBy: note.createdBy,
          creatorName: '',
        },
      })
    }

    for (const n of snapshotNotes) {
      try {
        const created = await this.prisma.note.create({
          data: {
            songId,
            track: n.track as number,
            time: n.time as number,
            title: n.title as string,
            description: (n.description as string | undefined) ?? '',
            color: (n.color as string | undefined) ?? '#6C63FF',
            createdBy: userId,
          },
          include: { creator: { select: { name: true } } },
        })
        this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
          songId,
          noteId: created.id,
          userId,
          afterState: {
            id: created.id,
            songId: created.songId,
            track: created.track,
            time: created.time,
            title: created.title,
            description: created.description,
            color: created.color,
            createdBy: created.createdBy,
            creatorName: created.creator.name,
            createdAt: created.createdAt.toISOString(),
            updatedAt: created.updatedAt.toISOString(),
          },
        })
      } catch {
        // skip duplicate positions
      }
    }

    return { restored: true }
  }
}
