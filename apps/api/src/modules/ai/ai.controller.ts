import { Controller, Post, Param, UseGuards, Req } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AiService } from './ai.service'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs/:songId')
@UseGuards(AuthGuard('jwt'))
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('suggest-notes')
  suggestNotes(@Param('songId') songId: string, @Req() req: Request) {
    const user = req.user as AuthUser
    return this.ai.suggestNotes(songId, user.id, user.role)
  }
}
