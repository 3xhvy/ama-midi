# AMA-MIDI — Scaling Patterns Audit

**Date:** 2026-05-22  
**Source:** Linear project (OHO-207 through OHO-231), `initial_document/`, `docs/superpowers/`  
**Purpose:** Map the recommended scaling patterns against what is actually planned and present in the codebase.

---

## Summary Table

| Pattern | Status | Strength |
|---|---|---|
| A. Modular Monolith | ✅ Present | Strong |
| B. Event-Driven Internal Architecture | ⚠️ Partial | Weak — synchronous calls, no EventEmitter |
| C. Event Sourcing-lite / Ledger Pattern | ✅ Present | Strong |
| D. Optimistic UI + Server Authority | ✅ Present | Strong |
| E. Outbox Pattern | ❌ Missing | Not prepared |
| F. CQRS for Editor Read Performance | ⚠️ Partial | Query params only, no query service layer |
| Backend Domain Modules (complete set) | ⚠️ Partial | 7 of 11 recommended modules planned |
| Database Versioning + Publishing Tables | ⚠️ Partial | Snapshot only, no publish workflow |
| Frontend Feature-based Folders | ✅ Present | Strong |
| Frontend Editor Engine Separation | ⚠️ Missing | All logic in PianoRoll component |
| Real-time Scaling (Redis adapter) | ✅ Present | Strong |

---

## Pattern A — Modular Monolith ✅

**Recommended:** `apps/api/src/modules/` with clean domain boundaries.

**Present in project:**

The architecture spec (`docs/superpowers/specs/2026-05-22-pre-day-architecture-setup-design.md`) defines exactly this structure:

```
apps/api/src/
├── modules/
│   ├── auth/       (OHO-212)
│   ├── users/
│   ├── songs/      (OHO-213)
│   ├── notes/      (OHO-214)
│   ├── ledger/     (OHO-219)
│   ├── realtime/   (OHO-217)
│   └── ai/         (OHO-223)
├── common/
├── database/
└── main.ts
```

The ADR in `feature_list_erd.md` (Decision 1) explicitly states:

> Use a modular monolith instead of microservices. Faster to build and easier to explain, while still allowing clean separation between auth, songs, notes, collaboration, history, and AI modules.

**Gap:** The current `apps/api/src/` only has the NestJS shell (app.module, app.controller, app.service, main.ts). No domain modules exist yet — they are all Backlog in Linear.

**Modules planned in Linear vs recommended:**

| Module | Linear Issue | Status |
|---|---|---|
| AuthModule | OHO-212 | Backlog |
| UserModule | (implied in spec) | No dedicated issue |
| SongModule | OHO-213 | Backlog |
| NoteModule | OHO-214 | Backlog |
| CollaborationModule (realtime) | OHO-217 | Backlog |
| LedgerModule | OHO-219 | Backlog |
| AiModule | OHO-223 | Backlog |
| VersionModule | (schema exists, no module issue) | No dedicated issue |
| ExportModule | Not planned | Out of scope |
| ValidationModule | (QA view only — frontend) | No backend issue |
| NotificationModule | Not planned | Out of scope |

**Action needed:** Create Linear issues for `VersionModule` and `ValidationModule` (backend rule engine). `ExportModule` and `NotificationModule` are correctly deferred.

---

## Pattern B — Event-Driven Internal Architecture ⚠️

**Recommended:** Every important action emits a domain event via `this.eventEmitter.emit('note.created', ...)`. Other modules react independently. This prevents `NoteService` from becoming a god class.

**Present in project:**

- `note_events` table exists in the schema (Prisma `NoteEvent` model, OHO-210).
- WebSocket gateway (OHO-217) broadcasts `note-created`, `note-updated`, `note-deleted` to rooms.
- NoteEvent types `NOTE_CREATED | NOTE_UPDATED | NOTE_DELETED` are in `packages/shared/src/types.ts`.

**What is NOT present:**

The planned implementation in OHO-214 describes:

> NoteService writes note + NoteEvent inside a `$transaction()` and then calls the gateway to emit.

This is **synchronous coupling** — `NoteService` directly calls `RealtimeGateway`. The recommended pattern is:

```typescript
// Recommended (decoupled)
this.eventEmitter.emit('note.created', { songId, noteId, userId, afterState });
// LedgerService reacts → writes note_event
// RealtimeGateway reacts → broadcasts WebSocket
// ValidationService reacts → checks rules

// Current plan (coupled)
await this.prisma.$transaction([noteInsert, eventInsert]);
await this.realtimeGateway.emitToRoom(songId, 'note-created', note);
```

**Risk:** With the current synchronous approach, adding more consumers (validation, analytics, notifications) means adding more direct calls inside `NoteService`. By Day 3 this becomes a god method.

**Action needed:** Install `@nestjs/event-emitter` and replace direct gateway calls with internal domain events. The ledger write, WebSocket broadcast, and any future validation check should each be event listeners, not direct calls from `NoteService`.

```typescript
// In app.module.ts
EventEmitterModule.forRoot()

// In NoteService
this.eventEmitter.emit('note.created', {
  songId, noteId, userId, afterState,
});

// In RealtimeGateway
@OnEvent('note.created')
handleNoteCreated(payload: NoteCreatedEvent) {
  this.server.to(`song:${payload.songId}`).emit('note-created', payload);
}

// In LedgerService
@OnEvent('note.created')
async handleNoteCreated(payload: NoteCreatedEvent) {
  await this.prisma.noteEvent.create({ ... });
}
```

This pattern is low cost to add now and is the key that makes the internal architecture extensible.

---

## Pattern C — Event Sourcing-lite / Ledger Pattern ✅

**Recommended:**
- `notes` table = current state only
- `note_events` table = history, audit, undo, replay source

**Present in project — strong match:**

The Prisma schema (OHO-210) defines exactly this:

```prisma
model Note {
  id          String   @id
  songId      String
  track       Int      // current position
  time        Float    // current position
  // ... current state fields
  @@unique([songId, track, time])
}

model NoteEvent {
  id          String        @id
  songId      String
  noteId      String?
  eventType   NoteEventType // NOTE_CREATED | NOTE_UPDATED | NOTE_DELETED
  userId      String
  timestamp   DateTime
  beforeState Json?         // state before mutation
  afterState  Json?         // state after mutation
}
```

The raw SQL schema in `feature_list_erd.md` confirms `before_data JSONB` and `after_data JSONB`.

OHO-219 (History Panel) implements:
- `GET /songs/:songId/events` — history endpoint, newest first, paginated
- `POST /songs/:songId/events/undo` — compensating event (deletes last NOTE_CREATED, writes NOTE_DELETED)

**Interview line documented in OHO-219:**

> Immutable NoteEvent log in DB. Undo = emit a compensating event (write a new NOTE_DELETED event that reverses the last NOTE_CREATED).

This is a textbook ledger pattern. No action needed.

**What is correctly deferred:** Full event sourcing (replay from events to reconstruct current state). The project uses snapshot reads (`notes` table) for speed and event log for history — exactly the right tradeoff for MVP.

---

## Pattern D — Optimistic UI + Server Authority ✅

**Recommended:**
- Frontend shows ghost note immediately (optimistic)
- DB `UNIQUE(song_id, track, time)` is the authority
- On 409: rollback ghost, show conflict toast
- Never rely on frontend validation alone

**Present in project — strong match:**

OHO-215 (Piano Roll) describes:

> On grid click → show ghost circle immediately → POST to /notes → if 409: remove ghost + toast "This position is already taken" → if success: replace ghost with server data

OHO-218 (Conflict UX) handles the toast system for 409, disconnect, and reconnect.

The unique constraint is in both the raw SQL and Prisma schema:

```prisma
@@unique([songId, track, time])  // THE core integrity constraint
```

```sql
CREATE UNIQUE INDEX uq_notes_song_track_time_active
ON notes (song_id, track, time_seconds)
WHERE deleted_at IS NULL;
```

The Build Roadmap states:

> Manually try inserting two notes with the same song_id, track, time in psql — confirm it rejects the second one. This is the most important verification in the entire project.

No action needed. This pattern is deeply embedded in the project's core design.

---

## Pattern E — Outbox Pattern ❌

**Recommended:** For reliability at scale — save note, save event to `outbox_events` in same transaction, worker processes outbox asynchronously. Prevents "DB write succeeded, WebSocket broadcast failed" state corruption.

**Present in project:** Not present. No `outbox_events` table in any schema file. No mention in any Linear issue.

**Current approach:** The plan uses synchronous transaction (`$transaction([noteInsert, eventInsert])`) followed by direct WebSocket emit. This means:

1. If the WebSocket broadcast fails after the DB commit, collaborators get stale state until they refresh.
2. Export, AI generation, and notification will be synchronous inside request-response if not addressed.

**Recommended action for this project:**

Since this is a 3-day build, full outbox implementation is correctly deferred. However, the table should be **prepared but not activated**:

```sql
-- Add to schema, populate but don't rely on yet
CREATE TABLE outbox_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  payload      JSONB NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
```

**Interview position:** "For MVP, the synchronous emit inside the transaction is sufficient. For production, I would introduce an outbox table so the DB write and WebSocket broadcast are decoupled — a background worker reads the outbox and retries failed broadcasts."

**Action needed:** Add outbox_events to the Prisma schema as a prepared-but-unused table. Document in README trade-offs section.

---

## Pattern F — CQRS for Editor Read Performance ⚠️

**Recommended:** Separate command services (`NoteService.create()`) from query services (`EditorQueryService.getVisibleNotes()`). Later add read-optimized tables.

**Present in project — partial:**

OHO-222 (Performance) and OHO-215 (Piano Roll) plan:

- `GET /songs/:songId/notes?timeFrom=X&timeTo=Y` — viewport-based chunked fetching
- DB indexes on `(song_id, time)` and `(song_id, track)`
- `@tanstack/virtual` for Y-axis DOM virtualization

**What is NOT present:**

There is no explicit command/query service separation in the NestJS modules. `NoteModule` has one `NoteService` that handles both writes and reads. The recommended structure:

```
notes/
├── note.service.ts         ← commands: create, update, delete
├── note.query.service.ts   ← queries: getVisible, getSongOverview
├── note.controller.ts
└── note.repository.ts
```

**Risk:** Low for MVP. The service won't grow large enough in 3 days to need splitting. However, naming it correctly from the start costs nothing.

**Action needed:** When implementing OHO-214, name the read methods in a way that signals their query nature. Add `NoteQueryService` alongside `NoteService` in the same module — they can share the Prisma client. No separate database needed.

---

## Domain Module Coverage

### Backend modules

| Recommended Module | Present | Notes |
|---|---|---|
| `AuthModule` | ✅ OHO-212 | Google OAuth + JWT + RolesGuard |
| `UserModule` | ⚠️ Implied | No dedicated Linear issue; user profile endpoints needed |
| `SongModule` | ✅ OHO-213 | CRUD, creator/admin permissions |
| `NoteModule` | ✅ OHO-214 | CRUD, conflict handling, event writes |
| `CollaborationModule` | ✅ OHO-217 | Socket.io gateway, Redis adapter, presence |
| `LedgerModule` | ✅ OHO-219 | History endpoint, undo, compensating events |
| `AiModule` | ✅ OHO-223 | Claude API, ghost note suggestions |
| `VersionModule` | ⚠️ Schema only | `song_versions` table in schema but no module issue |
| `ValidationModule` | ❌ Frontend only | QA view (OHO-220) is client-side; no backend rule engine |
| `ExportModule` | ❌ Deferred | Correctly out of scope for MVP |
| `NotificationModule` | ❌ Deferred | Correctly out of scope for MVP |

### Database tables

| Recommended Table | Present | Notes |
|---|---|---|
| `users` | ✅ | In Prisma schema (OHO-210) |
| `songs` | ✅ | In Prisma schema |
| `notes` with unique constraint | ✅ | `@@unique([songId, track, time])` |
| `note_events` ledger | ✅ | `beforeState`, `afterState` JSONB |
| `song_versions` snapshot | ✅ | `snapshot_data JSONB` — snapshot pattern |
| `editor_sessions` (presence) | ✅ | In raw SQL schema |
| `publish_requests` | ❌ | Not planned, correctly deferred |
| `validation_issues` | ❌ | Not planned |
| `outbox_events` | ❌ | Not planned, should be prepared |
| `export_jobs` | ❌ | Not planned, correctly deferred |
| `ai_suggestions` | ❌ | Not planned — current approach uses transient response, not persisted |

---

## Frontend Scaling Patterns

### Feature-based folder structure ✅

The architecture spec defines exactly the recommended structure:

```
apps/web/src/
├── app/                  ← routing, providers
├── components/           ← shared UI primitives
├── features/
│   ├── auth/
│   ├── songs/
│   ├── editor/
│   ├── notes/
│   ├── collaboration/
│   └── history/
├── hooks/
├── lib/
├── store/
└── types/
```

This matches the recommendation to avoid flat `components/pages/utils/services/` structure.

### Editor engine separation ⚠️

**Recommended:**

```
features/editor/
├── components/
├── hooks/
├── editor-engine/
│   ├── coordinate-mapper.ts    ← x/y → track/time
│   ├── note-positioning.ts     ← note Y position from time
│   ├── selection-manager.ts
│   ├── collision-detector.ts
│   └── viewport-calculator.ts  ← visible time range from scroll + zoom
├── store/
└── api/
```

**What is planned:**

OHO-215 (Piano Roll) puts all logic in a `PianoRoll` React component:
- Grid click → coordinate conversion → POST → optimistic state
- Virtualization via `@tanstack/virtual`
- Note positioning computed inline

OHO-222 (Performance) adds `timeFrom`/`timeTo` viewport calculation in the `useNotes` hook.

**The gap:** Coordinate math, zoom calculation, and viewport logic will live inside React components and hooks rather than a pure TypeScript engine layer. This is acceptable for MVP but will make drag-select, copy/paste, quantization, and minimap harder to add later.

**Action needed:** When implementing OHO-215, extract these into `features/editor/engine/`:

```typescript
// features/editor/engine/coordinate-mapper.ts
export function xToTrack(x: number, gridWidth: number): number
export function yToTime(y: number, pxPerSecond: number): number
export function trackToX(track: number, gridWidth: number): number
export function timeToY(time: number, pxPerSecond: number): number

// features/editor/engine/viewport-calculator.ts
export function getVisibleTimeRange(scrollTop: number, height: number, pxPerSecond: number): { from: number; to: number }
```

These are pure functions — easy to test, easy to reuse across zoom levels and future views.

---

## Real-time Scaling ✅

**Recommended:**
- Socket.io room per song
- Redis Pub/Sub between API instances (for horizontal scaling later)
- WebSocket is notification only — all writes go through API + DB

**Present in project — strong match:**

OHO-217 explicitly plans:
- `@socket.io/redis-adapter` connected to Redis
- JWT auth in WebSocket handshake
- `join-song` → client joins `song:{songId}` room
- Server emits to rooms: `note-created`, `note-updated`, `note-deleted`
- `NoteModule` calls the gateway after successful DB writes

The Build Roadmap verification step:

> Open two browser tabs on the same song → Create a note in Tab 1 → Confirm it appears in Tab 2 without refreshing

The important constraint is documented in the architecture spec Decision 3:

> Redis also supports scaling WebSocket events later (multiple API instances behind a load balancer).

**What is correctly rejected:** CRDT. OHO-217 rationale:

> I would not start with CRDT because note editing is discrete, not free-text editing. For MVP, server-authoritative writes with database constraints are simpler and safer.

No action needed.

---

## Future Feature Readiness

| Future Feature | Pattern Needed | Current Readiness |
|---|---|---|
| Multi-user editing (deeper) | Presence + optimistic + Redis | ✅ Planned (OHO-217) |
| Undo / redo | Command Pattern + Ledger + Compensating Event | ✅ Planned (OHO-219) |
| Song versioning | Snapshot Pattern | ⚠️ Table exists, no module |
| AI note generation (persist) | Async Job + Review-before-apply | ⚠️ Transient only (OHO-223) |
| Export to game format | Job Queue + Export Artifact | ❌ Not planned |
| QA validation (backend) | Rule Engine Pattern | ❌ Frontend only (OHO-220) |
| Approval/publish workflow | Publish Request table | ❌ Not planned |
| Analytics / density cache | CQRS read models | ❌ Not planned |

---

## Extraction Order (When the Product Grows)

Per the recommendation, the first modules to extract from the monolith would be:

1. **`collaboration-service`** — WebSocket is stateful and grows with user count, independent of note business logic
2. **`export-service`** — CPU-heavy file generation should not block API workers
3. **`ai-service`** — External API calls with variable latency and cost
4. **`validation-service`** — Rule-heavy, can run async after note mutations

Keep together longest: `SongModule`, `NoteModule`, `LedgerModule`, `VersionModule` — these are transaction-heavy and strongly relational.

---

## Actions Needed (Priority Order)

### High priority (add before Day 1 application code)

1. **Install `@nestjs/event-emitter`** and design the internal event contract in `packages/shared/src/events.ts`:
   ```typescript
   export interface NoteCreatedEvent { songId: string; noteId: string; userId: string; afterState: Note }
   export interface NoteUpdatedEvent { songId: string; noteId: string; userId: string; beforeState: Partial<Note>; afterState: Partial<Note> }
   export interface NoteDeletedEvent { songId: string; noteId: string; userId: string; beforeState: Note }
   ```

2. **Extract editor engine functions** into `features/editor/engine/` pure TypeScript files before building the PianoRoll component.

### Medium priority (Day 2)

3. **Add `UserModule`** as a dedicated module with a Linear issue (user profile, list users for collaborators).

4. **Add `NoteQueryService`** alongside `NoteService` in `NoteModule` for the viewport-based read methods.

5. **Create `VersionModule`** Linear issue for the `song_versions` table operations (create snapshot, list snapshots, restore).

### Low priority (prepare but don't activate — Day 3 or README)

6. **Add `outbox_events` to Prisma schema** as a prepared-but-unused table. Document in README trade-offs.

7. **Add `ValidationModule` skeleton** with a `ValidationRule` interface even if no rules are implemented yet:
   ```typescript
   interface ValidationRule {
     name: string;
     run(notes: Note[]): ValidationIssue[];
   }
   ```

8. **Persist AI suggestions** — consider adding `ai_suggestions` and `ai_suggestion_notes` tables so accepted/rejected suggestions can be reviewed in history. Current transient approach loses this audit trail.

---

## Architecture Story (Interview)

The project's current design supports this explanation:

> I designed AMA-MIDI as a modular monolith because the project needs fast delivery, but I separated the system by product domains: auth, songs, notes, collaboration, ledger, and AI. The current state is stored in normalized tables for fast reads, while every note mutation is recorded in a ledger table for audit, undo, rollback, and future versioning. Real-time collaboration is handled through WebSocket rooms backed by Redis, but all writes remain server-authoritative and protected by database unique constraints. For later scaling, I would add an internal event bus to decouple the ledger and WebSocket consumers from the write service, introduce an outbox table for reliable broadcast, and extract the collaboration and AI modules into separate services when their load profiles diverge.

This is stronger than "I will use microservices because it scales."

---

## Phase Alignment

| Phase | Recommended | AMA-MIDI Status |
|---|---|---|
| Phase 1: Modular monolith + clean module boundaries | ✅ | Architecture spec defines this |
| Phase 2: Internal domain events + ledger + Redis WebSocket | ⚠️ | Ledger ✅, Redis ✅, EventEmitter ❌ |
| Phase 3: Outbox + background workers + export/AI/validation jobs | ❌ | Correctly deferred |
| Phase 4: CQRS read models + caching for large songs | ⚠️ | Chunked queries ✅, service layer ❌ |
| Phase 5: Extract high-load modules if needed | ❌ | Correctly deferred |
