import { ForbiddenException } from '@nestjs/common'
import { PatternsService } from '../patterns.service'
import { PatternPasteService } from '../pattern-paste.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'
import type { AuthUser } from '@ama-midi/shared'

const user: AuthUser = {
  id: 'user-1',
  email: 'user@test.com',
  name: 'User',
  role: 'COMPOSER',
  profileComplete: true,
  tourComplete: true,
}

describe('pattern authorization', () => {
  it('checks edit access before creating a song-scoped pattern', async () => {
    const prisma = { notePattern: { create: jest.fn() } }
    const access = { assertCanEditSongChart: jest.fn().mockRejectedValue(new ForbiddenException()) }
    const service = new PatternsService(prisma as unknown as PrismaService, access as unknown as ProjectAccessService)

    await expect(service.create(user, {
      name: 'Private pattern',
      songId: 'song-2',
      notes: [{ track: 1, timeOffset: 0, noteType: 'TAP' }],
    })).rejects.toBeInstanceOf(ForbiddenException)

    expect(access.assertCanEditSongChart).toHaveBeenCalledWith('song-2', user)
    expect(prisma.notePattern.create).not.toHaveBeenCalled()
  })

  it('rejects pasting another user private pattern from an inaccessible song', async () => {
    const prisma = {
      notePattern: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pattern-2',
          name: 'Other private',
          notes: [{ track: 1, timeOffset: 0, noteType: 'TAP' }],
          createdBy: 'user-2',
          songId: 'song-private',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      songChart: { findFirst: jest.fn().mockResolvedValue({ id: 'chart-1' }) },
      note: { findMany: jest.fn() },
    }
    const access = {
      assertCanEditSongChart: jest.fn().mockResolvedValue(undefined),
      assertCanViewSong: jest.fn().mockRejectedValue(new ForbiddenException()),
    }
    const service = new PatternPasteService(
      prisma as unknown as PrismaService,
      access as unknown as ProjectAccessService,
      { emit: jest.fn() } as any,
      { record: jest.fn() } as any,
      { scheduleRun: jest.fn() } as any,
    )

    await expect(service.previewPaste('pattern-2', {
      songId: 'target-song',
      chartId: 'chart-1',
      startTime: 0,
    }, user)).rejects.toBeInstanceOf(ForbiddenException)

    expect(access.assertCanViewSong).toHaveBeenCalledWith('song-private', user)
  })
})
