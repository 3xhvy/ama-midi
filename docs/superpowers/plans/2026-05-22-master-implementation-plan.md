# AMA-MIDI — Master Implementation Plan

**Source of truth for AI-assisted implementation. Execute blocks in order. Do not skip.**

**Date:** 2026-05-22  
**Target:** 2026-05-24 (3 days)  
**Linear project:** OHOMI / AMA-MIDI  
**Spec:** `docs/superpowers/specs/2026-05-22-architecture-design.md`

---

## Status Legend

- `✅ DONE` — already in repo
- `⬜ TODO` — not started
- `🔗 DEPENDS ON` — must not start until dependency is complete

---

## Pre-Day — DONE ✅

All four Pre-Day issues are complete and committed.

| Issue | Title | Status |
|---|---|---|
| OHO-207 | Turborepo monorepo structure | ✅ DONE |
| OHO-208 | Docker Compose (postgres + redis + api + web) | ✅ DONE |
| OHO-209 | .env.example with all required variables | ✅ DONE |
| OHO-227 | CSS design system + globals.css + Tailwind config + packages/shared types | ✅ DONE |

**Verify before starting Day 1:**
```bash
pnpm install                    # no errors
cd apps/api && pnpm start:dev  # NestJS starts on :3001
cd apps/web && pnpm dev        # React starts on :3000
curl localhost:3001/health     # returns { status: 'ok' }
```

---

## Day 1 — Foundation + Core Editor

**Goal:** One user can log in, create a song, open the piano roll, place and delete notes. Data persists in PostgreSQL.

**Architectural rule for Day 1:** Every new NestJS module must follow the structure:
```
modules/<name>/
├── <name>.module.ts
├── <name>.controller.ts
├── <name>.service.ts        ← commands only (writes)
├── <name>.query.service.ts  ← reads only (NoteModule only)
├── dto/
└── __tests__/
```

---

### Block 1 — Prisma Schema (OHO-210)

**🔗 Depends on:** Pre-Day  
**Must complete before:** Every other backend block

#### What to build

Install Prisma and define the full schema. This is the most important block — every architectural decision in the project stems from it.

```bash
pnpm --filter @ama-midi/api add @prisma/client prisma
cd apps/api && npx prisma init
```

#### Schema (`apps/api/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  COMPOSER
  VIEWER
}

enum NoteEventType {
  NOTE_CREATED
  NOTE_UPDATED
  NOTE_DELETED
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  avatarUrl String?
  role      Role     @default(COMPOSER)
  createdAt DateTime @default(now())

  songs      Song[]
  notes      Note[]
  noteEvents NoteEvent[]
  sessions   EditorSession[]
  versions   SongVersion[]
}

model Song {
  id        String   @id @default(uuid())
  name      String
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  creator    User          @relation(fields: [createdBy], references: [id])
  notes      Note[]
  noteEvents NoteEvent[]
  sessions   EditorSession[]
  versions   SongVersion[]
}

model Note {
  id          String    @id @default(uuid())
  songId      String
  track       Int
  time        Float
  title       String
  description String    @default("")
  color       String    @default("#6C63FF")
  createdBy   String
  version     Int       @default(1)
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  song    Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  creator User @relation(fields: [createdBy], references: [id])

  @@unique([songId, track, time])
}

model NoteEvent {
  id          String        @id @default(uuid())
  songId      String
  noteId      String?
  eventType   NoteEventType
  userId      String
  beforeState Json?
  afterState  Json?
  createdAt   DateTime      @default(now())

  song Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])
}

model EditorSession {
  id         String   @id @default(uuid())
  songId     String
  userId     String
  joinedAt   DateTime @default(now())
  lastSeenAt DateTime @default(now()) @updatedAt

  song Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([songId, userId])
}

model SongVersion {
  id           String   @id @default(uuid())
  songId       String
  name         String
  snapshotData Json
  createdBy    String
  createdAt    DateTime @default(now())

  song    Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  creator User @relation(fields: [createdBy], references: [id])
}

model OutboxEvent {
  id          String    @id @default(uuid())
  eventType   String
  aggregateId String
  payload     Json
  status      String    @default("pending")
  retryCount  Int       @default(0)
  createdAt   DateTime  @default(now())
  processedAt DateTime?
}
```

#### PrismaService (`apps/api/src/database/prisma.service.ts`)

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect()
  }
}
```

#### Migration

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
```

#### Acceptance criteria

- [ ] `npx prisma migrate dev --name init` runs without errors
- [ ] `\d notes` in psql shows `UNIQUE (song_id, track, time)`
- [ ] Manually insert two notes with same (song_id, track, time) → DB rejects second
- [ ] `OutboxEvent` table exists (prepared, not used)
- [ ] `SongVersion`, `EditorSession` tables exist

---

### Block 2 — Internal EventEmitter (OHO-246)

**🔗 Depends on:** Block 1  
**Must complete before:** Block 4 (NoteModule) — CRITICAL

#### What to build

Wire the domain event bus before writing NoteModule. This cannot be retrofitted.

```bash
pnpm --filter @ama-midi/api add @nestjs/event-emitter eventemitter2
```

#### Domain events (`packages/shared/src/events.ts`)

```typescript
import type { Note } from './types'

export const NOTE_EVENTS = {
  CREATED: 'note.created',
  UPDATED: 'note.updated',
  DELETED: 'note.deleted',
} as const

export interface NoteCreatedEvent {
  songId:     string
  noteId:     string
  userId:     string
  afterState: Note
}

export interface NoteUpdatedEvent {
  songId:      string
  noteId:      string
  userId:      string
  beforeState: Partial<Note>
  afterState:  Partial<Note>
}

export interface NoteDeletedEvent {
  songId:      string
  noteId:      string
  userId:      string
  beforeState: Note
}
```

Export from `packages/shared/src/index.ts`.

#### Register in AppModule

```typescript
import { EventEmitterModule } from '@nestjs/event-emitter'

@Module({
  imports: [EventEmitterModule.forRoot()],
})
export class AppModule {}
```

#### Acceptance criteria

- [ ] `NOTE_EVENTS`, `NoteCreatedEvent`, `NoteUpdatedEvent`, `NoteDeletedEvent` importable from `@ama-midi/shared`
- [ ] `EventEmitterModule.forRoot()` registered in AppModule
- [ ] `pnpm --filter @ama-midi/api build` passes with no TypeScript errors

---

### Block 3 — AuthModule (OHO-212)

**🔗 Depends on:** Block 1, Block 2

#### What to build

```bash
pnpm --filter @ama-midi/api add @nestjs/passport @nestjs/jwt passport passport-google-oauth20 passport-jwt
pnpm --filter @ama-midi/api add -D @types/passport-google-oauth20 @types/passport-jwt
```

**Endpoints:**
- `GET /auth/google` — redirect to Google OAuth
- `GET /auth/google/callback` — exchange code for JWT, create/find user
- `GET /auth/me` — returns current user (requires JWT)

**Guards to implement:**
- `JwtAuthGuard` — applies to all protected routes
- `RolesGuard` — checks `@Roles('COMPOSER')` etc.

**JWT payload:**
```typescript
interface JwtPayload {
  sub: string      // user.id
  email: string
  role: Role
}
```

**User creation:** On first Google login, create user with `role: COMPOSER`. Email is unique key.

#### Acceptance criteria

- [ ] `GET /auth/google` redirects to Google consent screen
- [ ] After Google login, JWT is returned as `{ accessToken: string }`
- [ ] `GET /auth/me` with valid JWT returns `{ id, email, name, avatarUrl, role }`
- [ ] `GET /auth/me` without JWT returns 401
- [ ] `@Roles('COMPOSER')` on endpoint blocks VIEWER with 403

---

### Block 4 — SongModule (OHO-213)

**🔗 Depends on:** Block 3

#### What to build

**Endpoints:**
- `GET /songs` — list all songs with `noteCount`, `creatorName`, `updatedAt`
- `POST /songs` — create song `{ name }`, returns created song
- `GET /songs/:id` — song detail
- `PATCH /songs/:id` — rename (creator or ADMIN only)
- `DELETE /songs/:id` — soft delete (ADMIN only)

All endpoints: `@UseGuards(JwtAuthGuard)`.

#### Acceptance criteria

- [ ] `POST /songs` with JWT creates song and returns it
- [ ] `GET /songs` returns list including new song with `noteCount`
- [ ] `DELETE /songs/:id` without JWT returns 401
- [ ] Only creator or ADMIN can delete — COMPOSER who is not creator gets 403

---

### Block 5 — EventEmitter + NoteModule + NoteQueryService (OHO-246 + OHO-214 + OHO-247)

**🔗 Depends on:** Block 2 (EventEmitter), Block 4 (SongModule)  
**Build all three together in one PR**

#### What to build

Three files working in concert: `NoteService` (writes), `NoteQueryService` (reads), and `LedgerListener` (reacts to events).

##### NoteService (commands only)

```typescript
@Injectable()
export class NoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(songId: string, dto: CreateNoteDto, userId: string): Promise<Note> {
    // Round time to 0.1s before insert
    const time = Math.round(dto.time * 10) / 10

    let note: Note
    try {
      note = await this.prisma.note.create({
        data: { songId, ...dto, time, createdBy: userId },
        include: { creator: true },
      })
    } catch (e) {
      if (e.code === 'P2002') throw new ConflictException('POSITION_TAKEN')
      throw e
    }

    this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
      songId, noteId: note.id, userId, afterState: note,
    } satisfies NoteCreatedEvent)

    return note
  }

  async update(noteId: string, dto: UpdateNoteDto, userId: string): Promise<Note> {
    const before = await this.prisma.note.findUniqueOrThrow({ where: { id: noteId } })
    const after  = await this.prisma.note.update({ where: { id: noteId }, data: dto })

    this.eventEmitter.emit(NOTE_EVENTS.UPDATED, {
      songId: after.songId, noteId, userId,
      beforeState: before, afterState: after,
    } satisfies NoteUpdatedEvent)

    return after
  }

  async delete(noteId: string, userId: string): Promise<void> {
    const note = await this.prisma.note.findUniqueOrThrow({ where: { id: noteId } })
    await this.prisma.note.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    })

    this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
      songId: note.songId, noteId, userId, beforeState: note,
    } satisfies NoteDeletedEvent)
  }
}
```

##### NoteQueryService (reads only)

```typescript
@Injectable()
export class NoteQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getVisibleNotes(songId: string, timeFrom = 0, timeTo = 300): Promise<Note[]> {
    return this.prisma.note.findMany({
      where: { songId, time: { gte: timeFrom, lte: timeTo }, deletedAt: null },
      orderBy: { time: 'asc' },
      include: { creator: { select: { id: true, name: true, avatarUrl: true } } },
    })
  }

  async getTrackDensity(songId: string): Promise<Record<number, number>> {
    const rows = await this.prisma.note.groupBy({
      by: ['track'],
      where: { songId, deletedAt: null },
      _count: true,
    })
    return Object.fromEntries(rows.map(r => [r.track, r._count]))
  }
}
```

##### LedgerListener (in LedgerModule, listens to events)

```typescript
@Injectable()
export class LedgerListener {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(NOTE_EVENTS.CREATED)
  async onNoteCreated({ songId, noteId, userId, afterState }: NoteCreatedEvent) {
    await this.prisma.noteEvent.create({
      data: { songId, noteId, eventType: 'NOTE_CREATED', userId, afterState },
    })
  }

  @OnEvent(NOTE_EVENTS.UPDATED)
  async onNoteUpdated({ songId, noteId, userId, beforeState, afterState }: NoteUpdatedEvent) {
    await this.prisma.noteEvent.create({
      data: { songId, noteId, eventType: 'NOTE_UPDATED', userId, beforeState, afterState },
    })
  }

  @OnEvent(NOTE_EVENTS.DELETED)
  async onNoteDeleted({ songId, noteId, userId, beforeState }: NoteDeletedEvent) {
    await this.prisma.noteEvent.create({
      data: { songId, noteId, eventType: 'NOTE_DELETED', userId, beforeState },
    })
  }
}
```

**Endpoints:**
- `GET /songs/:songId/notes?timeFrom=0&timeTo=300` — NoteQueryService
- `POST /songs/:songId/notes` — NoteService.create, body: `{ track, time, title, description?, color? }`
- `PATCH /notes/:id` — NoteService.update (title, description, color only — not track/time)
- `DELETE /notes/:id` — NoteService.delete (soft delete via deletedAt)

**DTO validation:**
```typescript
export class CreateNoteDto {
  @IsString() @IsNotEmpty() title: string
  @IsOptional() @IsString() description?: string
  @IsInt() @Min(1) @Max(8) track: number
  @IsNumber() @Min(0) @Max(300) time: number
  @IsOptional() @IsHexColor() color?: string
}
```

#### Acceptance criteria

- [ ] `POST /notes` with valid body → 201, note in DB, NoteEvent row written
- [ ] `POST /notes` duplicate position → 409 `{ error: 'POSITION_TAKEN' }`
- [ ] `POST /notes` time=301 → 400 validation error
- [ ] `POST /notes` track=9 → 400 validation error
- [ ] `GET /notes?timeFrom=50&timeTo=100` → only notes in that range
- [ ] `DELETE /notes/:id` → sets `deletedAt`, note excluded from future queries
- [ ] NoteService has ZERO imports from LedgerModule or RealtimeModule
- [ ] NoteService has ZERO read methods — only create, update, delete
- [ ] NoteQueryService has ZERO write methods

---

### Block 6 — App Shell Layout (OHO-228)

**🔗 Depends on:** Pre-Day (design system)

#### What to build

5-zone shell before any feature components.

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (64px)                                           │
├──────────────┬──────────────────────────┬───────────────┤
│ LeftPanel    │ Timeline Editor (flex 1) │ RightPanel    │
│ (240px)      │                          │ (280px)       │
├──────────────┴──────────────────────────┴───────────────┤
│ BottomBar (48px)                                        │
└─────────────────────────────────────────────────────────┘
```

**Components to create:**
- `TopBar` — song name (editable), presence avatars placeholder, view mode switcher chips (Composer/Developer/QA), Help button
- `LeftPanel` — Layer toggles section, placeholder content
- `RightPanel` — 3 tabs: Details / Comments / Validation (stubs)
- `BottomBar` — time display (MM:SS.s), zoom buttons (1x/2x/4x), validation badge

**Routes:**
- `/` → SongListPage
- `/songs/:id` → EditorPage (with shell)

Install: `react-router-dom`, `zustand`, `@tanstack/react-query`, `axios`

**Zustand stores to create now:**
```typescript
// store/editor.store.ts
interface EditorStore {
  viewMode: 'composer' | 'developer' | 'qa'
  zoom: 1 | 2 | 4           // pxPerSecond = 3 * zoom
  setViewMode: (mode: ViewMode) => void
  setZoom: (zoom: 1 | 2 | 4) => void
}

// store/auth.store.ts
interface AuthStore {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
}
```

#### Acceptance criteria

- [ ] Editor page renders 5 zones with correct dimensions
- [ ] View mode switcher updates Zustand store and adds CSS class to shell
- [ ] Zoom buttons update Zustand store
- [ ] Routes work: `/` → song list, `/songs/:id` → editor

---

### Block 7 — SongListPage + SongCard (OHO-229)

**🔗 Depends on:** Block 6 (routes), Block 4 (SongModule API)

#### What to build

Song list at `/` route. Uses TanStack Query.

**SongCard** (per Design System spec §3.10):
- White card, rounded-xl, shadow-sm, hover: shadow-md + lift
- Top: song name, status badge (Draft)
- Middle: 8-dot track activity visual (density from `GET /songs/:id/track-density`)
- Bottom: creator name, last modified
- Hover actions: [Open Editor] button

**SongListPage:**
- Page title "My Songs"
- [+ New Song] button → modal with name input → `POST /songs` → navigate to editor
- Empty state: "No songs yet — create your first one"
- Loading skeleton: 3 placeholder cards

**API client setup (`apps/web/src/lib/api.ts`):**
```typescript
import axios from 'axios'
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001' })
// attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export default api
```

#### Acceptance criteria

- [ ] Songs list loads from API with TanStack Query
- [ ] New song modal opens, submits, navigates to editor
- [ ] SongCard shows track activity dots (proportional to note count per track)
- [ ] Empty state shows when no songs

---

### Block 8 — Editor Engine Layer (OHO-248)

**🔗 Depends on:** Pre-Day (shared constants)  
**Must complete before:** Block 9 (PianoRoll) — CRITICAL

#### What to build

Pure TypeScript functions. Zero React imports. Fully testable.

**Files:**
```
apps/web/src/features/editor/engine/
├── coordinate-mapper.ts
├── viewport-calculator.ts
├── grid-geometry.ts
├── note-positioner.ts
├── index.ts
└── __tests__/
    └── coordinate-mapper.test.ts
```

**coordinate-mapper.ts:**
```typescript
import { TRACK_MIN, TRACK_MAX, SNAP_RESOLUTION } from '@ama-midi/shared'

export function xToTrack(x: number, gridWidth: number): number {
  const colW = gridWidth / (TRACK_MAX - TRACK_MIN + 1)
  return Math.min(TRACK_MAX, Math.max(TRACK_MIN, Math.floor(x / colW) + 1))
}

export function yToTime(y: number, pxPerSecond: number): number {
  const raw = y / pxPerSecond
  return Math.round(raw / SNAP_RESOLUTION) * SNAP_RESOLUTION
}

export function trackToX(track: number, gridWidth: number): number {
  const colW = gridWidth / (TRACK_MAX - TRACK_MIN + 1)
  return (track - 1) * colW + colW / 2
}

export function timeToY(time: number, pxPerSecond: number): number {
  return time * pxPerSecond
}
```

**viewport-calculator.ts:**
```typescript
import { TIME_MIN, TIME_MAX } from '@ama-midi/shared'

export function getVisibleTimeRange(scrollTop: number, viewportHeight: number, pxPerSecond: number) {
  return {
    timeFrom: Math.max(TIME_MIN, scrollTop / pxPerSecond),
    timeTo:   Math.min(TIME_MAX, (scrollTop + viewportHeight) / pxPerSecond),
  }
}

export function getPrefetchTimeRange(scrollTop: number, viewportHeight: number, pxPerSecond: number) {
  return {
    timeFrom: Math.max(TIME_MIN, (scrollTop - viewportHeight) / pxPerSecond),
    timeTo:   Math.min(TIME_MAX, (scrollTop + viewportHeight * 2) / pxPerSecond),
  }
}

export function getTotalHeight(pxPerSecond: number): number {
  return TIME_MAX * pxPerSecond
}
```

**grid-geometry.ts:**
```typescript
export function getColumnWidth(gridWidth: number): number {
  return gridWidth / (TRACK_MAX - TRACK_MIN + 1)
}

export function getTimeMarkers(timeFrom: number, timeTo: number, pxPerSecond: number) {
  const markers = []
  for (let t = Math.ceil(timeFrom); t <= Math.floor(timeTo); t++) {
    markers.push({ time: t, y: timeToY(t, pxPerSecond), isBold: t % 10 === 0 })
  }
  return markers
}
```

#### Acceptance criteria

- [ ] Unit tests pass: `xToTrack(trackToX(track, 800), 800) === track` for all 1–8
- [ ] `yToTime(105, 100)` returns `1.1` (0.1s snap)
- [ ] `getVisibleTimeRange(300, 600, 6)` returns `{ timeFrom: 50, timeTo: 150 }`
- [ ] Zero React imports in any engine file
- [ ] All functions exported from `engine/index.ts`

---

### Block 9 — Piano Roll Frontend (OHO-215)

**🔗 Depends on:** Block 8 (engine layer), Block 5 (NoteModule API), Block 6 (EditorStore)

#### What to build

Install: `@tanstack/virtual`, `@tanstack/react-query`, `sonner`

**useNotes hook** — fetches visible notes, updates on WebSocket events:
```typescript
function useNotes(songId: string) {
  const { zoom } = useEditorStore()
  const pxPerSecond = 3 * zoom
  const [scrollTop, setScrollTop] = useState(0)
  const viewportHeight = window.innerHeight - 64 - 48  // minus TopBar and BottomBar

  const { timeFrom, timeTo } = getVisibleTimeRange(scrollTop, viewportHeight, pxPerSecond)

  const { data: notes } = useQuery({
    queryKey: ['notes', songId, timeFrom, timeTo],
    queryFn: () => api.get(`/songs/${songId}/notes?timeFrom=${timeFrom}&timeTo=${timeTo}`).then(r => r.data),
  })

  return { notes, setScrollTop }
}
```

**PianoRoll component:**
- Dark surface (`bg-editor-bg`)
- 8-column header (track labels)
- Scrollable vertical timeline using `@tanstack/virtual`
- Notes as 16px circles at `(trackToX(track, gridWidth), timeToY(time, pxPerSecond))`
- Time marker lines at every 1s (thin) and 10s (bold)

**Fast Mode (default) — click to create:**
1. On grid click → calculate `track = xToTrack(x, gridWidth)`, `time = yToTime(y, pxPerSecond)`
2. Show ghost circle immediately (optimistic)
3. `POST /songs/:songId/notes { track, time, title: 'Note', color: '#6C63FF' }`
4. On success: replace ghost with server note
5. On 409: remove ghost, show toast "This position was just taken — try a nearby spot"
6. On other error: remove ghost, show generic error toast

**Note selection and delete:**
- Click on note circle → select (white ring)
- Backspace/Delete key → `DELETE /notes/:id`, optimistic remove, restore on error

**Note hover tooltip:**
- Show card (white bg, shadow-md, rounded-lg): title, time formatted as `01:42.5`, creator name

#### Acceptance criteria

- [ ] Grid renders with 8 columns and time markers
- [ ] Notes render as circles at correct positions
- [ ] DOM node count stays < 100 with 500+ notes (verify in DevTools Elements)
- [ ] Click creates note instantly (ghost appears before API response)
- [ ] Duplicate position shows conflict toast
- [ ] Delete with Backspace removes selected note
- [ ] PianoRoll calls engine functions — no inline coordinate math

---

### Block 10 — Note Popup Mode (OHO-216)

**🔗 Depends on:** Block 9 (PianoRoll)

#### What to build

Toggle in toolbar: Fast Mode ↔ Popup Mode.

**Popup Mode behavior:**
- Click grid → opens NotePopup modal (instead of instant create)
- Form fields: Title (required), Description (optional), Color picker (8 swatches from NOTE_PRESET_COLORS), Track (1–8 button row), Time (number input, 0.1 step)
- Track + Time pre-filled from click position
- [Cancel] secondary button, [Place Note] primary button
- Submit → `POST /songs/:songId/notes`

**Edit popup:**
- Press E with note selected → opens same popup pre-filled for `PATCH /notes/:id`
- Color and description are editable; track and time are NOT (position is immutable)

**Design:** Per Design System spec §3.7 — 400px wide, rounded-xl, shadow-lg, purple backdrop

#### Acceptance criteria

- [ ] Mode toggle in toolbar switches behavior
- [ ] Popup pre-fills track and time from click position
- [ ] Submit creates note, popup closes
- [ ] E key on selected note opens edit popup with existing values
- [ ] Track and time fields disabled in edit mode

---

## Day 2 — Real-time Collaboration + Ledger + Security

**Goal:** Multiple browser tabs editing the same song stay in sync. Every change is recorded. Auth is production-grade.

---

### Block 11 — WebSocket Gateway (OHO-217)

**🔗 Depends on:** Block 5 (NoteModule with EventEmitter), Block 3 (AuthModule for JWT)

#### What to build

```bash
pnpm --filter @ama-midi/api add @nestjs/websockets @nestjs/platform-socket.io socket.io @socket.io/redis-adapter ioredis
```

**RealtimeGateway:**
- `@WebSocketGateway({ cors: { origin: FRONTEND_URL } })`
- JWT auth in handshake: extract token from `socket.handshake.auth.token`, verify with JwtService, attach user to socket
- Handle `join-song` event: `socket.join('song:${songId}')`, update EditorSession in DB, emit `user-joined` to room
- Handle `leave-song` event: `socket.leave()`, delete EditorSession, emit `user-left` to room
- On disconnect: same as leave-song

**RealtimeListener** (in RealtimeModule, `@OnEvent` consumers):
```typescript
@OnEvent(NOTE_EVENTS.CREATED)
onNoteCreated({ songId, afterState }: NoteCreatedEvent) {
  this.server.to(`song:${songId}`).emit('note-created', afterState)
}
// same for UPDATED, DELETED
```

**Redis adapter:**
```typescript
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'ioredis'

const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()
this.server.adapter(createAdapter(pubClient, subClient))
```

**Frontend useSocket hook:**
```typescript
function useSocket(songId: string) {
  const [presenceList, setPresenceList] = useState<AuthUser[]>([])
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = io(WS_URL, { auth: { token: localStorage.getItem('accessToken') } })
    socket.emit('join-song', { songId })

    socket.on('note-created', (note) => {
      queryClient.setQueryData(['notes', songId], (old) => [...(old ?? []), note])
    })
    socket.on('note-updated', (note) => {
      queryClient.setQueryData(['notes', songId], (old) =>
        (old ?? []).map(n => n.id === note.id ? note : n))
    })
    socket.on('note-deleted', ({ noteId }) => {
      queryClient.setQueryData(['notes', songId], (old) =>
        (old ?? []).filter(n => n.id !== noteId))
    })
    socket.on('user-joined', (user) => setPresenceList(prev => [...prev, user]))
    socket.on('user-left', ({ userId }) => setPresenceList(prev => prev.filter(u => u.id !== userId)))

    return () => { socket.emit('leave-song', { songId }); socket.disconnect() }
  }, [songId])

  return { presenceList }
}
```

**PresenceBar component** (Design System spec §3.5):
- Up to 5 overlapping 32px avatar circles
- "+N" pill if more
- Tooltip: user name

#### Acceptance criteria

- [ ] Open two browser tabs on same song → create note in Tab 1 → appears in Tab 2 without refresh
- [ ] Close Tab 1 → user-left fires in Tab 2
- [ ] TanStack Query cache updated on WebSocket event (no extra GET call)
- [ ] Unauthenticated WebSocket connection rejected
- [ ] PresenceBar shows active users

---

### Block 12 — Conflict UX (OHO-218)

**🔗 Depends on:** Block 11 (WebSocket), Block 9 (PianoRoll)

#### What to build

```bash
pnpm --filter @ama-midi/web add sonner
```

Wrap app in `<Toaster />`. Use `toast()` everywhere.

**Toast messages** (use EXACTLY these strings):

| Trigger | Message |
|---|---|
| 409 on note create | "This position was just taken — try a nearby spot" |
| WebSocket disconnect | "Connection lost — reconnecting..." |
| WebSocket reconnect | "Back online — syncing changes" |
| Note deleted by collaborator while selected | "This note was removed by a collaborator" |
| Rate limit 429 | "You're placing notes too fast — slow down a little" |

#### Acceptance criteria

- [ ] All 5 toast messages appear with correct text
- [ ] Conflict (409) removes ghost note AND shows toast
- [ ] Disconnect/reconnect toasts fire reliably

---

### Block 13 — History Panel + Ledger + Undo (OHO-219)

**🔗 Depends on:** Block 5 (NoteModule + LedgerListener), Block 11 (WebSocket for undo broadcast)

#### What to build

**Backend endpoints:**
- `GET /songs/:songId/events` — paginated (limit 50, cursor), newest first
  ```typescript
  // Returns
  { events: NoteEvent[], nextCursor: string | null }
  ```
- `POST /songs/:songId/events/undo` — compensating event
  ```typescript
  // Logic:
  // 1. Find last NOTE_CREATED event by current user for this song
  // 2. If not found: return 404 "Nothing to undo"
  // 3. If note already deleted: return 200 { alreadyDeleted: true }
  // 4. Soft-delete the note
  // 5. Emit NOTE_DELETED event (LedgerListener writes, RealtimeListener broadcasts)
  ```

**Frontend HistoryPanel** (Design System spec §3.9):
- Slide-in from right, 320px, `animation: slide-in-right`
- Toggle via toolbar icon
- Infinite scroll with TanStack Query `useInfiniteQuery`
- Each row: avatar, human-language action, relative time ("2 minutes ago")
- Human language mapping:
  - `NOTE_CREATED` → "{name} added a note at Track {track}, {time}s"
  - `NOTE_UPDATED` → "{name} edited the note at Track {track}, {time}s"
  - `NOTE_DELETED` → "{name} removed the note at Track {track}, {time}s"
- Undo button at top → calls `POST /songs/:songId/events/undo`

#### Acceptance criteria

- [ ] Create 3 notes → history panel shows all 3 events in order
- [ ] Click Undo → last note disappears from grid AND from second tab (WebSocket broadcast)
- [ ] History panel shows the undo event (NOTE_DELETED)
- [ ] Undo when nothing to undo → friendly message, no crash

---

### Block 14 — Test Suite (OHO-230)

**🔗 Depends on:** Block 5 (NoteModule), Block 3 (AuthModule)

#### What to build

```bash
pnpm --filter @ama-midi/api add -D jest @types/jest ts-jest supertest @types/supertest
```

**Unit tests (`note.service.spec.ts`):**
```typescript
describe('NoteService', () => {
  it('rounds time to 1 decimal place before insert')
  it('rejects time < 0 with 400')
  it('rejects time > 300 with 400')
  it('rejects track < 1 with 400')
  it('rejects track > 8 with 400')
  it('returns 409 on duplicate position (P2002)')
  it('emits note.created event on successful create')
  it('emits note.deleted event with beforeState on delete')
  it('undo finds and deletes last NOTE_CREATED by current user')
})
```

**Integration tests (real test DB):**
```typescript
// Use DATABASE_URL=...ama_midi_test for test DB
describe('POST /songs/:songId/notes', () => {
  it('creates note → 201')
  it('duplicate position → 409 (not 500)')
  it('time=301 → 400')
  it('track=9 → 400')
  it('no JWT → 401')
  it('writes NoteEvent in same transaction')
})
```

**Concurrent conflict test (critical):**
```typescript
it('two simultaneous requests for same position — only one succeeds', async () => {
  const payload = { track: 1, time: 5.0, title: 'Test' }
  const [res1, res2] = await Promise.all([
    request(app).post(`/songs/${songId}/notes`).send(payload).set('Authorization', `Bearer ${jwt}`),
    request(app).post(`/songs/${songId}/notes`).send(payload).set('Authorization', `Bearer ${jwt}`),
  ])
  const statuses = [res1.status, res2.status].sort()
  expect(statuses).toEqual([201, 409])
  const count = await prisma.note.count({ where: { songId, track: 1, time: 5.0 } })
  expect(count).toBe(1)
})
```

#### Acceptance criteria

- [ ] All unit tests pass
- [ ] All integration tests pass against real test DB
- [ ] Concurrent conflict test passes (Promise.all, not sequential)
- [ ] `pnpm test` runs without manual DB setup beyond `DATABASE_URL`

---

### Block 15 — Role-Based View Modes (OHO-220)

**🔗 Depends on:** Block 9 (PianoRoll), Block 6 (EditorStore)

#### What to build

Zustand `viewMode` atom drives rendering conditionals in PianoRoll.

**Composer View (default):**
- All 8 tracks, full interaction, AI suggester available

**Developer View:**
- Notes show ID on hover (monospace 10px)
- Exact timestamps (not rounded) in tooltip
- Right panel "Details" tab always open
- `useCanEdit()` hook returns `true` (Developers can still compose)

**QA View:**
- Auto-run validation queries on mount
- Notes at boundary (time < 0.5s or > 299.5s) → orange ring
- Notes within 0.3s of another note on same track → yellow ring
- Validation panel always open on right
- "J" key → jump to next validation issue

```typescript
// store/editor.store.ts addition
viewMode: 'composer' | 'developer' | 'qa'

// hooks/useCanEdit.ts
export function useCanEdit() {
  const { user } = useAuthStore()
  return user?.role !== 'VIEWER'
}
```

#### Acceptance criteria

- [ ] Switch to Developer view → note IDs visible on hover
- [ ] Switch to QA view → boundary notes highlighted orange
- [ ] QA view validation panel opens automatically
- [ ] J key jumps to next issue in QA view
- [ ] View mode persists across route navigation

---

### Block 16 — Security Hardening (OHO-221)

**🔗 Depends on:** Block 3 (AuthModule)

#### What to build

```bash
pnpm --filter @ama-midi/api add @nestjs/throttler helmet
```

**In main.ts:**
```typescript
app.use(helmet())
app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true })
```

**In AppModule:**
```typescript
ThrottlerModule.forRoot([
  { name: 'global', ttl: 60000, limit: 100 },   // 100 req/min per IP
  { name: 'notes', ttl: 60000, limit: 30 },     // 30 note creates/min per user
])
```

Apply `@Throttle({ notes: { limit: 30, ttl: 60000 } })` to `POST /notes`.

**All inputs:** `@Body()` must use class-validator DTOs. No raw `req.body` access.

**Add `ValidationPipe` globally:**
```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
```

#### Acceptance criteria

- [ ] `POST /notes` 31 times in 1 minute → 31st returns 429
- [ ] Response headers include `X-Content-Type-Options`, `X-Frame-Options`
- [ ] CORS rejects requests from non-FRONTEND_URL origins
- [ ] Extra body fields are stripped (whitelist validation)

---

### Block 17 — Frontend VIEWER Read-Only Mode (OHO-231)

**🔗 Depends on:** Block 15 (view modes), Block 3 (auth)

#### What to build

`useCanEdit()` hook drives all mutation controls.

```typescript
// Disable in PianoRoll
const canEdit = useCanEdit()
// onClick handler on grid:
if (!canEdit) return  // VIEWER sees no ghost, no POST

// Hide in toolbar:
{canEdit && <button>Fast Mode / Popup Mode toggle</button>}
{canEdit && <button>Suggest Notes (AI)</button>}
```

VIEWER still sees: all notes, history panel, presence bar, validation panel.

#### Acceptance criteria

- [ ] VIEWER clicks grid → nothing happens, no ghost, no API call
- [ ] VIEWER sees all notes and history
- [ ] All create/edit/delete controls hidden for VIEWER role

---

### Block 18 — VersionModule (OHO-249)

**🔗 Depends on:** Block 1 (SongVersion table), Block 4 (SongModule)

#### What to build

```
modules/versions/
├── versions.module.ts
├── versions.controller.ts
└── versions.service.ts
```

**Endpoints:**
- `POST /songs/:id/versions` — body: `{ name }`, snapshots current notes as JSONB
  ```typescript
  const notes = await this.prisma.note.findMany({ where: { songId, deletedAt: null } })
  await this.prisma.songVersion.create({
    data: { songId, name, snapshotData: notes, createdBy: userId }
  })
  ```
- `GET /songs/:id/versions` — list snapshots (id, name, createdBy, createdAt, noteCount)
- `POST /songs/:id/versions/:vId/restore` — restore:
  1. Soft-delete all current active notes
  2. Re-insert notes from `snapshotData` (new IDs, same positions)
  3. Emit NOTE_DELETED for each removed, NOTE_CREATED for each restored (broadcasts via WS)

#### Acceptance criteria

- [ ] Create snapshot → returns 201 with snapshot record
- [ ] List snapshots → returns array with noteCount computed
- [ ] Restore → all current notes replaced with snapshot notes, WebSocket broadcasts update

---

## Day 3 — Performance + AI + DevOps + Polish

**Goal:** 10,000 notes render smoothly. AI suggester works. System is live on a real URL. All grading criteria covered.

---

### Block 19 — Performance (OHO-222)

**🔗 Depends on:** Block 5 (NoteQueryService), Block 9 (PianoRoll + engine)

#### What to build

**Seed script (`apps/api/prisma/seed.ts`):**
```typescript
// Insert 10,000 notes across 8 tracks × 300s, no duplicate positions
// Batch inserts of 500 at a time
// Use a fixed SEED_SONG_ID
```

Run: `npx ts-node apps/api/prisma/seed.ts`

**DB indexes (add to schema.prisma):**
```prisma
@@index([songId, time])   // on Note model — for timeFrom/timeTo queries
@@index([songId, track])  // for track density queries
```

**Frontend viewport-based fetching:**

`useNotes` hook uses `getVisibleTimeRange` (from engine layer) with current `scrollTop` and `zoom` from EditorStore. Query key includes `[timeFrom, timeTo]` so ranges are cached separately.

```typescript
const { zoom } = useEditorStore()
const pxPerSecond = 3 * zoom
const { timeFrom, timeTo } = getVisibleTimeRange(scrollTop, viewportHeight, pxPerSecond)

useQuery({
  queryKey: ['notes', songId, Math.floor(timeFrom), Math.ceil(timeTo)],
  queryFn: () => api.get(`/songs/${songId}/notes?timeFrom=${timeFrom}&timeTo=${timeTo}`),
  staleTime: 30_000,
})
```

**k6 load test (`scripts/load-test.js`):**
```javascript
import http from 'k6/http'
export const options = { vus: 100, duration: '30s' }
export default function () {
  http.post(`${BASE_URL}/songs/${SONG_ID}/notes`, JSON.stringify({
    track: Math.ceil(Math.random() * 8),
    time: parseFloat((Math.random() * 300).toFixed(1)),
    title: 'Load test note',
    color: '#6366F1',
  }), { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` } })
}
```

**Performance targets:**
- p95 response time < 200ms
- DOM node count < 100 at any scroll position
- Scroll FPS > 50

#### Acceptance criteria

- [ ] `SELECT COUNT(*) FROM notes WHERE song_id = 'SEED_SONG_ID'` returns 10000
- [ ] Editor opens with 10k notes, first note visible in < 2s
- [ ] DevTools Elements: note DOM count stays < 100 while scrolling
- [ ] k6 run: p95 < 200ms, conflict 409s handled gracefully (no 500s)
- [ ] Performance numbers documented in README

---

### Block 20 — AI Note Suggester (OHO-223)

**🔗 Depends on:** Block 5 (notes API), Block 9 (PianoRoll)

#### What to build

```bash
pnpm --filter @ama-midi/api add @anthropic-ai/sdk
```

**AiModule endpoint:**
- `POST /songs/:songId/suggest-notes` — COMPOSER role only
  1. Fetch last 10 notes for song (ordered by `createdAt DESC`)
  2. Call Claude API with structured prompt
  3. Parse + validate response
  4. Return `{ suggestions: [{ track, time, color }] }`

**Claude prompt:**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 500,
  system: 'You are a MIDI note pattern assistant. Return ONLY a JSON array, no explanation, no markdown.',
  messages: [{
    role: 'user',
    content: `Here are the last notes placed: ${JSON.stringify(recentNotes.map(n => ({ track: n.track, time: n.time, color: n.color })))}. Suggest 4 next notes that continue this rhythmic and track pattern. Each suggestion needs: track (1-8 integer), time (float, must be after ${lastNote.time}, max 300), color (hex string). Return only a JSON array: [{"track":2,"time":6.0,"color":"#3B82F6"}]`,
  }],
})
```

Validate each suggestion: `track 1–8`, `time 0–300`, valid hex color.

**Frontend ghost note UI** (Design System spec §3.8):
- "Suggest" button in toolbar, disabled if `notes.length < 5`
- Loading state while API responds
- Ghost circles: 2px dashed border (`--color-primary`), 20% fill opacity, `ghost-pulse` animation
- On hover: [✓ Accept] green pill, [✗ Dismiss] gray pill
- Accept → `POST /songs/:songId/notes { track, time, color, title: 'AI Suggestion' }` → goes through normal create flow (conflict handling included)
- Dismiss → remove ghost from local state

#### Acceptance criteria

- [ ] Suggest button appears after 5+ notes placed
- [ ] API returns 4 valid suggestions (track 1–8, time after last note, valid hex)
- [ ] Ghost notes appear with pulse animation
- [ ] Accept → becomes real note, broadcasts to other tabs via WebSocket
- [ ] Dismiss → ghost removed
- [ ] Accepting a conflicted suggestion → 409 toast (not crash)
- [ ] VIEWER role cannot call suggest endpoint (403)

---

### Block 21 — UI Polish (OHO-224)

**🔗 Depends on:** Block 9 (PianoRoll), Block 6 (EditorStore)

#### What to build

**Zoom controls (1x/2x/4x):**
- Toggle group in BottomBar
- Updates `zoom` in EditorStore
- `pxPerSecond = 3 * zoom` drives: note Y positions, time marker density, API fetch window
- Changing zoom resets scroll to maintain current time position

**Loading skeleton:**
- While notes are fetching: render 8-column grid with 3 placeholder circles per track
- Use CSS animation `animate-pulse`

**Empty state:**
- Zero notes → centered overlay: "Click anywhere on the grid to place your first note"
- Shows only in Composer view, not QA/Developer

**Track labels (BottomBar left side):**
- Track 1–8 chips, click to mute (dims notes on that track, CSS `opacity-30`)
- Solo: Alt+click → only that track visible

**Keyboard shortcut legend:**
- `?` icon button in TopBar → modal listing:
  - E = Edit selected note
  - Delete/Backspace = Remove selected note
  - Cmd+Z = Undo
  - J = Jump to next issue (QA view)
  - 1/2/4 = Set zoom

#### Acceptance criteria

- [ ] Zoom 1x→4x changes note Y positions proportionally
- [ ] Loading skeleton visible during initial fetch
- [ ] Empty state shows on 0 notes
- [ ] Track mute dims notes immediately without API call
- [ ] ? modal shows all shortcuts

---

### Block 22 — ValidationModule Backend (OHO-251)

**🔗 Depends on:** Block 5 (notes API)

#### What to build

```
modules/validation/
├── validation.module.ts
├── validation.controller.ts
├── validation.service.ts
└── rules/
    ├── validation-rule.interface.ts
    ├── boundary.rule.ts
    ├── gap.rule.ts
    ├── density.rule.ts
    └── empty-track.rule.ts
```

**Interface:**
```typescript
export interface ValidationIssue {
  ruleId:   string
  severity: 'error' | 'warning'
  message:  string
  track?:   number
  time?:    number
}

export interface ValidationRule {
  ruleId:   string
  severity: 'error' | 'warning'
  run(notes: Note[]): ValidationIssue[]
}
```

**Four rules:**
1. `BoundaryRule` — time < 0.5s or > 299.5s → warning "Note near boundary at Track {t}, {time}s"
2. `GapRule` — two notes on same track within 0.1s → error "Notes too close at Track {t}, {time}s"
3. `DensityRule` — > 50 notes in any 10s window → warning "High density at {time}s–{time+10}s"
4. `EmptyTrackRule` — track has 0 notes (when other tracks have notes) → warning "Track {t} has no notes"

**Endpoint:** `GET /songs/:songId/validation`
```typescript
// Returns:
{ 
  summary: { errors: 2, warnings: 5, passed: 0 },
  issues: ValidationIssue[]
}
```

**Frontend:** ValidationPanel in RightPanel "Validation" tab — already stubbed in Block 6. Populate it now.

#### Acceptance criteria

- [ ] Seed song returns validation issues
- [ ] Each rule fires correctly for its trigger condition
- [ ] Frontend validation tab shows issues with "Jump to" links
- [ ] "J" key in QA view navigates between issues

---

### Block 23 — Outbox Table (OHO-250)

**🔗 Depends on:** Block 1 (schema)  
**Action:** Schema-only. No worker.

#### What to build

`OutboxEvent` model already in schema from Block 1. No additional code needed.

**Document in README trade-offs section:**
> For MVP, WebSocket broadcast is called synchronously after DB commit. If the broadcast fails, collaborators see stale state until refresh. For production, an outbox worker would read the `outbox_events` table and retry failed broadcasts — the table is already provisioned. The synchronous approach is acceptable for <50 concurrent users.

#### Acceptance criteria

- [ ] `SELECT * FROM outbox_events` runs without error (table exists)
- [ ] README trade-offs section documents this decision

---

### Block 24 — DevOps (OHO-225)

**🔗 Depends on:** All blocks complete

#### What to build

**GitHub Actions (`.github/workflows/ci.yml`):**
```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_DB: ama_midi_test, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: cd apps/api && npx prisma migrate deploy
        env: { DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ama_midi_test }
      - run: pnpm test
        env: { DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ama_midi_test }

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

**Railway:** API + PostgreSQL + Redis. Set env vars in Railway dashboard. Auto-deploy from `main`.

**Vercel:** Import web app. Set `VITE_API_URL` and `VITE_WS_URL` to Railway URLs.

#### Acceptance criteria

- [ ] Push to main → GitHub Actions goes green on all 3 jobs
- [ ] `docker-compose up --build` starts all 4 services, `curl :3001/health` returns 200
- [ ] Live Railway URL: `curl https://api.ama-midi.up.railway.app/health` returns 200
- [ ] Live Vercel URL: app loads, login works

---

### Block 25 — README + Documentation (OHO-226)

**🔗 Depends on:** All blocks complete, performance numbers documented

#### What to build

Update `README.md` with:
1. One-paragraph product description (product-first, not tech-first)
2. Live URL + demo credentials
3. Setup instructions (clone → install → .env → prisma migrate → seed → pnpm dev)
4. Architecture section: why modular monolith, why EventEmitter, why DB unique constraint, why event sourcing, why DOM virtualization
5. Trade-offs: synchronous EventEmitter vs Kafka, DOM virtualization vs Canvas, 0.1s snap resolution, outbox table prepared but inactive
6. Performance results: actual k6 numbers + Chrome DevTools FPS + DOM node count
7. Test coverage summary
8. Grading coverage map

#### Acceptance criteria

- [ ] README reads as product description first, tech stack second
- [ ] All actual performance numbers included (not placeholders)
- [ ] Architecture decisions explained with "why not" alternatives

---

## Dependency Graph (Critical Path)

```
Pre-Day ─────────────────────────────────────────────────────┐
  │                                                           │
  ▼                                                           ▼
Block 1 (Prisma)                                     Block 6 (App Shell)
  │                                                           │
  ├─► Block 2 (EventEmitter) ─────────────────────┐          ▼
  │                                                │    Block 7 (SongList)
  ├─► Block 3 (Auth) ────────────────────────────┐│          │
  │                                               ││          │
  ├─► Block 4 (Song) ─────────────────────────┐  ││          │
  │                                           │  ││          │
  └─► Block 5 (Note+Query+Ledger) ◄───────────┘◄─┘│         │
              │                                    │         │
              │         Block 8 (Engine Layer) ────┼─────────┤
              │                    │               │         │
              │                    ▼               │         │
              └────────────► Block 9 (PianoRoll) ◄─┘        │
                                   │                         │
                              Block 10 (Popup)               │
                                   │                         │
              ┌────────────────────┘                         │
              │                                              │
              ▼                                              │
Block 11 (WebSocket) ◄────────────────────────────────────── ┘
  │
  ├─► Block 12 (Conflict UX)
  ├─► Block 13 (History + Undo)
  ├─► Block 14 (Tests)
  ├─► Block 15 (View Modes)
  ├─► Block 16 (Security)
  ├─► Block 17 (VIEWER Mode)
  └─► Block 18 (VersionModule)
              │
Block 19 (Performance)
  │
  ├─► Block 20 (AI Suggester)
  ├─► Block 21 (UI Polish)
  ├─► Block 22 (ValidationModule)
  ├─► Block 23 (Outbox schema — no-op)
  ├─► Block 24 (DevOps)
  └─► Block 25 (README)
```

---

## Grading Coverage Map

| Criterion | Points | Blocks |
|---|---|---|
| Foundation (Song + Note CRUD, persistence, UI) | 20 | 1–4, 6–7, 9–10 |
| Architecture (modules, TypeScript, schema) | 10 | 1–5, 8 |
| Visualization & Integrity (piano roll, unique constraint, tests) | 10 | 1, 8, 9, 14 |
| Security & Auth (Google OAuth, rate limit, CSRF, JWT, RBAC) | 10 | 3, 16, 17 |
| UI/UX Excellence (dark mode, snap, zoom, optimistic UI, toasts) | 10 | 6–12, 21 |
| Advanced Backend (Socket.io, Redis, presence, conflict broadcast) | 10 | 11–13, 18 |
| DevOps & Cloud (Docker, GitHub Actions, Railway, Vercel) | 10 | 24 |
| Performance (virtualization, chunked fetch, k6, benchmark) | 10 | 8, 19 |
| AI Innovation (Claude API, ghost notes, accept/dismiss) | 10 | 20 |
| **Total** | **100** | |

---

## Architecture Invariants — Never Violate

1. **`NoteService` has ZERO imports from `LedgerModule` or `RealtimeModule`** — uses EventEmitter only
2. **`NoteService` has ZERO read methods** — all reads go through `NoteQueryService`
3. **Duplicate prevention is enforced at DB level** — no app-level pre-check as sole guard
4. **Every note mutation must emit a domain event** — ledger writes are a consequence, not a direct call
5. **Soft deletes only** — never `DELETE FROM notes`; always `UPDATE notes SET deleted_at = NOW()`
6. **All coordinate math lives in `features/editor/engine/`** — never inline in React components
7. **WebSocket is notification-only** — all writes go through REST API + DB
