import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthUser } from '@ama-midi/shared'

export const ROLES_KEY = 'roles'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!required || required.length === 0) return true

    const { user } = ctx.switchToHttp().getRequest<{ user: AuthUser }>()
    if (!required.includes(user?.role)) throw new ForbiddenException()
    return true
  }
}
