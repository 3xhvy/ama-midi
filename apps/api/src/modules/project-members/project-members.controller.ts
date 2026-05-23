import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'
import { ProjectMembersService } from './project-members.service'
import { AddProjectMemberDto } from './dto/add-project-member.dto'
import { UpdateProjectMemberDto } from './dto/update-project-member.dto'

@Controller('projects/:projectId/members')
@UseGuards(AuthGuard('jwt'))
export class ProjectMembersController {
  constructor(private readonly members: ProjectMembersService) {}

  @Get()
  list(@Param('projectId') projectId: string, @Req() req: Request) {
    return this.members.list(projectId, req.user as AuthUser)
  }

  @Post()
  add(@Param('projectId') projectId: string, @Body() dto: AddProjectMemberDto, @Req() req: Request) {
    return this.members.add(projectId, dto, req.user as AuthUser)
  }

  @Patch(':memberId')
  update(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateProjectMemberDto,
    @Req() req: Request,
  ) {
    return this.members.update(projectId, memberId, dto, req.user as AuthUser)
  }

  @Delete(':memberId')
  remove(
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Req() req: Request,
  ) {
    return this.members.remove(projectId, memberId, req.user as AuthUser)
  }
}
