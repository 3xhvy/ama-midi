import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'
import { ValidationService } from './validation.service'

@Controller('songs/:songId')
@UseGuards(AuthGuard('jwt'))
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  @Get('validation')
  validate(@Param('songId') songId: string, @Req() req: Request) {
    return this.validation.validateSong(songId, req.user as AuthUser)
  }
}
