import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from './auth.service'
import type { Request, Response } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as AuthUser
    const token = this.auth.signToken(user)
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`)
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req: Request) {
    return req.user
  }
}
