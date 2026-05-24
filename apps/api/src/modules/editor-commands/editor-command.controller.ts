import { Controller, Get, Post, Param, Body, UseGuards, Req, HttpCode } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { EditorCommandService } from './editor-command.service'
import { ApplyUndoDto } from './dto/apply-undo.dto'
import type { Request } from 'express'
import type { AuthUser, UndoPreview } from '@ama-midi/shared'

@Controller('charts/:chartId/commands')
@UseGuards(AuthGuard('jwt'))
export class EditorCommandController {
  constructor(private readonly commands: EditorCommandService) {}

  @Post('undo-preview')
  @HttpCode(200)
  previewUndo(@Param('chartId') chartId: string, @Req() req: Request): Promise<UndoPreview> {
    return this.commands.previewUndo(chartId, (req.user as AuthUser).id)
  }

  @Get(':commandId/mutations')
  getMutations(
    @Param('chartId') chartId: string,
    @Param('commandId') commandId: string,
    @Req() req: Request,
  ) {
    return this.commands.findMutations(chartId, commandId, req.user as AuthUser)
  }

  @Post('undo')
  @HttpCode(200)
  applyUndo(
    @Param('chartId') chartId: string,
    @Body() body: ApplyUndoDto,
    @Req() req: Request,
  ) {
    return this.commands.applyUndo(chartId, (req.user as AuthUser).id, body.commandId, body.resolutions ?? [])
  }
}
