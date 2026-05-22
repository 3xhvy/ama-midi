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
import { PrismaService } from '../prisma/prisma.service'
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
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async afterInit(server: Server) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    const pubClient = new Redis(redisUrl)
    const subClient = pubClient.duplicate()
    server.adapter(createAdapter(pubClient, subClient))
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '')
      if (!token) {
        client.disconnect()
        return
      }
      const payload = this.jwtService.verify(token)
      client.data.user = {
        id:         payload.sub,
        email:      payload.email,
        name:       payload.name,
        role:       payload.role,
        title:      payload.title ?? null,
        department: payload.department ?? null,
      }
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
      this.server.to(`song:${session.songId}`).emit('user-left', { userId: client.data.user.id })
    }
  }

  @SubscribeMessage('join-song')
  async handleJoinSong(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string },
  ) {
    if (!client.data.user) return
    client.join(`song:${data.songId}`)

    // Remove any stale session for this user+song, then create fresh
    await this.prisma.editorSession.deleteMany({
      where: { songId: data.songId, userId: client.data.user.id },
    })
    await this.prisma.editorSession.create({
      data: { songId: data.songId, userId: client.data.user.id, socketId: client.id },
    })

    const sessions = await this.prisma.editorSession.findMany({
      where: { songId: data.songId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true, role: true, title: true, department: true } },
      },
    })
    const users = sessions.map((s) => ({
      id:         s.user.id,
      name:       s.user.name,
      avatarUrl:  s.user.avatarUrl,
      email:      s.user.email,
      role:       s.user.role,
      title:      s.user.title,
      department: s.user.department,
    }))

    client.to(`song:${data.songId}`).emit('user-joined', client.data.user)
    client.emit('presence-list', users)
  }

  @SubscribeMessage('leave-song')
  async handleLeaveSong(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string },
  ) {
    if (!client.data.user) return
    client.leave(`song:${data.songId}`)
    await this.prisma.editorSession.deleteMany({
      where: { songId: data.songId, userId: client.data.user.id },
    })
    this.server.to(`song:${data.songId}`).emit('user-left', { userId: client.data.user.id })
  }

  @SubscribeMessage('cursor-move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string; track: number; time: number },
  ) {
    if (!client.data.user) return
    client.to(`song:${data.songId}`).emit('cursor-moved', {
      userId: client.data.user.id,
      name:   client.data.user.name,
      title:  client.data.user.title ?? null,
      track:  data.track,
      time:   data.time,
    })
  }

  broadcastToSong(songId: string, event: string, data: unknown) {
    this.server.to(`song:${songId}`).emit(event, data)
  }
}
