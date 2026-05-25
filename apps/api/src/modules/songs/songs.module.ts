import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ChartsModule } from '../charts/charts.module'
import { FileModule } from '../file/file.module'
import { SongsController } from './songs.controller'
import { ProjectSongsController } from './project-songs.controller'
import { SongTemplateService } from './song-template.service'
import { SongsService } from './songs.service'
import { BackingTrackService } from './backing-track.service'

@Module({
  imports: [PrismaModule, ProjectAccessModule, ChartsModule, FileModule],
  controllers: [SongsController, ProjectSongsController],
  providers: [SongsService, SongTemplateService, BackingTrackService],
  exports: [SongsService],
})
export class SongsModule {}
