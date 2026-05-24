import { Body, Controller, Param, Post, UseGuards, Req } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AiService } from './ai.service'
import { AiChartService } from './ai-chart.service'
import { SuggestNotesDto } from './dto/suggest-notes.dto'
import { ApplyChartDto, GenerateChartDto, ScaleChartDto } from './dto/chart.dto'
import type { Request } from 'express'
import type {
  ApplyChartResponse,
  AuthUser,
  GenerateChartResponse,
  SuggestNotesResponse,
} from '@ama-midi/shared'

@Controller('songs/:songId')
@UseGuards(AuthGuard('jwt'))
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly aiChart: AiChartService,
  ) {}

  @Post('suggest-notes')
  suggestNotes(
    @Param('songId') songId: string,
    @Body() body: SuggestNotesDto,
    @Req() req: Request,
  ): Promise<SuggestNotesResponse> {
    const user = req.user as AuthUser
    return this.ai.suggestNotes(songId, user.role, body)
  }

  @Post('generate-chart')
  generateChart(
    @Param('songId') songId: string,
    @Body() body: GenerateChartDto,
    @Req() req: Request,
  ): Promise<GenerateChartResponse> {
    const user = req.user as AuthUser
    return this.aiChart.generateChart(songId, user.role, body)
  }

  @Post('scale-chart')
  scaleChart(
    @Param('songId') songId: string,
    @Body() body: ScaleChartDto,
    @Req() req: Request,
  ): Promise<GenerateChartResponse> {
    const user = req.user as AuthUser
    return this.aiChart.scaleChart(songId, user.role, body)
  }

  @Post('apply-chart')
  applyChart(
    @Param('songId') songId: string,
    @Body() body: ApplyChartDto,
    @Req() req: Request,
  ): Promise<ApplyChartResponse> {
    const user = req.user as AuthUser
    return this.aiChart.applyChart(songId, user, body)
  }
}
