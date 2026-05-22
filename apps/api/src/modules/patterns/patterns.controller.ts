import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { PatternsService } from './patterns.service'
import { CreatePatternDto } from './dto/create-pattern.dto'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('patterns')
@UseGuards(AuthGuard('jwt'))
export class PatternsController {
  constructor(private readonly patterns: PatternsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.patterns.list((req.user as AuthUser).id)
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreatePatternDto) {
    return this.patterns.create((req.user as AuthUser).id, dto)
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.patterns.delete((req.user as AuthUser).id, id)
  }
}
