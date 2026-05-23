import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'
import { ProjectsService } from './projects.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.projects.findAll(req.user as AuthUser)
  }

  @Get(':projectId')
  findOne(@Param('projectId') projectId: string, @Req() req: Request) {
    return this.projects.findOne(projectId, req.user as AuthUser)
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    return this.projects.create(dto, req.user as AuthUser)
  }

  @Patch(':projectId')
  update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto, @Req() req: Request) {
    return this.projects.update(projectId, dto, req.user as AuthUser)
  }
}
