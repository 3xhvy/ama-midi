import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'
import { SongsService } from './songs.service'
import { CreateProjectSongDto } from './dto/create-project-song.dto'

@Controller('projects/:projectId/songs')
@UseGuards(AuthGuard('jwt'))
export class ProjectSongsController {
  constructor(private readonly songs: SongsService) {}

  @Get()
  findByProject(@Param('projectId') projectId: string, @Req() req: Request) {
    return this.songs.findByProject(projectId, req.user as AuthUser)
  }

  @Post()
  createInProject(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectSongDto,
    @Req() req: Request,
  ) {
    return this.songs.createInProject(projectId, dto, req.user as AuthUser)
  }
}
