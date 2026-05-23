import { Module } from '@nestjs/common'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { VersionsController } from './versions.controller'
import { VersionsService } from './versions.service'

@Module({
  imports: [ProjectAccessModule],
  controllers: [VersionsController],
  providers: [VersionsService],
})
export class VersionsModule {}
