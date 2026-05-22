import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { RealtimeGateway } from './realtime.gateway'
import { RealtimeListener } from './realtime.listener'

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  providers: [RealtimeGateway, RealtimeListener],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
