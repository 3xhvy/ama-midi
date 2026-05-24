import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService }    from './users.service'
import { PrismaModule }    from '../prisma/prisma.module'
import { AuthModule }      from '../auth/auth.module'
import { ProjectAccessModule } from '../project-access/project-access.module'

@Module({
  imports:     [PrismaModule, AuthModule, ProjectAccessModule],
  controllers: [UsersController],
  providers:   [UsersService],
  exports:     [UsersService],
})
export class UsersModule {}
