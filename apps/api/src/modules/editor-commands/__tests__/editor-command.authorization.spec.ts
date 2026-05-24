import { ForbiddenException } from '@nestjs/common'
import { EditorCommandService } from '../editor-command.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'

describe('EditorCommandService authorization', () => {
  const prisma = {
    editorCommand: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    editorEvent: { findMany: jest.fn() },
  }
  const access = {
    assertCanViewSong: jest.fn(),
    assertCanEditSongChart: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('checks edit access before returning undo preview for a chart command', async () => {
    prisma.editorCommand.findMany.mockResolvedValue([{
      id: 'cmd-1',
      songId: 'song-1',
      chartId: 'chart-1',
      commandType: 'PATTERN_PASTED',
      summary: {},
    }])
    access.assertCanEditSongChart.mockRejectedValue(new ForbiddenException())
    const service = new EditorCommandService(
      prisma as unknown as PrismaService,
      { emit: jest.fn() } as any,
      access as unknown as ProjectAccessService,
      { scheduleRun: jest.fn() } as any,
    )

    await expect(service.previewUndo('chart-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(access.assertCanEditSongChart).toHaveBeenCalledWith('song-1', expect.objectContaining({ id: 'user-1' }))
  })

  it('requires the undo command to belong to the route chart', async () => {
    prisma.editorCommand.findUnique.mockResolvedValue({
      id: 'cmd-1',
      songId: 'song-1',
      chartId: 'chart-2',
      userId: 'user-1',
      undoneByCommandId: null,
    })
    const service = new EditorCommandService(
      prisma as unknown as PrismaService,
      { emit: jest.fn() } as any,
      access as unknown as ProjectAccessService,
      { scheduleRun: jest.fn() } as any,
    )

    await expect(service.applyUndo('chart-1', 'user-1', 'cmd-1', [])).rejects.toThrow('Command not found')
    expect(access.assertCanEditSongChart).not.toHaveBeenCalled()
  })
})
