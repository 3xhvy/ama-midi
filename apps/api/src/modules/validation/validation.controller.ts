import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ValidationService } from './validation.service'

@Controller('songs/:songId')
@UseGuards(AuthGuard('jwt'))
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  @Get('validation')
  validate(@Param('songId') songId: string) {
    return this.validation.validateSong(songId)
  }
}
