# Design: Collaborator Activity Batching + Editor Event Ledger

**Date:** 2026-05-24  
**Scope:** Single PR if kept tight: live activity notices, grouped History rows, and a generic editor-event ledger foundation for richer undo  
**Status:** Draft - pending user review

---

## Problem Summary

When collaborators edit rapidly, the editor currently has two related problems:

1. There are no live activity notices for remote editor mutations.
2. History is note-only and noisy. A 20-note paste can produce 20 separate rows instead of one readable burst.

The current ledger is named and shaped like `NoteEvent`, so it records only note creates/deletes. Undo also lives inside `NotesService` and only understands note events. That makes it hard to add history/undo for note edits, sections, and future document-level changes.

**Goal:** Add collaborator activity batching while improving the ledger model so History can receive all meaningful editor events and undo can grow event-by-event through explicit inverse operations.

---

## Decisions

| Question | Choice |
|----------|--------|
| Live notices | Yes, collaborator-only toasts for remote meaningful editor mutations |
| History | Yes, grouped rows for all ledger-backed editor events |
| Grouping rule | 4+ actions from the same actor within 30 seconds |
| Toast audience | Collaborators only; never show live toasts for the current user's own actions |
| History audience | Everyone; include and group your own actions too |
| Ledger direction | Replace note-only ledger with generic editor event ledger |
| Undo scope | Only events with known inverse operations are undoable |

**Out of scope:** cursor moves, playback, zoom, panel toggles, validation re-runs, theme changes, server-side burst aggregation, user preference for activity toasts.

---

## Architecture

Use a generic `EditorEvent` ledger as the source for History and undo. Use enriched realtime payloads for live toasts.

```
Domain mutation
  -> emits domain event with actor + before/after state
  -> EditorEventLedger writes an editor_events row
  -> RealtimeListener broadcasts { actor, data }
  -> Peer useSocket updates cache
  -> Peer useActivityNotices batches collaborator toasts

HistoryPanel
  -> fetches editor_events
  -> groupHistoryEvents() collapses 4+ same-user rows within 30s

Undo
  -> finds latest undoable editor event or batch
  -> applies inverse operation
  -> writes compensating editor event/batch
  -> broadcasts normal realtime events
```

The ledger records many event types. Undo supports only event types with explicit, tested inverse logic.

---

## Data Model

### Replace `NoteEvent` with `EditorEvent`

**Prisma target model:**

```prisma
model EditorEvent {
  id             String   @id @default(uuid())
  songId         String
  chartId        String?
  entityType     String
  entityId       String?
  eventType      String
  userId         String
  beforeState    Json?
  afterState     Json?
  batchId        String?  @db.Uuid
  replacesEventId String? @db.Uuid
  undoneByEventId String? @db.Uuid
  undoable       Boolean  @default(false)
  createdAt      DateTime @default(now())

  song Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@index([songId, createdAt])
  @@index([chartId, createdAt])
  @@index([batchId])
  @@index([userId, createdAt])
  @@map("editor_events")
}
```

Migration plan:

1. Create `editor_events`.
2. Backfill from `note_events`:
   - `entityType = 'NOTE'`
   - `entityId = noteId`
   - `eventType = existing eventType`
   - `undoable = true` for `NOTE_CREATED`, `NOTE_DELETED`
   - `chartId = null` unless it can be derived safely from state
3. Keep old `note_events` table only if needed for rollback; otherwise remove after code switches.

### Shared Types

**File:** `packages/shared/src/events.ts`

```ts
export type EditorEntityType = 'NOTE' | 'SECTION' | 'CHART'

export type EditorEventType =
  | 'NOTE_CREATED'
  | 'NOTE_UPDATED'
  | 'NOTE_DELETED'
  | 'SECTION_CREATED'
  | 'SECTION_UPDATED'
  | 'SECTION_DELETED'
  | 'CHART_SWITCHED'

export interface ActivityActor {
  id: string
  name: string
  avatarUrl?: string | null
}

export interface RealtimeActivityPayload<T> {
  actor: ActivityActor
  data: T
}
```

`CHART_SWITCHED` is history/activity only and not undoable.

---

## Undo Model

Undo must not assume every history event is reversible. It filters to `undoable: true`.

Supported inverse operations for this PR:

| Event | Inverse |
|-------|---------|
| `NOTE_CREATED` | soft delete the note |
| `NOTE_DELETED` | restore note from `beforeState` if slot is free |
| `NOTE_UPDATED` | patch note back to `beforeState` |
| `SECTION_CREATED` | delete the section |
| `SECTION_DELETED` | recreate section from `beforeState` |
| `SECTION_UPDATED` | patch section back to `beforeState` |

Non-undoable V1 event:

| Event | Reason |
|-------|--------|
| `CHART_SWITCHED` | UI/presence activity, not document state |

Undo algorithm:

1. Resolve song/chart access.
2. Find the latest event for the current user in scope where `undoable = true` and `undoneByEventId IS NULL`.
3. If the event has `batchId`, undo all undoable events in that batch in reverse order.
4. Apply inverse operations through domain services or a dedicated `UndoService`.
5. Write compensating editor events with a new `batchId` for batch undo.
6. Mark original event rows as undone via `undoneByEventId`.
7. Broadcast normal realtime payloads so peers update through existing paths.

Conflict behavior:

- Restoring a deleted note/section can fail if the target slot or section identity now conflicts. In that case, skip that item and continue the batch.
- If nothing in a batch can be undone, return `404 Nothing to undo`.
- Preserve the existing per-user undo behavior; undo does not revert other users' actions.

---

## Activity Aggregation

**File:** `packages/shared/src/activity/aggregate-actions.ts`

```ts
export interface ActivityAction {
  type: EditorEventType
  at: number
  weight: number
  label: string
}

export interface ActivityBurst {
  actor: ActivityActor
  actions: ActivityAction[]
  windowStartedAt: number
  total: number
}

export type ActivityPushResult =
  | { kind: 'individual'; action: ActivityAction; actor: ActivityActor; toastId: string }
  | { kind: 'burst'; burst: ActivityBurst; replacedToastIds: string[] }
  | { kind: 'burst-update'; burst: ActivityBurst }
  | { kind: 'ignored' }
```

Rules:

- Maintain one window per `actor.id`.
- Window length is 30 seconds from the first action.
- Actions 1-3 emit individual results.
- The 4th action emits `burst` and returns the toast IDs of the previous individual toasts so the UI can dismiss them.
- Actions after the 4th in the same window emit `burst-update`.
- Batch actions can have `weight > 1`; a 15-note paste crosses the threshold immediately.
- A new action after the 30-second window starts a fresh window.

Toast behavior:

- Individual toast IDs: `activity-${actor.id}-${windowStartedAt}-${index}`.
- Burst toast ID: `activity-${actor.id}`.
- On `burst`, dismiss the previous individual toast IDs, then show/update the burst toast.
- On `burst-update`, update the existing burst toast.
- Dismiss burst toast 5 seconds after the last action in the window.
- Skip all live toasts when `actor.id === currentUserId`.

Copy:

| Action | Message |
|--------|---------|
| Note created | `{name} added a note at Track {track}, {time}s` |
| Note updated | `{name} edited a note at Track {track}, {time}s` |
| Note deleted | `{name} removed a note at Track {track}, {time}s` |
| Section created | `{name} added section "{sectionName}"` |
| Section updated | `{name} updated section "{sectionName}"` |
| Section deleted | `{name} removed a section` |
| Chart switched | `{name} switched to chart "{chartName}"` |
| Burst | `{name} did {n} actions` |

Show exact counts through 999. At 1000 or more, show `999+ actions`.

---

## Backend Changes

### 1. Editor Event Ledger

Add an `EditorEventLedgerService` or update the existing `LedgerListener` into a generic ledger writer.

Responsibilities:

- Listen for note, section, and chart activity domain events.
- Write `editor_events` rows with `entityType`, `eventType`, actor, before/after state, batch, and undoable flag.
- Persist `NOTE_UPDATED`; this is currently missing.
- Preserve batch IDs from pattern paste, note copy, AI apply, chart duplication, and undo.

### 2. Actor Enrichment

Realtime payloads for editor mutations must wrap data:

```ts
{
  actor: { id, name, avatarUrl },
  data
}
```

`RealtimeListener` should inject `PrismaService` or a small actor resolver service:

```ts
resolveActor(userId): Promise<ActivityActor>
```

Resolver behavior:

- Look up `User.id`, `name`, `avatarUrl`.
- Cache actors in a request/listener-local `Map` to avoid repeated burst lookups.
- Fallback to `{ id: userId, name: 'Someone', avatarUrl: null }`.

### 3. Realtime Events

Wrap these existing broadcasts:

| Socket event | Payload data |
|--------------|--------------|
| `note-created` | `Note` |
| `note-updated` | `Note` |
| `note-deleted` | `{ noteId, beforeState? }` |
| `notes-batch-applied` | `NotesBatchAppliedPayload` |
| `section-created` | `SectionMarker` |
| `section-updated` | `SectionMarker` |
| `section-deleted` | `{ id, beforeState? }` |

Add:

```
Client -> chart-switch { songId, chartId, chartName }
Server -> chart-switched { actor, data: { chartId, chartName } }
```

Validation:

- User must be authenticated.
- User must already be allowed to view the song/chart.
- Server broadcasts to `song:${songId}` except sender.
- `CHART_SWITCHED` writes an `editor_events` row with `undoable = false`.

### 4. Batch Coverage

The following operations must emit one batch summary for realtime activity and ledger grouping:

- Pattern paste
- Note copy apply
- AI chart apply
- Undo batch
- Chart duplication if duplicated notes are broadcast/history-visible

If chart duplication should not be visible in live activity, document it as excluded and keep it out of success criteria.

---

## Frontend Changes

### 1. Payload Normalization

**File:** `apps/web/src/features/collaboration/activity-payload.ts`

```ts
export function unwrapActivityPayload<T>(
  payload: T | RealtimeActivityPayload<T>,
): { actor: ActivityActor | null; data: T } {
  if (
    payload &&
    typeof payload === 'object' &&
    'actor' in payload &&
    'data' in payload
  ) {
    return payload as RealtimeActivityPayload<T>
  }
  return { actor: null, data: payload as T }
}
```

`useSocket` must use this adapter for every wrapped event so cache updates continue to work for both legacy and wrapped payloads during rollout.

### 2. `useActivityNotices`

**File:** `apps/web/src/features/collaboration/useActivityNotices.ts`

Preferred wiring: `useSocket` owns socket subscriptions and invokes optional activity callbacks after normal cache updates. This avoids registering duplicate handlers in two hooks.

`useActivityNotices` owns:

- One `ActivityAggregator` instance.
- Current user filtering.
- Toast creation/update/dismissal.
- Burst timers.
- Clearing buffers on disconnect/reconnect.
- Dismissing `activity-${userId}` on `user-left`.

### 3. History Panel

History fetches `editor_events`, not `note_events`.

API response row:

```ts
interface EditorEventRow {
  id: string
  songId: string
  chartId?: string | null
  entityType: EditorEntityType
  entityId?: string | null
  eventType: EditorEventType
  userId: string
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  batchId?: string | null
  undoable: boolean
  undoneByEventId?: string | null
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string | null }
}
```

`groupHistoryEvents(events)`:

- Walk newest-first.
- Group consecutive rows by same `userId` inside a 30-second window.
- Collapse groups with total action count >= 4.
- Use batch size when a batch can be represented as one logical history row; otherwise count the individual rows.
- Show 1-3 actions as normal individual rows.
- Burst rows are collapsed by default and expandable.

History labels:

- Notes: use track/time from before/after state.
- Sections: use section label from before/after state.
- Chart switch: show chart name, but no undo affordance.
- Undone rows can be visually muted or marked as undone in a later PR; V1 only needs to avoid undoing them again.

### 4. History Refresh

On realtime mutation events, invalidate or debounce-refetch `['events', songId]` / `['events', chartId]`.

Debounce to 2 seconds for batch-heavy operations to avoid fetch storms.

---

## Data Flows

### Single note create

```
NotesService.create
  -> emits NOTE_CREATED { userId, afterState }
  -> EditorEventLedger writes NOTE_CREATED undoable row
  -> RealtimeListener broadcasts note-created { actor, data: note }
  -> Peer useSocket updates notes cache
  -> Peer activity aggregator shows individual or burst toast
```

### Pattern paste

```
PatternPasteService.apply
  -> emits batch-mode NOTE_DELETED / NOTE_CREATED events with one batchId
  -> emits BATCH_APPLIED { actorId, created, deletedIds }
  -> EditorEventLedger writes one row per note mutation with same batchId
  -> RealtimeListener broadcasts notes-batch-applied { actor, data }
  -> Peer activity aggregator counts created.length + deletedIds.length
  -> History groups the batch rows into one expandable burst row
```

### Undo

```
UndoService.undo
  -> finds latest undoable event/batch for current user
  -> applies inverse operations
  -> writes compensating editor event/batch
  -> marks original event(s) undone
  -> broadcasts normal realtime updates
```

---

## Error Handling & Edge Cases

| Case | Behavior |
|------|----------|
| Missing actor on legacy payload | Cache update still runs; live toast is skipped; dev warning once |
| Current user event | No live toast; History still records it |
| Same user, two tabs | No live toast in same-user tab; History records both tabs' document changes |
| Batch + individual events | `realtimeMode: 'batch'` suppresses individual socket broadcasts; batch payload drives live activity |
| User leaves mid-burst | Dismiss `activity-${userId}` and clear that actor buffer |
| Disconnect/reconnect | Clear aggregator buffers; no retroactive live toasts |
| Undo restore conflict | Skip conflicting item; if no item undone, return `Nothing to undo` |
| History pagination | Group within loaded pages; a burst may split at page boundaries in V1 |

---

## Testing

### Shared Unit Tests

`aggregate-actions.test.ts`:

- 3 actions produce 3 individual results.
- 4th action within 30 seconds produces burst and returns prior individual toast IDs.
- 5th action produces burst-update.
- Action after 31 seconds starts a new window.
- Batch weight 15 produces one immediate burst.
- Current-user filtering is handled by caller, not aggregator.

`group-history-events.test.ts`:

- 1-3 events stay individual.
- 4+ same-user events within 30 seconds collapse.
- Different users do not group.
- Different batches do not merge incorrectly.
- Mixed note/section rows group by actor and time.
- Undone rows do not affect undo eligibility.

### API Tests

- Ledger writes `NOTE_CREATED`, `NOTE_UPDATED`, `NOTE_DELETED`.
- Ledger writes section create/update/delete rows.
- `CHART_SWITCHED` row is `undoable = false`.
- Realtime note/section/batch payloads include `actor`.
- Legacy cache data shape is no longer emitted after rollout.
- Undo supports note update inverse.
- Undo supports section create/update/delete inverse.
- Batch undo marks original events undone and writes compensating batch rows.

### Manual Smoke

1. Two users in same song: User A adds 3 notes, User B sees 3 individual toasts.
2. User A adds a 4th note within 30 seconds, User B sees prior individual toasts replaced by one burst toast.
3. User A pastes a large pattern, User B sees one burst toast with correct count.
4. User A edits a note, User B sees edit activity; History contains `NOTE_UPDATED`.
5. User A creates/edits/deletes a section, User B sees live activity; History records section rows.
6. User A switches chart, User B sees live activity; History records non-undoable chart switch.
7. User A triggers undo; the latest undoable event or batch reverts and cannot be undone twice.
8. Same account in two tabs does not show live toasts for own actions.

---

## File Map

| File | Action |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `EditorEvent`; migrate from `NoteEvent` |
| `apps/api/src/modules/ledger/ledger.listener.ts` | Convert to generic editor-event writer |
| `apps/api/src/modules/notes/notes.service.ts` | Move undo orchestration toward generic undo service or emit enough update state |
| `apps/api/src/modules/sections/sections.service.ts` | Emit userId + before/after state |
| `apps/api/src/modules/sections/sections.listener.ts` | Broadcast wrapped section payloads |
| `apps/api/src/modules/realtime/realtime.listener.ts` | Resolve actor and wrap note/batch payloads |
| `apps/api/src/modules/realtime/realtime.gateway.ts` | Add validated `chart-switch` handler |
| `packages/shared/src/events.ts` | Add generic editor event/activity payload types |
| `packages/shared/src/activity/aggregate-actions.ts` | New activity aggregation |
| `packages/shared/src/activity/group-history-events.ts` | New history grouping |
| `packages/shared/src/activity/index.ts` | New re-export |
| `packages/shared/src/index.ts` | Export activity module |
| `apps/web/src/features/collaboration/activity-payload.ts` | New unwrap helper |
| `apps/web/src/features/collaboration/useActivityNotices.ts` | New toast orchestration |
| `apps/web/src/features/collaboration/useSocket.ts` | Normalize wrapped payloads; forward activity events |
| `apps/web/src/features/editor/components/HistoryPanel.tsx` | Fetch editor events; grouped rows; undoable affordance |
| `apps/web/src/pages/EditorPage.tsx` | Wire activity notices; emit chart switch |
| `apps/web/src/styles/globals.css` | Optional `.ama-toast--activity` variant |

---

## V1 Limits

- No server-side burst aggregation.
- No click-to-jump from activity toast to note/section.
- No settings toggle for activity toasts.
- History grouping may split across pagination boundaries.
- Undo supports only the event types listed in this spec.
- Chart switch is recorded for history/activity but is not undoable.

---

## Success Criteria

- [ ] 1-3 remote collaborator actions show individual activity toasts.
- [ ] On the 4th action within 30 seconds, prior individual toasts are dismissed and replaced by one burst toast.
- [ ] Batch operations show one burst toast with `created.length + deletedIds.length` count.
- [ ] Current user never sees live toasts for their own actions.
- [ ] History uses `editor_events` and can show notes, sections, and chart switches.
- [ ] History groups 4+ same-user actions within 30 seconds with expandable details.
- [ ] `NOTE_UPDATED` is persisted and appears in History.
- [ ] Undo works for note create/delete/update and section create/delete/update.
- [ ] Non-undoable events, such as chart switch, are skipped by undo.
- [ ] Shared unit tests, API tests, web build, and API build pass.
