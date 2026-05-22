# Phase 2 — User Identity, Live Cursors + Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every collaborator a profile (title + department), show live cursors on the piano roll, enrich presence display, and guide new users through the app.

**Architecture:** 1 Prisma migration → new UsersModule → ProfileSetupPage → cursor WebSocket events → TourOverlay component system. Each subsystem is independently testable.

**Tech Stack:** NestJS, Prisma, Socket.io, React 18, Zustand, custom TourOverlay (no external tour library).

**Spec:** `docs/superpowers/specs/2026-05-22-phase2-user-identity-cursors-onboarding.md`

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `apps/api/prisma/schema.prisma` | Add title, department, profileComplete, tourComplete to User |
| Create | `apps/api/src/modules/users/users.module.ts` | UsersModule registration |
| Create | `apps/api/src/modules/users/users.controller.ts` | PATCH /users/me |
| Create | `apps/api/src/modules/users/users.service.ts` | updateProfile logic |
| Modify | `apps/api/src/modules/auth/auth.service.ts` | Sync avatarUrl, return needsProfile |
| Modify | `apps/api/src/modules/auth/auth.controller.ts` | Return needsProfile in callback response |
| Modify | `apps/api/src/modules/realtime/realtime.gateway.ts` | cursor-move handler |
| Modify | `apps/api/src/app.module.ts` | Register UsersModule |
| Modify | `packages/shared/src/types.ts` | Extend AuthUser with profile fields |
| Create | `apps/web/src/pages/ProfileSetupPage.tsx` | Profile completion form |
| Modify | `apps/web/src/pages/AuthCallbackPage.tsx` | Redirect to /profile-setup if needsProfile |
| Modify | `apps/web/src/App.tsx` | Add /profile-setup route |
| Modify | `apps/web/src/features/collaboration/useSocket.ts` | cursor-moved handler + enriched presence |
| Create | `apps/web/src/features/collaboration/CollaboratorCursors.tsx` | Render N cursors on grid |
| Modify | `apps/web/src/features/editor/components/PianoRoll.tsx` | Emit cursor-move, render CollaboratorCursors |
| Create | `apps/web/src/hooks/useThrottle.ts` | Generic throttle hook |
| Create | `apps/web/src/features/onboarding/TourOverlay.tsx` | Highlight + tooltip tour component |
| Create | `apps/web/src/features/onboarding/useAppTour.ts` | 6-step app tour logic |
| Create | `apps/web/src/features/onboarding/useSongTour.ts` | 3-step song tour logic |
| Modify | `apps/web/src/pages/EditorPage.tsx` | Wire useSongTour |
| Modify | `apps/web/src/pages/SongListPage.tsx` | Wire useAppTour |

---

## Task 1: DB Migration — User Profile Fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add fields to User model**

In `schema.prisma`, inside `model User {}` after `role`:

```prisma
title           String?
department      String?
profileComplete Boolean  @default(false)
tourComplete    Boolean  @default(false)
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_user_profile_fields
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 3: Verify**

```bash
cd apps/api && npx prisma studio
```

Open `User` model — confirm 4 new columns exist.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/ && git commit -m "feat: add user profile fields (title, department, profileComplete, tourComplete)"
```

---

## Task 2: Extend AuthUser Shared Type

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Update AuthUser interface**

```typescript
export interface AuthUser {
  id:              string
  email:           string
  name:            string
  avatarUrl?:      string
  role:            UserRole
  title?:          string
  department?:     string
  profileComplete: boolean
  tourComplete:    boolean
}
```

- [ ] **Step 2: Rebuild shared**

```bash
cd packages/shared && pnpm build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/dist/
git commit -m "feat: extend AuthUser with title, department, profileComplete, tourComplete"
```

---

## Task 3: UsersModule — PATCH /users/me

**Files:**
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/users.controller.ts`
- Create: `apps/api/src/modules/users/users.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create UsersService**

```typescript
// apps/api/src/modules/users/users.service.ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '@ama-midi/shared'

interface UpdateProfileDto {
  name?:            string
  title?:           string
  department?:      string
  profileComplete?: boolean
  tourComplete?:    boolean
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data:  dto,
    })
    return {
      id:              user.id,
      email:           user.email,
      name:            user.name,
      avatarUrl:       user.avatarUrl ?? undefined,
      role:            user.role as AuthUser['role'],
      title:           user.title ?? undefined,
      department:      user.department ?? undefined,
      profileComplete: user.profileComplete,
      tourComplete:    user.tourComplete,
    }
  }
}
```

- [ ] **Step 2: Create UsersController**

```typescript
// apps/api/src/modules/users/users.controller.ts
import { Controller, Patch, Body, UseGuards, Req } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { UsersService } from './users.service'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  updateMe(
    @Req() req: Request,
    @Body() body: { name?: string; title?: string; department?: string; tourComplete?: boolean },
  ) {
    const user = req.user as AuthUser
    return this.users.updateProfile(user.id, body)
  }
}
```

- [ ] **Step 3: Create UsersModule**

```typescript
// apps/api/src/modules/users/users.module.ts
import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService }    from './users.service'
import { PrismaModule }    from '../prisma/prisma.module'
import { AuthModule }      from '../auth/auth.module'

@Module({
  imports:     [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers:   [UsersService],
  exports:     [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 4: Register in AppModule**

```typescript
// app.module.ts — add to imports:
import { UsersModule } from './modules/users/users.module'

// In @Module imports array:
UsersModule,
```

- [ ] **Step 5: Write unit test**

Create `apps/api/src/modules/users/__tests__/users.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing'
import { UsersService } from '../users.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('UsersService', () => {
  let service: UsersService
  let prisma: { user: { update: jest.Mock } }

  beforeEach(async () => {
    prisma = { user: { update: jest.fn() } }
    const mod = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = mod.get(UsersService)
  })

  it('updates profile and returns AuthUser shape', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'A',
      avatarUrl: null, role: 'COMPOSER',
      title: 'Sound Designer', department: 'Core Music',
      profileComplete: true, tourComplete: false,
    })

    const result = await service.updateProfile('u1', { title: 'Sound Designer' })

    expect(result.title).toBe('Sound Designer')
    expect(result.profileComplete).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data:  { title: 'Sound Designer' },
    })
  })
})
```

Run: `cd apps/api && pnpm test --testPathPattern=users.service`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/users/ apps/api/src/app.module.ts
git commit -m "feat: UsersModule with PATCH /users/me endpoint"
```

---

## Task 4: Auth — Sync avatarUrl + Return needsProfile

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Update auth.service.ts — always sync avatarUrl**

In the `findOrCreate` / `validateGoogleUser` method, change the `upsert` to always update `avatarUrl`:

```typescript
const user = await this.prisma.user.upsert({
  where:  { email: profile.email },
  update: { avatarUrl: profile.avatarUrl ?? null },   // always sync
  create: {
    email:    profile.email,
    name:     profile.name,
    avatarUrl: profile.avatarUrl ?? null,
    role:     'COMPOSER',
  },
})
```

- [ ] **Step 2: Include profileComplete in JWT payload and response**

In `auth.service.ts`, when creating the JWT, include profile fields:

```typescript
const payload = {
  sub:        user.id,
  email:      user.email,
  name:       user.name,
  role:       user.role,
  title:      user.title,
  department: user.department,
}

return {
  accessToken:    this.jwt.sign(payload),
  needsProfile:   !user.profileComplete,
  user: {
    id:              user.id,
    email:           user.email,
    name:            user.name,
    avatarUrl:       user.avatarUrl ?? undefined,
    role:            user.role,
    title:           user.title ?? undefined,
    department:      user.department ?? undefined,
    profileComplete: user.profileComplete,
    tourComplete:    user.tourComplete,
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/auth/
git commit -m "feat: sync avatarUrl on login, return needsProfile in auth callback"
```

---

## Task 5: ProfileSetupPage

**Files:**
- Create: `apps/web/src/pages/ProfileSetupPage.tsx`
- Modify: `apps/web/src/pages/AuthCallbackPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create ProfileSetupPage**

```typescript
// apps/web/src/pages/ProfileSetupPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Avatar } from '../components/ui'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../features/auth/api'
import type { AuthUser } from '@ama-midi/shared'

const DEPARTMENTS = ['Core Music', 'Game Dev', 'QA', 'Product', 'Other']

export function ProfileSetupPage() {
  const { user, token, setAuth } = useAuthStore()
  const navigate = useNavigate()

  const [name,       setName]       = useState(user?.name ?? '')
  const [title,      setTitle]      = useState('')
  const [department, setDepartment] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    if (!department)   { setError('Department is required'); return }

    setLoading(true)
    try {
      const updated = await apiClient(token)<AuthUser>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name:           name.trim(),
          title:          title.trim(),
          department,
          profileComplete: true,
        }),
      })
      setAuth(updated, token!)
      navigate('/')
    } catch {
      setError('Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-shell-bg flex items-center justify-center p-4">
      <div className="bg-shell-surface rounded-2xl shadow-lg p-8 w-full max-w-md border border-shell-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amanotes-pink to-amanotes-purple" />
          <h1 className="text-lg font-semibold text-shell-text">Complete your profile</h1>
        </div>

        <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-shell-bg border border-shell-border">
          <Avatar name={user?.name ?? ''} src={user?.avatarUrl} size="md" />
          <div>
            <p className="text-sm font-medium text-shell-text">{user?.email}</p>
            <p className="text-xs text-shell-muted">Synced from Google</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-shell-muted mb-1">Display Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs text-shell-muted mb-1">Title <span className="text-error">*</span></label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Sound Designer, Game Developer"
            />
          </div>

          <div>
            <label className="block text-xs text-shell-muted mb-1">Department <span className="text-error">*</span></label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-shell-surface text-shell-text border-shell-border focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select department…</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <Button type="submit" variant="primary" size="md" loading={loading} className="mt-2">
            Enter AMA-MIDI
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update AuthCallbackPage to redirect on needsProfile**

In `AuthCallbackPage.tsx`, after receiving the auth response:

```typescript
// After setAuth(user, accessToken):
if (response.needsProfile) {
  navigate('/profile-setup', { replace: true })
} else {
  navigate('/', { replace: true })
}
```

- [ ] **Step 3: Add route to App.tsx**

```tsx
import { ProfileSetupPage } from './pages/ProfileSetupPage'

// In Routes:
<Route path="/profile-setup" element={<ProfileSetupPage />} />
```

- [ ] **Step 4: Verify flow**

Sign out, sign back in. Should redirect to `/profile-setup`. Fill form, submit → song list.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ProfileSetupPage.tsx apps/web/src/pages/AuthCallbackPage.tsx apps/web/src/App.tsx
git commit -m "feat: ProfileSetupPage — required on first login, blocks song access until complete"
```

---

## Task 6: Throttle Hook

**Files:**
- Create: `apps/web/src/hooks/useThrottle.ts`

- [ ] **Step 1: Create file**

```typescript
import { useRef, useCallback } from 'react'

export function useThrottle<T extends (...args: any[]) => void>(
  fn: T,
  limitMs: number,
): T {
  const lastCallRef = useRef(0)
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCallRef.current >= limitMs) {
      lastCallRef.current = now
      fn(...args)
    }
  }, [fn, limitMs]) as T
}
```

- [ ] **Step 2: Write unit test**

```typescript
// apps/web/src/hooks/__tests__/useThrottle.test.ts
import { renderHook } from '@testing-library/react'
import { useThrottle } from '../useThrottle'

it('only calls fn once within throttle window', () => {
  const fn = jest.fn()
  const { result } = renderHook(() => useThrottle(fn, 100))

  result.current()
  result.current()
  result.current()

  expect(fn).toHaveBeenCalledTimes(1)
})
```

Run: `cd apps/web && pnpm test --testPathPattern=useThrottle`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useThrottle.ts
git commit -m "feat: useThrottle hook (66ms default for cursor emission)"
```

---

## Task 7: Live Cursor WebSocket — Backend

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`

- [ ] **Step 1: Add cursor-move handler**

In `realtime.gateway.ts`, add inside the class:

```typescript
@SubscribeMessage('cursor-move')
handleCursorMove(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { songId: string; track: number; time: number },
) {
  if (!client.data.user) return
  client.to(`song:${data.songId}`).emit('cursor-moved', {
    userId:    client.data.user.id,
    name:      client.data.user.name,
    title:     client.data.user.title ?? null,
    track:     data.track,
    time:      data.time,
  })
}
```

Also update `handleConnection` to attach `title` and `department` to `client.data.user` from JWT payload. In `auth.strategy.ts` or wherever JWT is validated, ensure `title` and `department` are in the payload.

- [ ] **Step 2: Update JWT strategy to include profile fields**

In `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, the `validate` method:

```typescript
validate(payload: { sub: string; email: string; name: string; role: string; title?: string; department?: string }) {
  return {
    id:         payload.sub,
    email:      payload.email,
    name:       payload.name,
    role:       payload.role,
    title:      payload.title,
    department: payload.department,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/realtime/ apps/api/src/modules/auth/
git commit -m "feat: cursor-move WebSocket handler in RealtimeGateway"
```

---

## Task 8: Live Cursor — Frontend

**Files:**
- Modify: `apps/web/src/features/collaboration/useSocket.ts`
- Create: `apps/web/src/features/collaboration/CollaboratorCursors.tsx`
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Add cursor state to useSocket**

In `useSocket.ts`, add cursor map state:

```typescript
interface CursorData {
  userId:   string
  name:     string
  title?:   string | null
  track:    number
  time:     number
  lastSeen: number
}

// Inside useSocket hook, add:
const [cursors, setCursors] = useState<Map<string, CursorData>>(new Map())

// In socket event handlers section:
socket.on('cursor-moved', (data: Omit<CursorData, 'lastSeen'>) => {
  setCursors(prev => {
    const next = new Map(prev)
    next.set(data.userId, { ...data, lastSeen: Date.now() })
    return next
  })
})

// Stale cursor cleanup:
useEffect(() => {
  const id = setInterval(() => {
    setCursors(prev => {
      const now  = Date.now()
      const next = new Map(prev)
      next.forEach((cursor, userId) => {
        if (now - cursor.lastSeen > 3000) next.delete(userId)
      })
      return next
    })
  }, 1000)
  return () => clearInterval(id)
}, [])

// Return cursors from the hook:
return { presenceList, isConnected, cursors }
```

- [ ] **Step 2: Create CollaboratorCursors component**

```typescript
// apps/web/src/features/collaboration/CollaboratorCursors.tsx
import { getColorFromName } from '../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../editor/engine'
import type { Note } from '@ama-midi/shared'

interface CursorData {
  userId:  string
  name:    string
  title?:  string | null
  track:   number
  time:    number
}

interface Props {
  cursors:     Map<string, CursorData>
  gridWidth:   number
  pxPerSecond: number
  scrollTop:   number
}

export function CollaboratorCursors({ cursors, gridWidth, pxPerSecond, scrollTop }: Props) {
  const tw = trackWidth(gridWidth)

  return (
    <>
      {Array.from(cursors.values()).map((cursor) => {
        const x = trackToX(cursor.track, gridWidth) + tw / 2
        const y = timeToY(cursor.time, pxPerSecond) - scrollTop

        if (y < -20 || y > window.innerHeight) return null

        return (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none z-20 flex items-center gap-1"
            style={{ left: x - 6, top: y - 6 }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shrink-0"
              style={{ backgroundColor: getColorFromName(cursor.userId) }}
            />
            <span
              className="text-[9px] text-white px-1 py-0.5 rounded whitespace-nowrap"
              style={{ backgroundColor: getColorFromName(cursor.userId) + 'DD' }}
            >
              {cursor.name}{cursor.title ? ` · ${cursor.title}` : ''}
            </span>
          </div>
        )
      })}
    </>
  )
}
```

- [ ] **Step 3: Emit cursor-move from PianoRoll**

In `PianoRoll.tsx`:

```typescript
import { useThrottle }         from '../../../hooks/useThrottle'
import { CollaboratorCursors } from '../../collaboration/CollaboratorCursors'

// Props: add socket prop or get from context
// Assuming socket is passed from EditorPage via prop:
interface Props {
  // existing +
  cursors?: Map<string, any>
  onCursorMove?: (track: number, time: number) => void
}

// In handleMouseMove, after computing track+time:
const throttledCursorEmit = useThrottle(
  (track: number, time: number) => onCursorMove?.(track, time),
  66,
)

// Call inside handleMouseMove:
throttledCursorEmit(track, time)

// In the grid render, after GhostCircle:
{cursors && (
  <CollaboratorCursors
    cursors={cursors}
    gridWidth={gridWidth}
    pxPerSecond={pxPerSecond}
    scrollTop={scrollTop}
  />
)}
```

- [ ] **Step 4: Wire in EditorPage**

```tsx
const { presenceList, isConnected, cursors } = useSocket(songId!)

// Emit cursor via socket in EditorPage:
// Pass to PianoRoll:
<PianoRoll
  songId={songId!}
  canEdit={canEdit}
  mutedTracks={mutedTracks}
  onNoteSelected={setSelectedNote}
  cursors={cursors}
  onCursorMove={(track, time) => socket.emit('cursor-move', { songId, track, time })}
/>
```

Note: expose `socket` instance from `useSocket` hook return value.

- [ ] **Step 5: Verify**

Open two browser tabs on same song. Move mouse over grid in Tab 1. Tab 2 shows colored cursor with name + title.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/collaboration/ apps/web/src/features/editor/components/PianoRoll.tsx apps/web/src/hooks/useThrottle.ts
git commit -m "feat: live cursors — emit + render collaborator cursors on piano roll"
```

---

## Task 9: Presence Bar Enrichment

**Files:**
- Modify: `apps/web/src/features/collaboration/PresenceBar.tsx`
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`

- [ ] **Step 1: Return title/department in presence-list**

In `realtime.gateway.ts`, `handleJoinSong`, extend user query:

```typescript
const sessions = await this.prisma.editorSession.findMany({
  where:   { songId: data.songId },
  include: {
    user: { select: { id: true, name: true, avatarUrl: true, email: true, role: true, title: true, department: true } },
  },
})
const users = sessions.map(s => ({
  id:         s.user.id,
  name:       s.user.name,
  avatarUrl:  s.user.avatarUrl,
  email:      s.user.email,
  role:       s.user.role,
  title:      s.user.title,
  department: s.user.department,
}))
```

- [ ] **Step 2: Update PresenceBar tooltip**

In `PresenceBar.tsx`, find where tooltip/title is set on avatar:

```tsx
// If using Tooltip primitive:
<Tooltip
  content={
    <div>
      <p className="font-medium">{user.name}</p>
      {user.title && <p className="text-[10px] opacity-70">{user.title} · {user.department}</p>}
    </div>
  }
>
  <Avatar name={user.name} src={user.avatarUrl} size="xs" showOnline />
</Tooltip>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/collaboration/PresenceBar.tsx apps/api/src/modules/realtime/
git commit -m "feat: presence bar tooltip shows name + title + department"
```

---

## Task 10: TourOverlay Component

**Files:**
- Create: `apps/web/src/features/onboarding/TourOverlay.tsx`

- [ ] **Step 1: Create file**

```typescript
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui'

export interface TourStep {
  target:  string   // data-tour="target" attribute value
  message: string
  side?:   'top' | 'bottom' | 'left' | 'right'
}

interface Props {
  steps:      TourStep[]
  onComplete: () => void
  onSkip:     () => void
}

interface Rect { top: number; left: number; width: number; height: number }

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function TourOverlay({ steps, onComplete, onSkip }: Props) {
  const [step,    setStep]    = useState(0)
  const [rect,    setRect]    = useState<Rect | null>(null)

  const current = steps[step]

  useEffect(() => {
    const update = () => setRect(getTargetRect(current.target))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [current.target])

  const PADDING = 8

  function next() {
    if (step + 1 >= steps.length) onComplete()
    else setStep(s => s + 1)
  }

  function back() {
    if (step > 0) setStep(s => s - 1)
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={onSkip} />

      {/* Highlight cutout */}
      {rect && (
        <div
          className="absolute bg-transparent ring-2 ring-primary ring-offset-2 ring-offset-transparent rounded-lg pointer-events-none"
          style={{
            top:    rect.top    - PADDING,
            left:   rect.left   - PADDING,
            width:  rect.width  + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            zIndex: 51,
          }}
        />
      )}

      {/* Tooltip */}
      {rect && (
        <div
          className="absolute z-[52] bg-shell-surface border border-shell-border rounded-xl shadow-lg p-4 w-72 pointer-events-auto"
          style={{
            top:  rect.top + rect.height + PADDING + 8,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
          }}
        >
          <p className="text-sm text-shell-text mb-3">{current.message}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-shell-muted">{step + 1} / {steps.length}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onSkip}>Skip</Button>
              {step > 0 && <Button variant="secondary" size="sm" onClick={back}>Back</Button>}
              <Button variant="primary" size="sm" onClick={next}>
                {step + 1 >= steps.length ? 'Done' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/onboarding/TourOverlay.tsx
git commit -m "feat: TourOverlay component — spotlight + tooltip tour system"
```

---

## Task 11: App Tour Hook

**Files:**
- Create: `apps/web/src/features/onboarding/useAppTour.ts`

- [ ] **Step 1: Create file**

```typescript
import { useState, useCallback } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { apiClient }   from '../auth/api'
import type { TourStep } from './TourOverlay'
import type { AuthUser } from '@ama-midi/shared'

const APP_TOUR_STEPS: TourStep[] = [
  { target: 'piano-roll',    message: 'This is your piano roll. 8 tracks × 300 seconds of musical timeline.' },
  { target: 'fast-mode',     message: 'Fast mode: click to place a note instantly. Toggle to Popup for full control.' },
  { target: 'ai-suggest',    message: 'After placing 5+ notes, AI suggests what comes next based on your pattern.' },
  { target: 'view-mode',     message: 'Switch views: Composer (create), Developer (debug), QA (validate).' },
  { target: 'history-tab',   message: 'Every change is recorded here. Undo any action at any time.' },
  { target: 'shortcut-help', message: "Press ? anytime to see all keyboard shortcuts." },
]

export function useAppTour() {
  const { user, token, setAuth } = useAuthStore()
  const [active, setActive] = useState(false)

  const start = useCallback(() => setActive(true), [])

  const complete = useCallback(async () => {
    setActive(false)
    if (!token) return
    try {
      const updated = await apiClient(token)<AuthUser>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ tourComplete: true }),
      })
      setAuth(updated, token)
    } catch { /* non-critical */ }
  }, [token, setAuth])

  const skip = useCallback(() => setActive(false), [])

  // Auto-start if user hasn't completed tour
  const shouldAutoStart = user?.profileComplete && !user?.tourComplete

  return {
    active,
    steps: APP_TOUR_STEPS,
    start,
    complete,
    skip,
    shouldAutoStart,
  }
}
```

- [ ] **Step 2: Add data-tour attributes to key elements**

In `EditorPage.tsx` and `Toolbar.tsx`, add `data-tour` attributes:

```tsx
// Piano roll wrapper:
<div data-tour="piano-roll" className="flex-1 ...">

// Fast mode toggle button:
<button data-tour="fast-mode" ...>

// Suggest button in Toolbar:
<Button data-tour="ai-suggest" ...>

// View mode toggle group:
<div data-tour="view-mode">
  <ToggleGroup ...>

// History tab button:
<button data-tour="history-tab" ...>

// Shortcut help button:
<IconButton data-tour="shortcut-help" ...>
```

- [ ] **Step 3: Wire into SongListPage**

```tsx
import { useEffect } from 'react'
import { useAppTour } from '../features/onboarding/useAppTour'
import { TourOverlay } from '../features/onboarding/TourOverlay'

// In SongListPage:
const { active, steps, start, complete, skip, shouldAutoStart } = useAppTour()

useEffect(() => {
  if (shouldAutoStart) start()
}, [shouldAutoStart])

// In JSX:
{active && <TourOverlay steps={steps} onComplete={complete} onSkip={skip} />}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/onboarding/useAppTour.ts
git commit -m "feat: useAppTour — 6-step app tour, auto-starts after profile setup"
```

---

## Task 12: Song Tour Hook

**Files:**
- Create: `apps/web/src/features/onboarding/useSongTour.ts`
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Create file**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { TourStep } from './TourOverlay'

const SONG_TOUR_STEPS: TourStep[] = [
  { target: 'piano-roll',  message: 'Click anywhere on the grid to place a note at that position.' },
  { target: 'piano-roll',  message: 'Select a note then press E to edit its title, color, and description.' },
  { target: 'piano-roll',  message: 'Press Cmd+Z to undo your last action. It syncs to all collaborators.' },
]

const STORAGE_KEY = 'ama-song-tour-seen'

export function useSongTour() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      // Small delay so editor is fully rendered
      const id = setTimeout(() => setActive(true), 800)
      return () => clearTimeout(id)
    }
  }, [])

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setActive(false)
  }, [])

  const skip = complete  // skip = same as complete for song tour

  return { active, steps: SONG_TOUR_STEPS, complete, skip }
}
```

- [ ] **Step 2: Wire into EditorPage**

```tsx
import { useSongTour }  from '../features/onboarding/useSongTour'
import { TourOverlay }  from '../features/onboarding/TourOverlay'

// In EditorPage:
const { active: songTourActive, steps: songTourSteps, complete: completeSongTour, skip: skipSongTour } = useSongTour()

// In JSX:
{songTourActive && (
  <TourOverlay steps={songTourSteps} onComplete={completeSongTour} onSkip={skipSongTour} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/onboarding/ apps/web/src/pages/EditorPage.tsx
git commit -m "feat: song tour (3 steps, first song open, localStorage tracked)"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Verify DB migration applied**

```bash
cd apps/api && npx prisma studio
```

User model has: title, department, profileComplete, tourComplete.

- [ ] **Step 2: Manual checklist**

- [ ] New user → profile setup modal appears, cannot dismiss
- [ ] Profile saved → song list shown
- [ ] App tour auto-starts after first profile completion (6 steps)
- [ ] ? button re-triggers app tour
- [ ] First song open → 3-step song tour
- [ ] Second song open → no tour
- [ ] Move mouse in editor → other tab sees cursor with name + title
- [ ] Cursor fades after 3s of no movement
- [ ] Presence bar tooltip shows name + title + department
- [ ] Google avatar shown consistently in AppShell header + song cards

- [ ] **Step 3: Build check**

```bash
pnpm build
```

Expected: zero errors.

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: Phase 2 complete — user profile, live cursors, onboarding tours"
```
