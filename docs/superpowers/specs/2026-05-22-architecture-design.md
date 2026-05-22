# AMA-MIDI — Architecture Design & Scaling Analysis

**Date:** 2026-05-22
**Source:** Linear project (OHOMI / AMA-MIDI, OHO-207→OHO-251) + initial_document/ + scaling patterns audit
**Status:** Reference doc — informs implementation order

---

## 1. Project State (from Linear)

25 issues across 4 milestones, all in **Backlog**. Nothing started. Target: 2026-05-24.

| Milestone | Key Issues |
|---|---|
| Pre-Day — Setup & Environment | OHO-207 (monorepo), OHO-208 (Docker), OHO-209 (.env), OHO-227 (design system) |
| Day 1 — Foundation + Core Editor | OHO-210–216, OHO-228–229, OHO-246–248 |
| Day 2 — Collaboration + Ledger + Security | OHO-217–221, OHO-231, OHO-249 |
| Day 3 — Performance + AI + DevOps + Polish | OHO-222–226, OHO-250–251 |

Six architectural issues (OHO-246→251) were added after the original roadmap — these are scaling audit findings converted to actionable tasks.

---

## 2. What Is Correct — Do Not Change

These decisions are sound. Arguing against them wastes time.

### Modular monolith (NestJS modules)
3-day build. Microservices add deployment complexity, inter-service network calls, distributed tracing, and shared-type sync problems — none of which have payoff at this scale. NestJS modules give clean domain boundaries without any of that cost.

### Database-level unique constraint
```sql
CREATE UNIQUE INDEX uq_notes_song_track_time_active
ON notes (song_id, track, time_seconds)
WHERE deleted_at IS NULL;
```
Application-level pre-checks are race conditions. Two concurrent writes both read "no note exists" before either commits. Both succeed. Constraint violation. The DB constraint is atomic. `P2002` → HTTP 409. This is non-negotiable.

### Event sourcing (note_events ledger)
`notes` = current state snapshot. `note_events` = append-only history. Undo = compensating event (new `NOTE_DELETED`). Full audit trail with `before_data`/`after_data` JSONB. Correct model for collaborative real-time editing where everyone is always on "main."

### Redis Pub/Sub + Socket.io adapter
Each API instance publishes to Redis channel → Redis adapter fans out to all instances' rooms. WebSocket horizontal scale path is wired before it's needed. Correct.

### DOM virtualization (@tanstack/virtual)
~80 DOM nodes in view regardless of total note count. Canvas has higher throughput ceiling but requires hand-implementing hit-testing, hover states, and accessibility — wrong tradeoff for an interaction-heavy piano roll editor.

### Optimistic UI + server authority
Ghost note appears on click → POST in background → 409 removes ghost + toast. Server is always the authority. DB constraint prevents corruption regardless of what the frontend does.

---

## 3. The 6 Architecture Gaps

### Gap 1 — OHO-246 (High, Day 1): No internal EventEmitter

**Problem:** Current plan has `NoteService` call `RealtimeGateway` and `LedgerService` directly. Synchronous coupling. Every new consumer (validation, analytics, notifications) requires another direct call inside `NoteService`. Becomes a god method by Day 2.

**Fix:** `@nestjs/event-emitter`. `NoteService` emits domain events. All consumers listen independently.

```
NoteService.create()
  → this.eventEmitter.emit('note.created', payload)
    ← LedgerService  @OnEvent('note.created') → writes NoteEvent to DB
    ← RealtimeGateway @OnEvent('note.created') → broadcasts WebSocket to room
    ← ValidationService @OnEvent('note.created') → checks rules (OHO-251, future)
```

**Domain event contracts** (add to `packages/shared/src/events.ts`):
```typescript
export interface NoteCreatedEvent {
  songId: string; noteId: string; userId: string; afterState: Note;
}
export interface NoteUpdatedEvent {
  songId: string; noteId: string; userId: string;
  beforeState: Partial<Note>; afterState: Partial<Note>;
}
export interface NoteDeletedEvent {
  songId: string; noteId: string; userId: string; beforeState: Note;
}
```

**Critical:** Must exist **before OHO-214 (NoteModule)**. Retro-fitting after NoteModule is built = full rewrite of the most critical service.

---

### Gap 2 — OHO-247 (High, Day 1): NoteService mixes reads and writes

**Problem:** Writes care about integrity (insert, constraint, transaction). Reads care about performance (viewport window, pagination, track summary). Same class = mixed concerns, hard to optimize either independently.

**Fix:** `NoteQueryService` alongside `NoteService` in same module. Both share `PrismaService`. No separate DB.

```
notes/
├── note.service.ts          ← commands: create, update, delete
├── note.query.service.ts    ← queries: getVisible(timeFrom, timeTo), getOverview
├── note.controller.ts
└── note.repository.ts       ← optional: shared Prisma calls
```

---

### Gap 3 — OHO-248 (High, Day 1): Coordinate math inside React component

**Problem:** If `xToTrack()`, `yToTime()`, `getVisibleTimeRange()` live in the PianoRoll component, they're untestable, non-reusable, and hard to evolve. Zoom changes `pxPerSecond`, which must update both note rendering AND the API fetch window simultaneously — this only works reliably if the logic is a shared pure function, not embedded in a component.

**Fix:** Pure TypeScript engine layer before PianoRoll is built.

```
features/editor/engine/
├── coordinate-mapper.ts     ← xToTrack(x, gridWidth), yToTime(y, pxPerSecond)
│                               trackToX(track, gridWidth), timeToY(time, pxPerSecond)
├── viewport-calculator.ts   ← getVisibleTimeRange(scrollTop, height, pxPerSecond)
├── snap.ts                  ← snapToGrid(time, resolution = 0.1)
└── collision-detector.ts    ← (future) isPositionOccupied
```

Zero React imports. Fully testable. Reused by `useNotes` fetch hook and PianoRoll renderer.

---

### Gap 4 — OHO-249 (High, Day 2): song_versions table exists, no module

**Problem:** `song_versions` table is in the Prisma schema (OHO-210) with `snapshot_data JSONB`. Without a `VersionModule`, there's no API to create or restore snapshots. The P2 feature "Song Version Snapshot" cannot be demoed.

**Fix:** `VersionModule` with 3 endpoints:
- `POST /songs/:id/versions` — create snapshot of current note state
- `GET /songs/:id/versions` — list snapshots (name, created_by, created_at)
- `POST /songs/:id/versions/:vId/restore` — restore song notes from snapshot

---

### Gap 5 — OHO-250 (Medium, Day 3): Outbox pattern missing

**Problem:** Current flow: DB write commits → WebSocket emit called synchronously. If emit fails after commit, collaborators get stale state with no retry mechanism.

**For MVP (prepare, don't activate):**
```sql
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
Table exists in schema. No worker runs in MVP. Documents the reliability path.

**For production:** Background worker polls `outbox_events WHERE status = 'pending'`, retries broadcast. Decouples DB commit from delivery guarantee.

---

### Gap 6 — OHO-251 (Medium, Day 3): Validation is frontend heuristics only

**Problem:** QA view highlights boundary notes via inline frontend logic. No backend rule engine means validation can't be used by other consumers (export, audit reports, future mobile).

**Fix:** `ValidationModule` with a `ValidationRule` interface and 4 concrete rules.

```typescript
interface ValidationRule {
  name: string;
  severity: 'error' | 'warning';
  run(notes: Note[]): ValidationIssue[];
}
```

Initial rules:
1. `BoundaryRule` — time < 0.5s or > 299.5s
2. `GapRule` — two notes on same track within 0.1s
3. `DensityRule` — > 50 notes in any 10s window
4. `EmptyTrackRule` — track has 0 notes (song has other tracks with notes)

Endpoint: `GET /songs/:id/validation` → `{ issues: ValidationIssue[] }`

---

## 4. Implementation Order (Critical Path)

```
OHO-246 (EventEmitter)      ← BEFORE OHO-214 (NoteModule)
OHO-247 (QueryService)      ← WITH OHO-214 (NoteModule), same PR
OHO-248 (Editor Engine)     ← BEFORE OHO-215 (PianoRoll)
OHO-214 (NoteModule)        ← After OHO-246, OHO-247
OHO-215 (PianoRoll)         ← After OHO-248
OHO-249 (VersionModule)     ← Day 2, after ledger (OHO-219)
OHO-250 (Outbox schema)     ← Day 3, schema only, no worker
OHO-251 (ValidationModule)  ← Day 3, after performance (OHO-222)
```

---

## 5. Scaling Path (Post-MVP)

### Phase 1 — Current (MVP)
Modular monolith + `@nestjs/event-emitter` + Redis adapter.
- `NoteService` emits events, consumers react independently
- 1 API instance, handles <100 concurrent editors
- All reads/writes in same process

### Phase 2 — When load grows (~500 concurrent editors)
- Activate outbox worker — background process retries failed broadcasts
- CQRS: `NoteQueryService` gets its own read-optimized DB view or materialized snapshot
- Add connection pooling (PgBouncer) in front of PostgreSQL

### Phase 3 — Distinct load profiles diverge
Extract 2 services first (in this order):

1. **`collaboration-service`** — WebSocket is stateful and grows with user count, independent of note business logic. Redis adapter already isolates this.
2. **`ai-service`** — External API calls with variable latency and cost; should not block API workers.

Keep together longest: `SongModule`, `NoteModule`, `LedgerModule`, `VersionModule`. These are transaction-heavy and strongly relational — splitting creates distributed transaction problems.

### Phase 4 — Amanotes scale
- Event streaming (Kafka or AWS SQS) replaces in-process `EventEmitter`
- CQRS with separate read replica for editor query performance
- Async `validation-service` evaluates rules after note mutations
- `export-service` for CPU-heavy game-format generation

---

## 6. Interview Narrative

> "AMA-MIDI is a modular monolith organized by product domain: auth, songs, notes, collaboration, ledger, and AI. Every mutation routes through an internal event bus — NoteService doesn't know about LedgerService or the WebSocket gateway, it just emits a domain event. The ledger is append-only, so undo is a compensating event rather than a rollback. Conflict prevention is at the DB layer — a partial unique index on (song_id, track, time) where deleted_at IS NULL. For scaling, I'd activate the outbox table to decouple DB commits from broadcast delivery, then extract the collaboration and AI modules when their load profiles diverge from the core CRUD service."

---

## 7. What Was Cut and Why

| Feature | Reason cut |
|---|---|
| Audio playback | Requires MIDI synthesis engine; no grading impact |
| Git-style branching | Wrong model for live collaborative editing; no "branch" when everyone is on same document simultaneously |
| Section-based locking | DB constraint + conflict toast already solves the core case; locking would serialize creative work |
| Comment pins on timeline | No grading impact; high UI complexity |
| Cursor presence (live mouse) | High WebSocket overhead; product value exists but deprioritized |
| CRDT | Note editing is discrete, not free-text; server-authoritative writes with DB constraints are simpler and safer |
