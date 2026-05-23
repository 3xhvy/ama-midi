import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'
import { DashboardService } from './dashboard.service'

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getFeed(@Req() req: Request) {
    return this.dashboard.getFeed(req.user as AuthUser)
  }
}
