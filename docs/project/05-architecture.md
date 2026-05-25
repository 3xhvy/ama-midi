# Architecture & System Design

← [README](../../README.md) · [← Design Thinking](./04-design-thinking.md) · [Workflows →](./06-workflows.md)

---

## Stack Overview

### Frontend (`apps/web`)

| Choice | Reason |
|---|---|
| **React 18 + TypeScript** | Concurrent rendering helps absorb rapid WebSocket state updates. TypeScript catches note shape mismatches at compile time, not runtime. |
| **TanStack Query** | Server state management with cache + background refetch. Notes in each time window are cached by query key — revisited windows don't reload. |
| **Zustand** | Lightweight client state for editor mode, selected note, zoom level, presence. Zoom is a single Zustand atom — the entire rendering and fetch pipeline reads from it. |
| **Socket.io-client** | WebSocket connection with automatic reconnection. Merges real-time events into TanStack Query cache. |
| **@tanstack/virtual** | Installed; not yet wired. Current rendering uses a client-side `visibleNotes.filter()` inside `PianoRoll.tsx` — DOM count equals notes in the 20s API bucket that pass the viewport filter. |
| **TailwindCSS** | Dark-mode studio UI. Utility classes avoid CSS specificity conflicts in a component-heavy editor. |
| **Vite** | Fast dev server HMR; optimized production builds with code splitting. |

### Backend (`apps/api`)

| Choice | Reason |
|---|---|
| **NestJS + TypeScript** | Module system maps 1:1 to domain boundaries. Dependency injection keeps services testable in isolation. |
| **PostgreSQL 15** | ACID transactions. Unique partial indexes. JSONB for ledger before/after snapshots without a separate schema. |
| **Prisma** | Type-safe queries. Migrations checked into version control. `P2002` error code identifies unique constraint violations cleanly. |
| **Redis 7** | Pub/Sub channel per song room. Ensures WebSocket events broadcast to all API instances, not just the one that received the write. |
| **Socket.io + Redis adapter** | Room management per song ID. Redis adapter handles multi-instance fan-out transparently. |
| **Passport.js + Google OAuth** | OIDC SSO — enterprise access control via Google Workspace. No password management. |
| **@nestjs/throttler** | Rate limiting at the route level. 30 note creates per minute per user. |

### Shared (`packages/shared`)

Zero-dependency TypeScript library. Types `Note`, `Song`, `NoteEvent`, `AuthUser`, `NoteSuggestion` defined once, imported by both `web` and `api`. Prevents the type drift that causes silent runtime bugs at 3am.

---

## Module Map

```
Backend (NestJS modules)            Frontend (feature directories)
─────────────────────────────       ──────────────────────────────
AuthModule                          features/auth/
  └─ Google OAuth, JWT guards         └─ Login, callback, guards

UserModule                          features/songs/
  └─ Profile, role assignment         └─ Song list, project cards

SongModule                          features/editor/
  └─ Song CRUD, ownership             ├─ PianoRoll (grid + virtualization)
                                      ├─ NotePopup (create/edit form)
NoteModule                            ├─ TransportBar (zoom + mode)
  ├─ NoteService (commands)           ├─ HistoryPanel (ledger sidebar)
  └─ NoteQueryService (reads)         └─ AiAssistant (ghost overlay)

LedgerModule                        features/collaboration/
  └─ NoteEvent writes + history       └─ SessionPresenceMenu

RealtimeModule                      hooks/
  └─ Socket.io gateway                ├─ useSocket (WS connection)
     + Redis Pub/Sub adapter          ├─ useNotes (Query + WS merge)
                                      └─ useUndo (compensating event)
AiModule
  └─ Multi-provider AI (Anthropic / OpenAI / DeepSeek), note suggestions
```

---

## Data Model

### Critical Table: `notes`

```
notes
  id            UUID PK
  song_id       UUID FK → songs
  track         INT  (1–8)
  time_seconds  NUMERIC(6,2)  (0–300, 0.1s resolution)
  title         VARCHAR(200)
  description   TEXT
  color         VARCHAR(20)
  created_by    UUID FK → users
  version       INT  (optimistic concurrency)
  deleted_at    TIMESTAMPTZ  (soft delete — ledger integrity)

UNIQUE INDEX uq_notes_song_track_time_active
  ON notes (song_id, track, time_seconds)
  WHERE deleted_at IS NULL
```

The partial unique index — `WHERE deleted_at IS NULL` — means soft-deleted notes don't block new notes at the same position. A composer can delete a note and re-place it at the same spot. The ledger still records both events.

### Ledger Table: `note_events`

```
note_events
  id          UUID PK
  song_id     UUID FK → songs
  note_id     UUID FK → notes (nullable — SET NULL on note delete)
  actor_id    UUID FK → users
  event_type  VARCHAR  (NOTE_CREATED | NOTE_UPDATED | NOTE_DELETED)
  before_data JSONB    (full note snapshot before change)
  after_data  JSONB    (full note snapshot after change)
  created_at  TIMESTAMPTZ
```

Storing full JSONB snapshots rather than diffs makes history queries simple: "show me what this note looked like before this event" is a single row read, not a diff chain reconstruction.

### Entity Relationship (high-level)

```
users ──< songs (owner)
users ──< song_collaborators >── songs
songs ──< notes
notes ──< note_events >── users (actor)
songs ──< editor_sessions >── users (presence)
```

---

## Real-Time Architecture

```
                    ┌─────────────┐
  Composer A        │  API inst 1 │──┐
  (WebSocket)  ───► │  NestJS     │  │  Redis Pub/Sub
                    └─────────────┘  ├─► channel: song_<id>
                                     │
  Composer B        ┌─────────────┐  │  Redis Pub/Sub
  (WebSocket)  ───► │  API inst 2 │──┘
                    │  NestJS     │◄──── channel: song_<id>
                    └─────────────┘
                          │
                          └──► broadcasts to all WS clients in room
```

When API instance 1 receives a write, it publishes to the Redis channel. The Redis adapter on instance 2 receives the event and broadcasts to every Socket.io client in that song's room — including Composer B, who is connected to instance 2.

---

## Key Architectural Invariants

1. **Every note mutation writes a `NoteEvent`.** No exceptions. The ledger and the note table are always in sync.
2. **Soft deletes only.** `deleted_at TIMESTAMPTZ` — no hard deletes. Ledger records reference note IDs; hard deletes would orphan history.
3. **Zoom is a single Zustand atom.** Every consumer — note Y positions, fetch window, grid ruler — reads from one source. They cannot diverge.
4. **`P2002` → 409, never 500.** Unique constraint violations are expected behavior, not errors.
5. **No inline coordinate math outside the engine.** All `(x, y) → (track, time)` conversions go through one place.

---

*→ Next: [Major Feature Workflows](./06-workflows.md)*
