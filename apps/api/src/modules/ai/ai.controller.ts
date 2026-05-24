import { Body, Controller, Headers, Logger, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AuthGuard } from '@nestjs/passport'
import { randomUUID } from 'crypto'
import type { Request, Response } from 'express'
import { AiService } from './ai.service'
import { AiChartService } from './ai-chart.service'
import { SuggestNotesDto } from './dto/suggest-notes.dto'
import { ApplyChartDto, GenerateChartDto, PreviewChartDto, ScaleChartDto } from './dto/chart.dto'
import { AiStreamEnvelopeDto } from './dto/ai-stream.dto'
import { endSse, initSse, writeSse } from './ai-stream.util'
import { toPublicAiErrorMessage } from '../../common/public-error.util'
import type {
  ApplyChartResponse,
  AuthUser,
  ChartApplyPreview,
  GenerateChartResponse,
  SuggestNotesResponse,
} from '@ama-midi/shared'

@Controller('songs/:songId')
@UseGuards(AuthGuard('jwt'))
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AiController {
  private readonly logger = new Logger(AiController.name)

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
    return this.ai.suggestNotes(songId, user, body)
  }

  @Post('generate-chart')
  generateChart(
    @Param('songId') songId: string,
    @Body() body: GenerateChartDto,
    @Req() req: Request,
  ): Promise<GenerateChartResponse> {
    const user = req.user as AuthUser
    return this.aiChart.generateChart(songId, user, body)
  }

  @Post('scale-chart')
  scaleChart(
    @Param('songId') songId: string,
    @Body() body: ScaleChartDto,
    @Req() req: Request,
  ): Promise<GenerateChartResponse> {
    const user = req.user as AuthUser
    return this.aiChart.scaleChart(songId, user, body)
  }

  @Post('charts/:chartId/preview-chart')
  previewChart(
    @Param('songId') songId: string,
    @Param('chartId') chartId: string,
    @Body() body: PreviewChartDto,
    @Req() req: Request,
  ): Promise<ChartApplyPreview> {
    const user = req.user as AuthUser
    return this.aiChart.previewChart(songId, user, chartId, body)
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

  @Post('ai/stream')
  async streamAi(
    @Param('songId') songId: string,
    @Body() envelope: AiStreamEnvelopeDto,
    @Req() req: Request,
    @Res() res: Response,
    @Headers('accept') accept?: string,
  ): Promise<void> {
    const user = req.user as AuthUser
    const runId = randomUUID()

    if (accept && !accept.includes('text/event-stream')) {
      res.status(406).json({ message: 'Accept text/event-stream required' })
      return
    }

    initSse(res)
    writeSse(res, { type: 'run', runId, action: envelope.action })

    const emitStep = (step: {
      type: 'step'
      stepId: string
      label: string
      status: 'active' | 'done' | 'error'
      detail?: string
    }) => {
      writeSse(res, { ...step, runId })
    }

    try {
      if (envelope.action === 'generate-chart') {
        const payload = await this.aiChart.generateChart(
          songId,
          user,
          envelope.payload as GenerateChartDto,
          emitStep,
        )
        writeSse(res, { type: 'result', runId, action: 'generate-chart', payload })
      } else if (envelope.action === 'scale-chart') {
        const payload = await this.aiChart.scaleChart(
          songId,
          user,
          envelope.payload as ScaleChartDto,
          emitStep,
        )
        writeSse(res, { type: 'result', runId, action: 'scale-chart', payload })
      } else {
        const payload = await this.ai.suggestNotes(
          songId,
          user,
          envelope.payload as SuggestNotesDto,
          emitStep,
        )
        writeSse(res, { type: 'result', runId, action: 'suggest-notes', payload })
      }
      endSse(res)
    } catch (e) {
      this.logger.error('AI stream failed', e instanceof Error ? e.stack : String(e))
      writeSse(res, { type: 'error', runId, message: toPublicAiErrorMessage(e) })
      endSse(res)
    }
  }
}
