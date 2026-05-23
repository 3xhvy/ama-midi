import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { SongsController } from './songs.controller'
import { ProjectSongsController } from './project-songs.controller'
import { SongTemplateService } from './song-template.service'
import { SongsService } from './songs.service'

@Module({
  imports: [PrismaModule, ProjectAccessModule],
  controllers: [SongsController, ProjectSongsController],
  providers: [SongsService, SongTemplateService],
  exports: [SongsService],
})
export class SongsModule {}
