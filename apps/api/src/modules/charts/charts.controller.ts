import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'
import { ChartsService } from './charts.service'
import { ChartAnalyzeService } from './chart-analyze.service'
import { CreateChartDto } from './dto/create-chart.dto'
import { UpdateChartDto } from './dto/update-chart.dto'
import { DuplicateChartDto } from './dto/duplicate-chart.dto'

@Controller()
@UseGuards(AuthGuard('jwt'))
export class ChartsController {
  constructor(
    private readonly charts: ChartsService,
    private readonly analyze: ChartAnalyzeService,
  ) {}

  @Get('songs/:songId/charts')
  listBySong(@Param('songId') songId: string, @Req() req: Request) {
    return this.charts.listBySong(songId, req.user as AuthUser)
  }

  @Post('songs/:songId/charts')
  create(
    @Param('songId') songId: string,
    @Body() dto: CreateChartDto,
    @Req() req: Request,
  ) {
    return this.charts.create(songId, dto, req.user as AuthUser)
  }

  @Get('charts/:chartId')
  findOne(@Param('chartId') chartId: string, @Req() req: Request) {
    return this.charts.findOne(chartId, req.user as AuthUser)
  }

  @Patch('charts/:chartId')
  update(
    @Param('chartId') chartId: string,
    @Body() dto: UpdateChartDto,
    @Req() req: Request,
  ) {
    return this.charts.update(chartId, dto, req.user as AuthUser)
  }

  @Delete('charts/:chartId')
  @HttpCode(204)
  remove(@Param('chartId') chartId: string, @Req() req: Request) {
    return this.charts.remove(chartId, req.user as AuthUser)
  }

  @Post('charts/:chartId/duplicate')
  duplicate(
    @Param('chartId') chartId: string,
    @Body() dto: DuplicateChartDto,
    @Req() req: Request,
  ) {
    return this.charts.duplicate(chartId, req.user as AuthUser, dto)
  }

  @Get('charts/:chartId/analysis')
  getAnalysis(@Param('chartId') chartId: string, @Req() req: Request) {
    return this.charts.findOne(chartId, req.user as AuthUser).then(() =>
      this.analyze.getAnalysis(chartId),
    )
  }

  @Post('charts/:chartId/analyze')
  runAnalysis(@Param('chartId') chartId: string, @Req() req: Request) {
    return this.charts.findOne(chartId, req.user as AuthUser).then(() =>
      this.analyze.run(chartId),
    )
  }
}
