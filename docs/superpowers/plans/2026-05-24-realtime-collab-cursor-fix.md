# Real-Time Collaboration & Cursor Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 10 gaps in the WebSocket multi-user collaboration + cursor system (multi-tab bugs, ephemeral cursor store, color consistency, trailing throttle, connection indicator).

**Architecture:** Add a Redis-backed `CursorService` for ephemeral cursor state; fix gateway multi-tab session safety; wire new `cursor-snapshot`/`cursor-hidden` events end-to-end; fix frontend drag/leave/color/throttle gaps.

**Tech Stack:** NestJS + Socket.io + ioredis (backend), React + socket.io-client (frontend), `@ama-midi/shared` (shared types/utils), Jest (API tests)

---

## File Map

| File | Action | Fixes |
|------|--------|-------|
| `packages/shared/src/colors.ts` | Add `getColorFromName` export | #6 |
| `apps/web/src/hooks/useThrottle.ts` | Add trailing-edge option | #7 |
| `apps/api/src/modules/realtime/cursor.service.ts` | **New** — Redis cursor store | #2, #5, #9 |
| `apps/api/src/modules/realtime/__tests__/cursor.service.spec.ts` | **New** — unit tests | #2, #5, #9 |
| `apps/api/src/modules/realtime/realtime.module.ts` | Register `CursorService` | #2, #5, #9 |
| `apps/api/src/modules/realtime/realtime.gateway.ts` | Multi-tab fix, cursor-snapshot, cursor-hide handler | #1, #2, #5 server |
| `apps/web/src/features/collaboration/useSocket.ts` | Add `isConnected`, `emitCursorHide`, `cursor-snapshot`/`cursor-hidden` handlers | #3, #5 client, #8 |
| `apps/web/src/features/editor/components/PianoRoll.tsx` | Fix drag guard, add `onCursorHide` prop | #4, #5 trigger |
| `apps/web/src/pages/EditorPage.tsx` | Wire `isConnected` + `emitCursorHide` | #3, #5 |
| `apps/web/src/features/editor/components/Toolbar.tsx` | Add `isConnected` prop, render `PresenceBar`, add connection dot | #3, PresenceBar dead |
| `apps/web/src/features/collaboration/CollaboratorCursors.tsx` | Import `getColorFromName` from shared | #6 |
| `apps/web/src/features/collaboration/PresenceBar.tsx` | Import from shared, remove local duplicate, use `id` not `name` | #6 |

---

## Task 1: Add `getColorFromName` to shared package

**Files:**
- Modify: `packages/shared/src/colors.ts`
- Modify: `apps/web/src/features/collaboration/CollaboratorCursors.tsx`
- Modify: `apps/web/src/features/collaboration/PresenceBar.tsx`

- [ ] **Step 1.1: Add function to `packages/shared/src/colors.ts`**

Append to end of file (after the `SYNC_STATUS_COLORS` block):

```ts
// packages/shared/src/colors.ts  (append)

const USER_COLOR_PALETTE = [
  '#6C63FF',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
  '#EC4899',
  '#8B5CF6',
  '#3B82F6',
] as const

/**
 * Deterministic color for a user. Pass userId (not name) for consistency.
 */
export function getColorFromName(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return USER_COLOR_PALETTE[Math.abs(hash) % USER_COLOR_PALETTE.length]
}
```

> Note: `packages/shared/src/index.ts` already has `export * from './colors'` — no index change needed.

- [ ] **Step 1.2: Update `CollaboratorCursors.tsx` import**

Change:
```ts
import { getColorFromName } from '../../lib/utils'
```
To:
```ts
import { getColorFromName } from '@ama-midi/shared'
```

`cursor.userId` is already passed — no other change needed in this file.

- [ ] **Step 1.3: Update `PresenceBar.tsx` — remove local duplicate, import from shared, use `id`**

Replace the entire file with:

```tsx
// apps/web/src/features/collaboration/PresenceBar.tsx
import { getColorFromName } from '@ama-midi/shared'

interface PresenceUser {
  id:        string
  name:      string
  avatarUrl?: string
  email?:    string
}

interface Props {
  users: PresenceUser[]
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function PresenceBar({ users }: Props) {
  const visible  = users.slice(0, 5)
  const overflow = users.length - visible.length

  return (
    <div className="flex items-center gap-1">
      {visible.map((user, i) => (
        <div
          key={user.id}
          title={user.name}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-shell-surface cursor-default select-none overflow-hidden"
          style={{
            backgroundColor: getColorFromName(user.id),
            marginLeft: i > 0 ? '-8px' : '0',
            zIndex: visible.length - i,
            position: 'relative',
          }}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="w-8 h-8 rounded-full bg-shell-surface border border-shell-border flex items-center justify-center text-xs text-shell-muted"
          style={{ marginLeft: '-8px', position: 'relative', zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 1.4: Build shared package to verify**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/packages/shared && pnpm build
```

Expected: exits 0, no type errors.

- [ ] **Step 1.5: Commit**

```bash
git add packages/shared/src/colors.ts \
        apps/web/src/features/collaboration/CollaboratorCursors.tsx \
        apps/web/src/features/collaboration/PresenceBar.tsx
git commit -m "fix(collab): move getColorFromName to shared, use userId for consistent colors"
```

---

## Task 2: Add trailing-edge option to `useThrottle`

**Files:**
- Modify: `apps/web/src/hooks/useThrottle.ts`

- [ ] **Step 2.1: Replace `useThrottle` with trailing-edge support**

Replace entire file:

```ts
// apps/web/src/hooks/useThrottle.ts
import { useRef, useCallback } from 'react'

export function useThrottle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limitMs: number,
  trailing = false,
): T {
  const lastCallRef     = useRef(0)
  const trailingRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef     = useRef<Parameters<T> | null>(null)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      lastArgsRef.current = args

      if (trailingRef.current) {
        clearTimeout(trailingRef.current)
        trailingRef.current = null
      }

      if (now - lastCallRef.current >= limitMs) {
        lastCallRef.current = now
        fn(...args)
      } else if (trailing) {
        const remaining = limitMs - (now - lastCallRef.current)
        trailingRef.current = setTimeout(() => {
          lastCallRef.current  = Date.now()
          trailingRef.current  = null
          if (lastArgsRef.current) fn(...lastArgsRef.current)
        }, remaining)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, limitMs, trailing],
  ) as T
}
```

- [ ] **Step 2.2: Update `throttledCursorEmit` in `PianoRoll.tsx` to use trailing**

Find lines 109–112 in `apps/web/src/features/editor/components/PianoRoll.tsx`:

```ts
  const throttledCursorEmit = useThrottle(
    useCallback((track: number, time: number) => { onCursorMove?.(track, time) }, [onCursorMove]),
    66,
  )
```

Replace with:

```ts
  const throttledCursorEmit = useThrottle(
    useCallback((track: number, time: number) => { onCursorMove?.(track, time) }, [onCursorMove]),
    66,
    true,
  )
```

- [ ] **Step 2.3: Verify TypeScript**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `useThrottle`.

- [ ] **Step 2.4: Commit**

```bash
git add apps/web/src/hooks/useThrottle.ts \
        apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "fix(collab): add trailing-edge flush to useThrottle, enable for cursor emit"
```

---

## Task 3: Create `CursorService` with unit tests

**Files:**
- Create: `apps/api/src/modules/realtime/cursor.service.ts`
- Create: `apps/api/src/modules/realtime/__tests__/cursor.service.spec.ts`

- [ ] **Step 3.1: Write the failing tests first**

Create `apps/api/src/modules/realtime/__tests__/cursor.service.spec.ts`:

```ts
jest.mock('ioredis', () => {
  const mockInstance = {
    set:  jest.fn().mockResolvedValue('OK'),
    del:  jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    mget: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
  }
  return jest.fn().mockImplementation(() => mockInstance)
})

import Redis from 'ioredis'
import { CursorService, type StoredCursor } from '../cursor.service'

const getInstance = () => (Redis as jest.MockedClass<typeof Redis>).mock.results[0].value

const cursor: StoredCursor = {
  userId: 'user-1',
  name:   'Alice',
  title:  'Composer',
  track:  3,
  time:   42.5,
}

describe('CursorService', () => {
  let service: CursorService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CursorService()
  })

  describe('setCursor', () => {
    it('writes JSON to Redis with 5s TTL', async () => {
      await service.setCursor('song-1', 'user-1', cursor)
      expect(getInstance().set).toHaveBeenCalledWith(
        'cursor:song-1:user-1',
        JSON.stringify(cursor),
        'EX',
        5,
      )
    })
  })

  describe('getCursors', () => {
    it('returns empty array when no keys exist', async () => {
      getInstance().keys.mockResolvedValue([])
      const result = await service.getCursors('song-1')
      expect(result).toEqual([])
    })

    it('returns parsed cursors for all keys in song', async () => {
      getInstance().keys.mockResolvedValue(['cursor:song-1:user-1', 'cursor:song-1:user-2'])
      getInstance().mget.mockResolvedValue([
        JSON.stringify(cursor),
        JSON.stringify({ ...cursor, userId: 'user-2', name: 'Bob' }),
      ])
      const result = await service.getCursors('song-1')
      expect(result).toHaveLength(2)
      expect(result[0].userId).toBe('user-1')
      expect(result[1].userId).toBe('user-2')
    })

    it('filters out null values (TTL-expired keys)', async () => {
      getInstance().keys.mockResolvedValue(['cursor:song-1:user-1', 'cursor:song-1:user-2'])
      getInstance().mget.mockResolvedValue([JSON.stringify(cursor), null])
      const result = await service.getCursors('song-1')
      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe('user-1')
    })
  })

  describe('deleteCursor', () => {
    it('deletes the correct Redis key', async () => {
      await service.deleteCursor('song-1', 'user-1')
      expect(getInstance().del).toHaveBeenCalledWith('cursor:song-1:user-1')
    })
  })

  describe('onModuleDestroy', () => {
    it('quits the Redis connection', async () => {
      await service.onModuleDestroy()
      expect(getInstance().quit).toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 3.2: Run tests — verify they fail**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && pnpm test -- --testPathPattern="cursor.service" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../cursor.service'`

- [ ] **Step 3.3: Implement `CursorService`**

Create `apps/api/src/modules/realtime/cursor.service.ts`:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import Redis from 'ioredis'

export interface StoredCursor {
  userId: string
  name:   string
  title?: string | null
  track:  number
  time:   number
}

@Injectable()
export class CursorService implements OnModuleDestroy {
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit()
  }

  private key(songId: string, userId: string): string {
    return `cursor:${songId}:${userId}`
  }

  async setCursor(songId: string, userId: string, data: StoredCursor): Promise<void> {
    await this.redis.set(this.key(songId, userId), JSON.stringify(data), 'EX', 5)
  }

  async getCursors(songId: string): Promise<StoredCursor[]> {
    const keys = await this.redis.keys(`cursor:${songId}:*`)
    if (keys.length === 0) return []
    const values = await this.redis.mget(...keys)
    return values
      .filter((v): v is string => v !== null)
      .map(v => JSON.parse(v) as StoredCursor)
  }

  async deleteCursor(songId: string, userId: string): Promise<void> {
    await this.redis.del(this.key(songId, userId))
  }
}
```

- [ ] **Step 3.4: Run tests — verify they pass**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && pnpm test -- --testPathPattern="cursor.service" --no-coverage 2>&1 | tail -20
```

Expected: PASS — 6 tests passing.

- [ ] **Step 3.5: Commit**

```bash
git add apps/api/src/modules/realtime/cursor.service.ts \
        apps/api/src/modules/realtime/__tests__/cursor.service.spec.ts
git commit -m "feat(realtime): add CursorService — Redis-backed ephemeral cursor store"
```

---

## Task 4: Register `CursorService` in `RealtimeModule`

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.module.ts`

- [ ] **Step 4.1: Add `CursorService` to providers**

Replace entire file:

```ts
// apps/api/src/modules/realtime/realtime.module.ts
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { RealtimeGateway } from './realtime.gateway'
import { RealtimeListener } from './realtime.listener'
import { CursorService } from './cursor.service'

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  providers: [RealtimeGateway, RealtimeListener, CursorService],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
```

- [ ] **Step 4.2: Verify API compiles**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
git add apps/api/src/modules/realtime/realtime.module.ts
git commit -m "fix(realtime): register CursorService in RealtimeModule"
```

---

## Task 5: Fix `realtime.gateway.ts` — multi-tab, cursor-snapshot, cursor-hide

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`

This task fixes:
- **#1** — multi-tab `deleteMany` nukes sibling sessions; `user-left` now conditional
- **#2** — `cursor-snapshot` sent to new joiner after fetching Redis state
- **#5 server** — new `cursor-hide` event handler
- **#9** — `cursor-move` now persists to Redis

- [ ] **Step 5.1: Replace `realtime.gateway.ts`**

```ts
// apps/api/src/modules/realtime/realtime.gateway.ts
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
    private readonly jwtService:    JwtService,
    private readonly prisma:        PrismaService,
    private readonly cursorService: CursorService,
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

    // Only find sessions owned by THIS socket
    const sessions = await this.prisma.editorSession.findMany({
      where: { userId: client.data.user.id, socketId: client.id },
    })

    for (const session of sessions) {
      await this.prisma.editorSession.deleteMany({ where: { id: session.id } })

      // Only announce user-left if no other tabs remain in this song
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
    if (!client.data.user) return
    client.join(`song:${data.songId}`)

    // Fix #1: only remove THIS socket's stale session, not sibling tabs
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

    // Fix #2: send current cursor positions to the joining client
    const cursors = await this.cursorService.getCursors(data.songId)
    client.emit('cursor-snapshot', { cursors })
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
    // Only announce if no other tabs remain
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
    const cursorData = {
      userId: client.data.user.id,
      name:   client.data.user.name,
      title:  client.data.user.title ?? null,
      track:  data.track,
      time:   data.time,
    }
    // Fix #9: persist to Redis so new joiners get this cursor in cursor-snapshot
    await this.cursorService.setCursor(data.songId, client.data.user.id, cursorData)
    client.to(`song:${data.songId}`).emit('cursor-moved', cursorData)
  }

  @SubscribeMessage('cursor-hide')
  async handleCursorHide(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { songId: string },
  ) {
    if (!client.data.user) return
    await this.cursorService.deleteCursor(data.songId, client.data.user.id)
    client.to(`song:${data.songId}`).emit('cursor-hidden', { userId: client.data.user.id })
  }

  broadcastToSong(songId: string, event: string, data: unknown) {
    this.server.to(`song:${songId}`).emit(event, data)
  }
}
```

- [ ] **Step 5.2: Verify API compiles**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5.3: Run full API test suite**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && pnpm test --no-coverage 2>&1 | tail -20
```

Expected: all tests pass (including `cursor.service.spec.ts`).

- [ ] **Step 5.4: Commit**

```bash
git add apps/api/src/modules/realtime/realtime.gateway.ts
git commit -m "fix(realtime): multi-tab safety, cursor-snapshot on join, cursor-hide handler, persist cursor-move to Redis"
```

---

## Task 6: Fix `useSocket.ts` — `isConnected`, `emitCursorHide`, cursor-snapshot/hidden handlers

**Files:**
- Modify: `apps/web/src/features/collaboration/useSocket.ts`

This task fixes:
- **#3** — expose `isConnected` from hook
- **#5 client** — add `emitCursorHide` + `cursor-hidden` listener
- **#8** — `cursor-snapshot` listener hydrates Map on join/reconnect

- [ ] **Step 6.1: Replace `useSocket.ts`**

```ts
// apps/web/src/features/collaboration/useSocket.ts
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../../store/auth.store'
import { toast } from 'sonner'
import type { Note, NotesBatchAppliedPayload } from '@ama-midi/shared'

export interface PresenceUser {
  id:          string
  name:        string
  avatarUrl?:  string
  email?:      string
  title?:      string | null
  department?: string | null
}

export interface CursorData {
  userId:   string
  name:     string
  title?:   string | null
  track:    number
  time:     number
  lastSeen: number
}

export function useSocket(songId: string, chartId?: string, projectId?: string) {
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([])
  const [isConnected,  setIsConnected]  = useState(false)
  const [cursors,      setCursors]      = useState<Map<string, CursorData>>(new Map())
  const queryClient = useQueryClient()
  const token       = useAuthStore(s => s.token)
  const socketRef   = useRef<Socket | null>(null)

  // Fallback stale-cursor cleanup (3s TTL safety net; cursor-hidden is the primary signal)
  useEffect(() => {
    const id = setInterval(() => {
      setCursors(prev => {
        const now  = Date.now()
        const next = new Map(prev)
        next.forEach((cursor, userId) => {
          if (now - cursor.lastSeen > 3000) next.delete(userId)
        })
        return next.size !== prev.size ? next : prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!token || !songId) return

    const WS_URL =
      import.meta.env.VITE_WS_URL ??
      (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001')

    const socket: Socket = io(WS_URL, {
      auth:       { token },
      transports: ['websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-song', { songId })
      if (projectId) socket.emit('join-project', { projectId })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      toast.loading('Connection lost — reconnecting...', {
        id:        'ws-disconnect',
        duration:  Infinity,
        className: 'ama-toast ama-toast--connecting',
      })
    })

    socket.on('connect_error', () => {
      toast.loading('Connection lost — reconnecting...', {
        id:        'ws-disconnect',
        duration:  Infinity,
        className: 'ama-toast ama-toast--connecting',
      })
    })

    socket.io.on('reconnect', () => {
      toast.dismiss('ws-disconnect')
      toast.success('Back online — syncing changes', { className: 'ama-toast ama-toast--success' })
      setIsConnected(true)
      // re-join triggers presence-list + cursor-snapshot from server (fixes #8, #10)
    })

    // Presence
    socket.on('presence-list', (users: PresenceUser[]) => {
      setPresenceList(users)
    })

    socket.on('user-joined', (user: PresenceUser) => {
      setPresenceList(prev => {
        if (prev.find(u => u.id === user.id)) return prev
        return [...prev, user]
      })
    })

    socket.on('user-left', ({ userId }: { userId: string }) => {
      setPresenceList(prev => prev.filter(u => u.id !== userId))
      setCursors(prev => {
        const next = new Map(prev)
        next.delete(userId)
        return next
      })
    })

    // Cursors
    socket.on('cursor-snapshot', ({ cursors: snapshot }: { cursors: Omit<CursorData, 'lastSeen'>[] }) => {
      const now = Date.now()
      setCursors(() => {
        const map = new Map<string, CursorData>()
        snapshot.forEach(c => map.set(c.userId, { ...c, lastSeen: now }))
        return map
      })
    })

    socket.on('cursor-moved', (data: Omit<CursorData, 'lastSeen'>) => {
      setCursors(prev => {
        const next = new Map(prev)
        next.set(data.userId, { ...data, lastSeen: Date.now() })
        return next
      })
    })

    socket.on('cursor-hidden', ({ userId }: { userId: string }) => {
      setCursors(prev => {
        const next = new Map(prev)
        next.delete(userId)
        return next
      })
    })

    // Notes
    socket.on('note-created', (note: Note) => {
      const noteChartId = note.chartId ?? chartId
      if (!noteChartId) return
      queryClient.setQueriesData<Note[]>(
        { queryKey: ['notes', noteChartId], exact: false },
        (old) => {
          if (!old) return [note]
          if (old.find((n) => n.id === note.id)) return old
          return [...old, note]
        },
      )
    })

    socket.on('note-updated', (note: Note) => {
      const noteChartId = note.chartId ?? chartId
      if (!noteChartId) return
      queryClient.setQueriesData<Note[]>(
        { queryKey: ['notes', noteChartId], exact: false },
        (old) => (old ? old.map((n) => (n.id === note.id ? note : n)) : [note]),
      )
    })

    socket.on('note-deleted', ({ noteId }: { noteId: string }) => {
      queryClient.setQueriesData<Note[]>(
        {
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === 'notes',
        },
        (old) => (old ? old.filter((n) => n.id !== noteId) : old),
      )
    })

    socket.on('notes-batch-applied', (payload: NotesBatchAppliedPayload) => {
      const batchChartId = payload.created[0]?.chartId ?? chartId
      if (!batchChartId) return
      queryClient.setQueriesData<Note[]>(
        { queryKey: ['notes', batchChartId], exact: false },
        (old) => {
          if (!old) return payload.created
          const deleted      = new Set(payload.deletedIds)
          const createdById  = new Map(payload.created.map((note) => [note.id, note]))
          const kept         = old.filter((note) => !deleted.has(note.id) && !createdById.has(note.id))
          return [...kept, ...payload.created]
        },
      )
      queryClient.invalidateQueries({ queryKey: ['validation', songId] })
    })

    socket.on('section-created', () => queryClient.invalidateQueries({ queryKey: ['sections', songId] }))
    socket.on('section-updated', () => queryClient.invalidateQueries({ queryKey: ['sections', songId] }))
    socket.on('section-deleted', () => queryClient.invalidateQueries({ queryKey: ['sections', songId] }))

    if (projectId) {
      socket.on('project.member.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project-songs', projectId] })
      })
      socket.on('project.member.removed', () => {
        queryClient.invalidateQueries({ queryKey: ['project-members', projectId] })
        queryClient.invalidateQueries({ queryKey: ['project-songs', projectId] })
      })
    }

    return () => {
      socket.emit('leave-song', { songId })
      if (projectId) socket.emit('leave-project', { projectId })
      socket.disconnect()
      socketRef.current = null
      toast.dismiss('ws-disconnect')
    }
  }, [songId, chartId, projectId, token, queryClient])

  function emitCursorMove(track: number, time: number) {
    socketRef.current?.emit('cursor-move', { songId, track, time })
  }

  function emitCursorHide() {
    socketRef.current?.emit('cursor-hide', { songId })
  }

  return { presenceList, isConnected, cursors, emitCursorMove, emitCursorHide }
}
```

- [ ] **Step 6.2: Verify TypeScript**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/src/features/collaboration/useSocket.ts
git commit -m "fix(collab): expose isConnected, add emitCursorHide, handle cursor-snapshot/cursor-hidden events"
```

---

## Task 7: Fix `PianoRoll.tsx` — drag guard, `onCursorHide` prop

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

This task fixes:
- **#4** — cursor emit no longer blocked during selection drag
- **#5 trigger** — `onMouseLeave` fires `onCursorHide`

- [ ] **Step 7.1: Add `onCursorHide` to Props interface**

Find the `interface Props` block (around line 43–53):

```ts
interface Props {
  songId:           string
  chartId?:         string
  speedMultiplier?: number
  canEdit?:         boolean
  readOnlyMessage?: string | null
  mutedTracks?:     Set<number>
  onNoteSelected?:  (note: Note | null) => void
  cursors?:         Map<string, CursorData>
  onCursorMove?:    (track: number, time: number) => void
}
```

Replace with:

```ts
interface Props {
  songId:           string
  chartId?:         string
  speedMultiplier?: number
  canEdit?:         boolean
  readOnlyMessage?: string | null
  mutedTracks?:     Set<number>
  onNoteSelected?:  (note: Note | null) => void
  cursors?:         Map<string, CursorData>
  onCursorMove?:    (track: number, time: number) => void
  onCursorHide?:    () => void
}
```

- [ ] **Step 7.2: Destructure `onCursorHide` in function signature**

Find line 55:
```ts
export function PianoRoll({ songId, chartId, speedMultiplier = 1, canEdit = true, readOnlyMessage = null, mutedTracks = new Set(), onNoteSelected, cursors, onCursorMove }: Props) {
```

Replace with:
```ts
export function PianoRoll({ songId, chartId, speedMultiplier = 1, canEdit = true, readOnlyMessage = null, mutedTracks = new Set(), onNoteSelected, cursors, onCursorMove, onCursorHide }: Props) {
```

- [ ] **Step 7.3: Fix `handleMouseMove` — move drag guard after cursor emit**

Find lines 186–199:
```ts
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    if (selectionDrag) return
    const rect  = containerRef.current.getBoundingClientRect()
    const scrollLeft = containerRef.current.scrollLeft
    const x     = e.clientX - rect.left + scrollLeft
    const y     = e.clientY - rect.top + scrollTop
    const track = xToTrack(x, layoutGridWidth)
    const time  = yToTime(y, pxPerSecond, snapMode, bpm)
    throttledCursorEmit(track, time)
    setActiveTrack(track)
    if (!effectiveCanEdit) return
    setGhost({ track, time })
  }, [effectiveCanEdit, layoutGridWidth, pxPerSecond, scrollTop, snapMode, bpm, throttledCursorEmit, setActiveTrack, selectionDrag])
```

Replace with:
```ts
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect       = containerRef.current.getBoundingClientRect()
    const scrollLeft = containerRef.current.scrollLeft
    const x          = e.clientX - rect.left + scrollLeft
    const y          = e.clientY - rect.top + scrollTop
    const track      = xToTrack(x, layoutGridWidth)
    const time       = yToTime(y, pxPerSecond, snapMode, bpm)
    throttledCursorEmit(track, time)  // always fires — even during selection drag
    if (selectionDrag) return          // guard moved: only blocks ghost/activeTrack
    setActiveTrack(track)
    if (!effectiveCanEdit) return
    setGhost({ track, time })
  }, [effectiveCanEdit, layoutGridWidth, pxPerSecond, scrollTop, snapMode, bpm, throttledCursorEmit, setActiveTrack, selectionDrag])
```

- [ ] **Step 7.4: Add `onCursorHide?.()` to `onMouseLeave`**

Find:
```tsx
            onMouseLeave={() => {
              if (effectiveCanEdit) setGhost(null)
              setActiveTrack(null)
            }}
```

Replace with:
```tsx
            onMouseLeave={() => {
              if (effectiveCanEdit) setGhost(null)
              setActiveTrack(null)
              onCursorHide?.()
            }}
```

- [ ] **Step 7.5: Verify TypeScript**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && npx tsc --noEmit 2>&1 | grep -i "PianoRoll" | head -10
```

Expected: no errors.

- [ ] **Step 7.6: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "fix(collab): cursor emit during drag, fire cursor-hide on mouse leave"
```

---

## Task 8: Wire `isConnected` + `emitCursorHide` in `EditorPage.tsx`; fix `Toolbar.tsx`

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx`

This task fixes:
- **#3** — `isConnected` wired to Toolbar UI
- **#5** — `emitCursorHide` passed to PianoRoll
- **PresenceBar was dead** — now rendered in Toolbar

- [ ] **Step 8.1: Update `EditorPage.tsx` — destructure `isConnected` + `emitCursorHide`**

Find line 115:
```ts
  const { presenceList, cursors, emitCursorMove } = useSocket(songId!, chartId, projectId)
```

Replace with:
```ts
  const { presenceList, isConnected, cursors, emitCursorMove, emitCursorHide } = useSocket(songId!, chartId, projectId)
```

- [ ] **Step 8.2: Pass `isConnected` to `Toolbar` in `EditorPage.tsx`**

Find the `<Toolbar` block (around line 214–232):
```tsx
      <Toolbar
        projectId={projectId!}
        projectName={project?.name ?? 'Project'}
        songId={songId!}
        songName={song?.name ?? '…'}
        songStatus={song?.status ?? 'DRAFT'}
        charts={charts}
        activeChartId={activeChartId}
        canEdit={canEdit}
        readOnlyMessage={readOnlyMessage}
        bpm={song?.bpm ?? 120}
        song={song}
        presenceList={presenceList}
        onShowShortcuts={() => setShowShortcuts(true)}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        onToggleLeft={handleToggleLeft}
        onToggleRight={handleToggleRight}
      />
```

Replace with:
```tsx
      <Toolbar
        projectId={projectId!}
        projectName={project?.name ?? 'Project'}
        songId={songId!}
        songName={song?.name ?? '…'}
        songStatus={song?.status ?? 'DRAFT'}
        charts={charts}
        activeChartId={activeChartId}
        canEdit={canEdit}
        readOnlyMessage={readOnlyMessage}
        bpm={song?.bpm ?? 120}
        song={song}
        presenceList={presenceList}
        isConnected={isConnected}
        onShowShortcuts={() => setShowShortcuts(true)}
        leftCollapsed={leftCollapsed}
        rightCollapsed={rightCollapsed}
        onToggleLeft={handleToggleLeft}
        onToggleRight={handleToggleRight}
      />
```

- [ ] **Step 8.3: Pass `onCursorHide` to `PianoRoll` in `EditorPage.tsx`**

Find the `<PianoRoll` block (around line 491–501):
```tsx
          <PianoRoll
            songId={songId}
            chartId={chartId}
            speedMultiplier={activeChart?.speedMultiplier ?? 1}
            canEdit={canEdit}
            readOnlyMessage={readOnlyMessage}
            mutedTracks={mutedTracks}
            onNoteSelected={handleNoteSelected}
            cursors={cursors}
            onCursorMove={emitCursorMove}
          />
```

Replace with:
```tsx
          <PianoRoll
            songId={songId}
            chartId={chartId}
            speedMultiplier={activeChart?.speedMultiplier ?? 1}
            canEdit={canEdit}
            readOnlyMessage={readOnlyMessage}
            mutedTracks={mutedTracks}
            onNoteSelected={handleNoteSelected}
            cursors={cursors}
            onCursorMove={emitCursorMove}
            onCursorHide={emitCursorHide}
          />
```

- [ ] **Step 8.4: Update `Toolbar.tsx` — add `isConnected` prop, destructure `presenceList`, render `PresenceBar` + connection dot**

Add `PresenceBar` import at top of `Toolbar.tsx` (after existing imports):
```ts
import { PresenceBar } from '../../collaboration/PresenceBar'
```

In the `ToolbarProps` interface, add `isConnected` (it already has `presenceList`):
```ts
interface ToolbarProps {
  projectId:        string
  projectName:      string
  songId:           string
  songName:         string
  songStatus:       SongStatus
  charts:           SongChart[]
  activeChartId:    string | null
  canEdit:          boolean
  readOnlyMessage?: string | null
  bpm:              number
  song?:            Song
  presenceList:     { id: string; name: string; avatarUrl?: string; title?: string | null; department?: string | null }[]
  isConnected?:     boolean
  onShowShortcuts:  () => void
  leftCollapsed:    boolean
  rightCollapsed:   boolean
  onToggleLeft:     () => void
  onToggleRight:    () => void
}
```

In the `Toolbar` function signature, add `presenceList` and `isConnected` to destructuring:
```ts
export function Toolbar({
  projectId, projectName, songId, songName, songStatus,
  charts, activeChartId,
  canEdit, readOnlyMessage, bpm, song,
  presenceList, isConnected = false,
  onShowShortcuts,
  leftCollapsed, rightCollapsed, onToggleLeft, onToggleRight,
}: ToolbarProps) {
```

In the RIGHT section of the toolbar JSX, add `PresenceBar` and connection dot before the user avatar. Find:
```tsx
        {user && (
          <div className="ml-1 pl-1">
            <Avatar
```

Insert immediately before that block:
```tsx
        <PresenceBar users={presenceList} />

        <div
          className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`}
          title={isConnected ? 'Connected' : 'Reconnecting...'}
        />

```

- [ ] **Step 8.5: Verify TypeScript**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8.6: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx \
        apps/web/src/features/editor/components/Toolbar.tsx
git commit -m "fix(collab): wire isConnected to toolbar dot, render PresenceBar, pass onCursorHide to PianoRoll"
```

---

## Task 9: Final verification

- [ ] **Step 9.1: Run all API tests**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && pnpm test --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 9.2: Full TypeScript check — both apps + shared**

```bash
cd /Users/hohoanghvy/Projects/ama-midi && pnpm build 2>&1 | tail -30
```

Expected: exits 0.

- [ ] **Step 9.3: Manual smoke test checklist**

Start dev stack:
```bash
cd /Users/hohoanghvy/Projects/ama-midi && pnpm dev
```

Open two browser tabs at the same song URL.

Verify:
1. Both tabs show each other in `PresenceBar` (avatars visible in toolbar) — fixes PresenceBar dead component
2. Connection dot shows green in both tabs
3. Moving mouse in Tab A → cursor appears in Tab B immediately
4. Mouse leaving PianoRoll area in Tab A → cursor disappears in Tab B within ~100ms (not 3s)
5. Selection drag in Tab A → cursor still updates in Tab B
6. Close Tab A → presence avatar disappears in Tab B (not on Tab B reload)
7. Open Tab C at same song → Tab C immediately shows Tab B's cursor position (not blank)
8. Disconnect network (DevTools → offline) → amber pulsing dot appears
9. Reconnect → green dot returns, presence list re-syncs, cursors re-appear

- [ ] **Step 9.4: Commit final verification**

```bash
git add -A
git commit -m "chore: verify realtime collab cursor fix — all 10 gaps resolved"
```
