import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { ProjectAccessModule } from '../project-access/project-access.module'

@Module({
  imports: [ProjectAccessModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
