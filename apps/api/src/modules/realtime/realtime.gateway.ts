import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { CursorService } from './cursor.service'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server

  constructor(
    private readonly jwtService:      JwtService,
    private readonly prisma:          PrismaService,
    private readonly cursorService:   CursorService,
    private readonly projectAccess:   ProjectAccessService,
    private readonly eventEmitter:    EventEmitter2,
  ) {}

  async afterInit(server: Server) {
    const redisUrl  = process.env.REDIS_URL || 'redis://localhost:6379'
    const pubClient = new Redis(redisUrl)
    const subClient = pubClient.duplicate()
    server.adapter(createAdapter(pubClient, subClient))
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '')
      if (!token) { client.disconnect(); return }
      const payload = this.jwtService.verify<{
        sub: string
        email: string
        name?: string
        role: string
        title?: string
        department?: string
        tokenVersion?: number
      }>(token)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, role: true, title: true, department: true, avatarUrl: true, tokenVersion: true },
      })
      if (!user || user.tokenVersion !== (payload.tokenVersion ?? 0)) {
        client.disconnect()
        return
      }
      client.data.user = {
        id:         user.id,
        email:      user.email,
        name:       user.name,
        role:       user.role,
        title:      user.title ?? null,
        department: user.department ?? null,
        avatarUrl:  user.avatarUrl ?? null,
      }
      client.emit('authenticated')
    } catch {
      client.disconnect()
    }
  }

  async handleDisconnect(client: Socket) {
    if (!client.data.user) return

    const sessions = await this.prisma.editorSession.findMany({
      where: { userId: client.data.user.id, socketId: client.id },
    })

    for (const session of sessions) {
      await this.prisma.editorSession.deleteMany({ where: { id: session.id } })

      const remaining = await this.prisma.editorSession.count({
        where: { songId: session.songId, userId: client.data.user.id },
      })
      if (remaining === 0) {
        await this.cursorService.deleteCursor(session.songId, client.data.user.id)
        this.server.to(`song:${session.songId}`).emit('cursor-hidden', { userId: client.data.user.id })
        this.server.to(`song:${session.songId}`).emit('user-left', { userId: client.data.user.id })
      }
    }
  }

  @SubscribeMessage('join-song')
  async handleJoinSong(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string },
  ) {
    if (!client.data.user || !data?.songId) return
    try {
      if (!(await this.canViewSong(client, data.songId))) return
      client.join(`song:${data.songId}`)

      await this.prisma.editorSession.deleteMany({
        where: { songId: data.songId, userId: client.data.user.id, socketId: client.id },
      })
      await this.prisma.editorSession.create({
        data: { songId: data.songId, userId: client.data.user.id, socketId: client.id },
      })

      const sessions = await this.prisma.editorSession.findMany({
        where:   { songId: data.songId },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, email: true, role: true, title: true, department: true } },
        },
      })
      const users = Array.from(
        new Map(
          sessions.map((s) => [
            s.user.id,
            {
              id:         s.user.id,
              name:       s.user.name,
              avatarUrl:  s.user.avatarUrl,
              email:      s.user.email,
              role:       s.user.role,
              title:      s.user.title,
              department: s.user.department,
            },
          ]),
        ).values(),
      )

      client.to(`song:${data.songId}`).emit('user-joined', client.data.user)
      client.emit('presence-list', users)

      try {
        const cursors = await this.cursorService.getCursors(data.songId)
        client.emit('cursor-snapshot', { cursors })
      } catch (err) {
        console.error('[RealtimeGateway] getCursors failed, sending empty snapshot', err)
        client.emit('cursor-snapshot', { cursors: [] })
      }
    } catch (err) {
      console.error('[RealtimeGateway] join-song failed', err)
    }
  }

  @SubscribeMessage('join-project')
  async handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (!client.data.user || !data.projectId) return
    if (client.data.user.role !== 'ADMIN') {
      const membership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: data.projectId, userId: client.data.user.id } },
        select: { id: true },
      })
      if (!membership) return
    }
    client.join(`project:${data.projectId}`)
  }

  @SubscribeMessage('leave-project')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    if (!client.data.user || !data.projectId) return
    client.leave(`project:${data.projectId}`)
  }

  @SubscribeMessage('leave-song')
  async handleLeaveSong(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string },
  ) {
    if (!client.data.user) return
    client.leave(`song:${data.songId}`)
    await this.prisma.editorSession.deleteMany({
      where: { songId: data.songId, userId: client.data.user.id, socketId: client.id },
    })
    const remaining = await this.prisma.editorSession.count({
      where: { songId: data.songId, userId: client.data.user.id },
    })
    if (remaining === 0) {
      await this.cursorService.deleteCursor(data.songId, client.data.user.id)
      this.server.to(`song:${data.songId}`).emit('cursor-hidden', { userId: client.data.user.id })
      this.server.to(`song:${data.songId}`).emit('user-left', { userId: client.data.user.id })
    }
  }

  @SubscribeMessage('cursor-move')
  async handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string; track: number; time: number },
  ) {
    if (!client.data.user) return
    if (!(await this.canViewSong(client, data.songId))) return
    const cursorData = {
      userId: client.data.user.id,
      name:   client.data.user.name,
      title:  client.data.user.title ?? null,
      track:  data.track,
      time:   data.time,
    }
    // Fire-and-forget Redis write — don't block broadcast on persistence latency
    this.cursorService.setCursor(data.songId, client.data.user.id, cursorData)
      .catch(err => console.error('[RealtimeGateway] setCursor failed', err))
    client.to(`song:${data.songId}`).emit('cursor-moved', cursorData)
  }

  @SubscribeMessage('cursor-hide')
  async handleCursorHide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string },
  ) {
    if (!client.data.user) return
    if (!(await this.canViewSong(client, data.songId))) return
    this.cursorService.deleteCursor(data.songId, client.data.user.id)
      .catch(err => console.error('[RealtimeGateway] deleteCursor failed', err))
    client.to(`song:${data.songId}`).emit('cursor-hidden', { userId: client.data.user.id })
  }

  @SubscribeMessage('chart-switch')
  async handleChartSwitch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string; chartId: string; chartName: string },
  ) {
    if (!client.data.user || !data.songId || !data.chartId) return
    if (!(await this.canViewSong(client, data.songId))) return
    const chart = await this.prisma.songChart.findFirst({
      where: { id: data.chartId, songId: data.songId },
      select: { id: true },
    })
    if (!chart) return
    client.to(`song:${data.songId}`).emit('chart-switched', {
      actor: {
        id: client.data.user.id,
        name: client.data.user.name,
        avatarUrl: client.data.user.avatarUrl ?? null,
      },
      data: { chartId: data.chartId, chartName: data.chartName },
    })
    this.eventEmitter.emit('chart.switched', {
      songId: data.songId,
      chartId: data.chartId,
      chartName: data.chartName,
      userId: client.data.user.id,
    })
  }

  broadcastToSong(songId: string, event: string, data: unknown) {
    this.server.to(`song:${songId}`).emit(event, data)
  }

  private async canViewSong(client: Socket, songId: string): Promise<boolean> {
    if (!client.data.user || !songId) return false
    try {
      await this.projectAccess.assertCanViewSong(songId, client.data.user)
      return true
    } catch {
      return false
    }
  }
}
