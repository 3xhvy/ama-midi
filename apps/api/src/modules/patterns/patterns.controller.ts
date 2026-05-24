import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { PatternsService } from './patterns.service'
import { PatternPasteService } from './pattern-paste.service'
import { CreatePatternDto } from './dto/create-pattern.dto'
import { PatternPasteApplyDto, PatternPastePreviewDto } from './dto/pattern-paste.dto'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('patterns')
@UseGuards(AuthGuard('jwt'))
export class PatternsController {
  constructor(
    private readonly patterns: PatternsService,
    private readonly paste: PatternPasteService,
  ) {}

  @Get()
  list(@Req() req: Request) {
    return this.patterns.list((req.user as AuthUser).id)
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreatePatternDto) {
    return this.patterns.create(req.user as AuthUser, dto)
  }

  @Post(':patternId/preview-paste')
  previewPaste(
    @Req() req: Request,
    @Param('patternId') patternId: string,
    @Body() dto: PatternPastePreviewDto,
  ) {
    return this.paste.previewPaste(patternId, dto, req.user as AuthUser)
  }

  @Post(':patternId/apply-paste')
  applyPaste(
    @Req() req: Request,
    @Param('patternId') patternId: string,
    @Body() dto: PatternPasteApplyDto,
  ) {
    return this.paste.applyPaste(patternId, dto, req.user as AuthUser)
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.patterns.delete((req.user as AuthUser).id, id)
  }
}
