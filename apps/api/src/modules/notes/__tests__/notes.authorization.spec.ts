import { NotFoundException } from '@nestjs/common'
import { NotesService } from '../notes.service'
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

describe('NotesService authorization', () => {
  it('rejects note update when note does not belong to the route chart', async () => {
    const prisma = {
      note: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'note-1',
          chartId: 'chart-2',
          songId: 'song-1',
          track: 1,
          time: 1,
          title: 'Note',
          description: '',
          createdBy: 'user-1',
          noteType: 'TAP',
          duration: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          creator: { name: 'User', avatarUrl: null },
        }),
        update: jest.fn(),
      },
    }
    const service = new NotesService(
      prisma as unknown as PrismaService,
      { emit: jest.fn() } as any,
      { assertCanEditSongChart: jest.fn() } as unknown as ProjectAccessService,
      { run: jest.fn() } as any,
      { record: jest.fn() } as any,
    )

    await expect(service.update('chart-1', 'note-1', { title: 'New' }, user))
      .rejects.toBeInstanceOf(NotFoundException)

    expect(prisma.note.update).not.toHaveBeenCalled()
  })
})
