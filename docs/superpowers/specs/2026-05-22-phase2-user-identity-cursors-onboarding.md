# Phase 2 — User Identity, Live Cursors + Onboarding

**Date:** 2026-05-22
**Scope:** 1 DB migration, new WebSocket events, new frontend flows.
**Goal:** Give every collaborator an identity. Show live cursors on the grid. Guide new users through the app.

---

## Problems Being Solved

| Problem | Fix |
|---|---|
| Users have no title/department — presence bar shows anonymous avatars | Profile setup flow post-login |
| Google avatar not consistently used | Sync `avatarUrl` from Google on every login |
| No live cursor tracking — can't see where collaborators are working | WebSocket `cursor-move` events + cursor overlay |
| No onboarding — new users have no guidance | App tour (first login) + song tip (first open) |

---

## DB Migration

```prisma
model User {
  // existing fields unchanged +
  title           String?
  department      String?
  profileComplete Boolean  @default(false)
  tourComplete    Boolean  @default(false)
}
```

Migration: `npx prisma migrate dev --name add_user_profile_fields`

All existing users get `profileComplete = false` → they see the profile modal on next login.

---

## Profile Setup Flow

### Trigger
```
Google OAuth callback
  → find/create user
  → check profileComplete
    false → return JWT + { needsProfile: true }
    true  → return JWT + { needsProfile: false }
```

Frontend `AuthCallbackPage`:
```
if (needsProfile) → navigate('/profile-setup')
else              → navigate('/')
```

### Profile Setup Page (`/profile-setup`)

Full-page modal (not dismissible). Fields:

| Field | Type | Source |
|---|---|---|
| Display Name | Text input | Pre-filled from Google `name`, editable |
| Avatar | Read-only preview | Synced from Google `avatarUrl`, not editable in V1 |
| Title | Text input | e.g. "Sound Designer", "Game Developer" |
| Department | Select dropdown | Core Music / Game Dev / QA / Product / Other |

On submit → `PATCH /users/me { name, title, department }` → sets `profileComplete = true` → redirect to `/`.

### API Endpoint

```
PATCH /users/me
Body: { name?, title?, department? }
Guard: JwtAuthGuard
Returns: updated AuthUser
```

New `UsersModule` with `UsersController` + `UsersService`. `AuthModule` already creates users — profile update is a separate concern.

### AuthUser type (shared)

```typescript
export interface AuthUser {
  id:       string
  email:    string
  name:     string
  avatarUrl?: string
  role:     UserRole
  // new:
  title?:       string
  department?:  string
  profileComplete: boolean
}
```

---

## Google Avatar Sync

On every Google OAuth login, update `avatarUrl` from Google profile:

```typescript
// auth.service.ts — findOrCreate user:
await prisma.user.upsert({
  where: { email },
  update: { avatarUrl: googleProfile.avatarUrl },  // always sync
  create: { ... }
})
```

This ensures avatar stays current if user updates their Google photo.

---

## Live Cursors on Piano Roll

### WebSocket Protocol

New event emitted by client:
```typescript
// client → server
socket.emit('cursor-move', { songId: string, track: number, time: number })
```

Server broadcasts to room (excluding sender):
```typescript
// server → room
socket.to(`song:${songId}`).emit('cursor-moved', {
  userId:   string,
  name:     string,
  title?:   string,
  track:    number,
  time:     number,
})
```

### Gateway Handler

```typescript
@SubscribeMessage('cursor-move')
handleCursorMove(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { songId: string; track: number; time: number },
) {
  if (!client.data.user) return
  client.to(`song:${data.songId}`).emit('cursor-moved', {
    userId: client.data.user.id,
    name:   client.data.user.name,
    title:  client.data.user.title,
    track:  data.track,
    time:   data.time,
  })
}
```

### Frontend — Cursor Emission

In `PianoRoll.tsx`, on `mousemove`:
```typescript
// Throttled to 66ms (~15fps)
const emitCursor = useThrottle((track: number, time: number) => {
  socket.emit('cursor-move', { songId, track, time })
}, 66)

// In handleMouseMove:
emitCursor(track, time)
```

Stop emitting when mouse leaves grid.

### Frontend — Cursor Rendering

`useSocket` hook maintains `cursors: Map<userId, { name, title, track, time, lastSeen }>`.

On `cursor-moved` event → update map. Cursors not updated for 3s → fade out.

`CollaboratorCursors` component rendered inside PianoRoll grid (absolute positioned):

```typescript
// For each cursor in map:
<div
  className="absolute pointer-events-none z-20 flex items-center gap-1 animate-in fade-in"
  style={{
    left: trackToX(cursor.track, gridWidth) + trackWidth(gridWidth) / 2 - 6,
    top:  timeToY(cursor.time, pxPerSecond) - scrollTop - 6,
  }}
>
  <div
    className="w-3 h-3 rounded-full border-2 border-white"
    style={{ backgroundColor: getColorFromName(cursor.userId) }}
  />
  <span className="text-[10px] text-white bg-black/60 px-1 rounded whitespace-nowrap">
    {cursor.name}{cursor.title ? ` · ${cursor.title}` : ''}
  </span>
</div>
```

### Cursor Fade

```typescript
// In useSocket — tick every second:
useEffect(() => {
  const id = setInterval(() => {
    const now = Date.now()
    setCursors(prev => {
      const next = new Map(prev)
      next.forEach((cursor, userId) => {
        if (now - cursor.lastSeen > 3000) next.delete(userId)
      })
      return next
    })
  }, 1000)
  return () => clearInterval(id)
}, [])
```

---

## Presence Bar Enrichment

`PresenceBar` avatar tooltip updated:

```
HH  Hồ Hoàng Huy
    Sound Designer · Core Music
```

`useSocket` returns enriched `presenceList` with `title` and `department`. Server sends these in `presence-list` and `user-joined` events (pull from DB on join).

---

## Onboarding Tour

### Library
Custom lightweight implementation — no external dependency (avoids bundle bloat). Uses a `TourOverlay` component with a highlight mask + tooltip.

### App Tour — triggers once after first profile setup

6 steps, each highlights a DOM element by `data-tour` attribute:

| Step | Target | Message |
|---|---|---|
| 1 | Piano Roll grid | "This is your piano roll. 8 tracks × 300 seconds." |
| 2 | Fast/Popup toggle | "Fast mode: click to place instantly. Popup mode: fill in details first." |
| 3 | ✨ Suggest button | "After 5 notes, AI suggests what comes next." |
| 4 | View mode switcher | "Switch between Composer, Developer, and QA views." |
| 5 | History tab | "Every change is recorded here. Undo at any time." |
| 6 | ? button | "Press ? anytime to see keyboard shortcuts." |

On complete → `PATCH /users/me { tourComplete: true }`.

### Song Tour — triggers first time any song is opened

3 steps:

| Step | Target | Message |
|---|---|---|
| 1 | Grid center | "Click anywhere on the grid to place a note." |
| 2 | Any note (if exists) | "Select a note and press E to edit it." |
| 3 | Undo button area | "Press Cmd+Z to undo your last action." |

Tracked in `localStorage('ama-song-tour-seen')` (not DB — per browser).

### Tour Controls
- Skip button on every step
- Next / Back navigation
- Step counter (1 of 6)
- ? button in toolbar re-triggers app tour at step 1

### TourOverlay Component

```typescript
interface TourStep {
  target:  string  // data-tour attribute value
  message: string
  side?:   'top' | 'bottom' | 'left' | 'right'
}

interface TourOverlayProps {
  steps:    TourStep[]
  onComplete: () => void
  onSkip:   () => void
}
```

Renders:
1. Semi-transparent backdrop covering entire screen
2. Cutout/highlight around target element (using `getBoundingClientRect`)
3. Tooltip with message + Next/Back/Skip buttons

---

## New Files

```
apps/api/src/modules/users/users.module.ts
apps/api/src/modules/users/users.controller.ts
apps/api/src/modules/users/users.service.ts
apps/web/src/pages/ProfileSetupPage.tsx
apps/web/src/features/collaboration/CollaboratorCursors.tsx
apps/web/src/features/onboarding/TourOverlay.tsx
apps/web/src/features/onboarding/useAppTour.ts
apps/web/src/features/onboarding/useSongTour.ts
apps/web/src/hooks/useThrottle.ts
```

---

## Modified Files

```
apps/api/src/modules/auth/auth.service.ts    — always sync avatarUrl on login
apps/api/src/modules/auth/auth.controller.ts — return needsProfile in callback
apps/api/src/modules/realtime/realtime.gateway.ts — add cursor-move handler
apps/api/src/app.module.ts                   — register UsersModule
apps/api/prisma/schema.prisma                — title, department, profileComplete, tourComplete
packages/shared/src/types.ts                 — extend AuthUser
apps/web/src/App.tsx                         — add /profile-setup route
apps/web/src/pages/AuthCallbackPage.tsx      — redirect on needsProfile
apps/web/src/features/collaboration/useSocket.ts — cursor-moved handler + presence enrichment
apps/web/src/features/editor/components/PianoRoll.tsx — cursor emission + CollaboratorCursors
apps/web/src/pages/EditorPage.tsx            — useSongTour
```

---

## Acceptance Criteria

- [ ] New user logs in → redirected to `/profile-setup` before song list
- [ ] Profile setup modal not dismissible — must complete
- [ ] Title + department saved, reflected in `GET /auth/me`
- [ ] Google avatarUrl updated on every login
- [ ] Avatar shows on song list (AppShell header) and song cards
- [ ] Move mouse over grid → other tabs see cursor move in real time
- [ ] Cursor shows name + title chip
- [ ] Cursor fades after 3s of no movement
- [ ] Presence bar avatar tooltip shows name + title + department
- [ ] App tour shows after first profile completion (6 steps)
- [ ] Song tour shows first time opening a song (3 steps)
- [ ] ? button re-triggers app tour
- [ ] `tourComplete = true` set after app tour finishes
