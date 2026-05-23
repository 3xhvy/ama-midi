import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaModule } from './modules/prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { SongsModule } from './modules/songs/songs.module'
import { NotesModule } from './modules/notes/notes.module'
import { LedgerModule } from './modules/ledger/ledger.module'
import { RealtimeModule } from './modules/realtime/realtime.module'
import { ValidationModule } from './modules/validation/validation.module'
import { AiModule } from './modules/ai/ai.module'
import { VersionsModule } from './modules/versions/versions.module'
import { UsersModule } from './modules/users/users.module'
import { PatternsModule } from './modules/patterns/patterns.module'
import { ProjectAccessModule } from './modules/project-access/project-access.module'
import { ProjectsModule } from './modules/projects/projects.module'
import { ProjectMembersModule } from './modules/project-members/project-members.module'
import { SectionsModule } from './modules/sections/sections.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', global: true }),
    ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 100 }]),
    PrismaModule,
    ProjectAccessModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ProjectMembersModule,
    DashboardModule,
    SongsModule,
    NotesModule,
    LedgerModule,
    RealtimeModule,
    ValidationModule,
    AiModule,
    VersionsModule,
    PatternsModule,
    SectionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
