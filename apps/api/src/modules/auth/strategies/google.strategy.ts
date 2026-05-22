import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy, type VerifyCallback } from 'passport-google-oauth20'
import { AuthService } from '../auth.service'

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly auth: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['email', 'profile'],
    })
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails: { value: string }[]; displayName: string; photos?: { value: string }[] },
    done: VerifyCallback,
  ) {
    const user = await this.auth.findOrCreateUser({
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    })
    done(null, user)
  }
}
