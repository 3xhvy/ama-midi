import { Controller, Get, Patch, Body, Query, UseGuards, Req } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { UsersService } from './users.service'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('search')
  search(@Query('q') q?: string) {
    return this.users.search(q ?? '')
  }

  @Patch('me')
  updateMe(
    @Req() req: Request,
    @Body() body: { name?: string; title?: string; department?: string; tourComplete?: boolean; profileComplete?: boolean },
  ) {
    const user = req.user as AuthUser
    return this.users.updateProfile(user.id, body)
  }
}
