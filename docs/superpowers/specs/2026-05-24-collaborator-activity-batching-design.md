# Design: Collaborator Activity Batching (Live Toasts + History)

**Date:** 2026-05-24  
**Scope:** Single PR — live activity notices + History panel grouping  
**Status:** Draft — pending user review

---

## Problem Summary

When a collaborator edits rapidly (pattern paste, multi-select delete, AI apply), the editor currently:

1. **Has no live activity toasts** for remote edits (roadmap item never built).
2. **History panel** lists every ledger event individually — a 20-note paste produces 20 rows like *"Ho Hoang Huy added a note at Track 3, 42.5s"*, which is noisy and hard to scan.

**Goal:** Show human-readable activity notices with avatar, but **batch bursts** into a summary when someone does **4+ actions within 30 seconds**.

---

## Decisions (from brainstorming)

| Question | Choice |
|----------|--------|
| Where? | **Both** — live toast near toolbar + grouped History rows |
| Grouping rule | **4+ actions within 30s**, then reset window |
| Action scope | **All meaningful editor mutations** (notes, sections, batch ops, undo, chart switch) |
| Toast audience | **Collaborators only** — never toast your own actions |
| History audience | **Everyone** — group your own bursts too |

**Out of scope:** Panel toggles, playback, zoom, cursor moves, validation re-runs, theme changes.

---

## Architecture

### Approach: Frontend aggregator + enriched WS payloads (Option A)

```
WebSocket event (with actor)
        │
        ▼
useActivityNotices hook
        │
        ├── ActivityAggregator (packages/shared) — per-user sliding window
        │
        ├── count < 4  → individual toast (collaborators only)
        └── count ≥ 4  → summary toast, update in place while burst continues
        │
HistoryPanel
        │
        └── groupHistoryEvents() — same 4+/30s rule on fetched ledger rows
```

No Redis burst detection on server for V1. Batch accuracy comes from enriched payloads (`notes-batch-applied` already has `actorId`; count = `created.length + deletedIds.length`).

---

## Shared: `ActivityAggregator`

**File:** `packages/shared/src/activity/aggregate-actions.ts`

```ts
export interface ActivityActor {
  id: string
  name: string
  avatarUrl?: string | null
}

export interface ActivityAction {
  type: string          // e.g. 'note-created', 'section-deleted', 'chart-switched'
  at: number            // epoch ms
  label: string         // human line for expand list / individual toast
}

export interface ActivityBurst {
  actor: ActivityActor
  actions: ActivityAction[]
  windowStartedAt: number
}

export type ActivityPushResult =
  | { kind: 'individual'; action: ActivityAction; actor: ActivityActor }
  | { kind: 'burst'; burst: ActivityBurst; total: number }
  | { kind: 'burst-update'; burst: ActivityBurst; total: number }
  | { kind: 'ignored' }   // below threshold, collaborator filter, etc.
```

**Rules:**

- Per `actor.id`, maintain a sliding buffer of actions with timestamps.
- Drop actions older than **30s** from the window start (reset window when buffer empties).
- **1–3 actions in window:** emit `individual` for each new action (live toast path only).
- **4+ actions in window:** emit `burst` on crossing threshold; subsequent actions in same window emit `burst-update`.
- **History grouping** uses the same buffer logic over a sorted event list (offline, not streaming).

**Action weights:**

| Event | Count |
|-------|-------|
| `note-created` | 1 |
| `note-updated` | 1 |
| `note-deleted` | 1 |
| `notes-batch-applied` | `created.length + deletedIds.length` |
| `section-created` / `section-updated` / `section-deleted` | 1 |
| `chart-switched` | 1 |

Undo is counted via the resulting `note-deleted` (or compensating) event — no separate weight.

---

## Backend Changes

### 1. Enrich realtime payloads with `actor`

All song-room broadcasts that represent editor mutations wrap payload:

```ts
interface RealtimeActivityPayload<T> {
  actor: { id: string; name: string; avatarUrl?: string | null }
  data: T
}
```

**Files:**

| File | Change |
|------|--------|
| `apps/api/src/modules/realtime/realtime.listener.ts` | Pass `actor` from domain events into broadcasts |
| `apps/api/src/modules/sections/sections.listener.ts` | Include `actor` on section events (from service userId) |
| `apps/api/src/modules/sections/sections.service.ts` | Emit `userId` on section domain events |

**Note events:** `NoteCreatedEvent`, `NoteUpdatedEvent`, `NoteDeletedEvent` already carry `userId`. Listener resolves user name/avatar once per broadcast (or passes through from service).

**Batch events:** `NotesBatchAppliedPayload.actorId` already exists — use it.

### 2. New event: `chart-switched`

When a user changes active chart while in a song room, peers should know.

```
Client → chart-switch { songId, chartId, chartName }
Server → broadcast chart-switched { actor, data: { chartId, chartName } }
```

**Files:**

- `apps/api/src/modules/realtime/realtime.gateway.ts` — `@SubscribeMessage('chart-switch')` handler
- `apps/web/src/features/collaboration/useSocket.ts` — emit on chart change (from `EditorPage` / store)
- `apps/web` — listen and feed aggregator

Chart switch is **not** written to `NoteEvent` ledger — live toast only. History does not show chart switches in V1 (no ledger row). Document as known limitation.

### 3. Backward compatibility

Frontend accepts both legacy bare payloads and `{ actor, data }` during rollout. Aggregator normalizes in one adapter function.

---

## Frontend Components

### `useActivityNotices(songId, currentUserId)`

**File:** `apps/web/src/features/collaboration/useActivityNotices.ts`

- Called from `EditorPage` alongside `useSocket`.
- Registers handlers on socket events (or receives callbacks from extended `useSocket`).
- Maintains one `ActivityAggregator` instance per mount.
- **Toast behavior (Sonner):**
  - Individual: `toast()` with `className: 'ama-toast'`, avatar + one-line label, 4s duration.
  - Burst: stable toast id `activity-${actor.id}` — `toast()` updates message: *"{name} did {n} actions"*.
  - Burst dismiss: 5s after last action in window (reset timer on `burst-update`).
  - Skip entirely when `actor.id === currentUserId`.

**Individual toast copy (exact strings):**

| Action | Message |
|--------|---------|
| Note created | `{name} added a note at Track {track}, {time}s` |
| Note updated | `{name} edited a note at Track {track}, {time}s` |
| Note deleted | `{name} removed a note at Track {track}, {time}s` |
| Section created | `{name} added section "{sectionName}"` |
| Section updated | `{name} renamed section to "{sectionName}"` |
| Section deleted | `{name} removed a section` |
| Chart switched | `{name} switched to chart "{chartName}"` |

**Burst toast copy:**

> `{name} did {n} actions`

Use `{n}+` only when count exceeds 99? No — show exact count up to 999; at 1000+ show *"999+ actions"*.

### `HistoryPanel` grouping

**File:** `apps/web/src/features/editor/components/HistoryPanel.tsx`

After flattening paginated events, run `groupHistoryEvents(events)`:

- Walk newest-first.
- Consecutive rows from same `userId` within 30s: if grouped count ≥ 4, collapse into one **burst row**.
- Burst row UI:
  - Avatar + *"{name} did {n} actions"* + relative time of most recent action in group.
  - Chevron expand → nested list of individual `eventLabel()` lines (indented, smaller text).
  - Collapsed by default.
- Rows with 1–3 actions in a window stay individual (unchanged UI).

**Ledger note:** History API returns `NOTE_CREATED | NOTE_UPDATED | NOTE_DELETED` only. Section/chart actions do not appear in History V1.

---

## Data Flow

```
Collaborator creates note
  → NotesService emits NOTE_CREATED { userId, afterState }
  → RealtimeListener broadcasts note-created { actor, data: note }
  → Peer useActivityNotices
       → aggregator.push → individual toast (if 1–3) or burst toast (if 4+)
  → Peer useSocket updates TanStack Query cache (unchanged)

Collaborator pastes pattern (12 creates, 3 deletes)
  → BATCH_APPLIED { actorId, created[12], deletedIds[3] }
  → RealtimeListener broadcasts notes-batch-applied { actor, data: payload }
  → Peer aggregator counts 15 actions in one push
       → immediate burst toast "{name} did 15 actions"
  → History: 15 ledger rows grouped into one expandable burst row on next fetch/refetch
```

**History refresh:** On `note-created` / `note-deleted` / batch events, invalidate `['events', chartId]` so panel picks up new rows (debounced 2s to avoid refetch storms during paste).

---

## Error Handling & Edge Cases

| Case | Behavior |
|------|----------|
| Same user, two tabs | Each tab's actions broadcast separately — may double-count bursts. **Accept for V1**; server-side dedup is future work. |
| Batch + individual events | `realtimeMode: 'batch'` suppresses individual note-created/deleted WS events — only batch counts. Already implemented. |
| Missing actor on legacy payload | Skip toast; log dev warning once. |
| User leaves mid-burst | Flush burst toast; do not leave stale updating toast. Listen `user-left` → dismiss `activity-${userId}`. |
| Offline / reconnect | Clear aggregator buffers; no retroactive burst toasts. |
| History pagination | Group within each loaded page; burst row may split at page boundary. **Accept for V1** — rare for 4+ events to span page break exactly. |

---

## Testing

### Unit (`packages/shared`)

- `aggregate-actions.test.ts`:
  - 3 actions → 3 individual results
  - 4th action within 30s → burst with total 4
  - 5th action → burst-update with total 5
  - Action at 31s → new window, individual again
  - Batch of 15 → single burst with total 15
  - `groupHistoryEvents` mirrors streaming results on static list

### API

- RealtimeListener spec: broadcasts include `actor` shape
- Gateway spec: `chart-switch` joins room validation

### Manual smoke

1. Two tabs, same song — Tab A adds 3 notes → Tab B sees 3 individual toasts.
2. Tab A adds 4th note within 30s → Tab B sees one *"did 4 actions"* toast (not a 4th individual).
3. Tab A pastes large pattern → Tab B sees single burst toast with correct count.
4. Tab A edits — Tab B (same user, second tab) sees **no** toast.
5. History panel shows grouped row with expand for 4+ events; 1–3 stay separate.

---

## File Map

| File | Action |
|------|--------|
| `packages/shared/src/activity/aggregate-actions.ts` | **New** — core grouping logic |
| `packages/shared/src/activity/aggregate-actions.test.ts` | **New** — unit tests |
| `packages/shared/src/activity/index.ts` | **New** — re-export |
| `packages/shared/src/index.ts` | Export activity module |
| `packages/shared/src/types.ts` | Add `RealtimeActivityPayload`, `ActivityActor` |
| `apps/api/src/modules/realtime/realtime.listener.ts` | Wrap broadcasts with actor |
| `apps/api/src/modules/sections/sections.listener.ts` | Actor on section events |
| `apps/api/src/modules/sections/sections.service.ts` | Pass userId on domain events |
| `apps/api/src/modules/realtime/realtime.gateway.ts` | `chart-switch` handler |
| `apps/web/src/features/collaboration/useActivityNotices.ts` | **New** — toast orchestration |
| `apps/web/src/features/collaboration/useSocket.ts` | Normalize payloads; expose event hooks or inline handlers |
| `apps/web/src/features/editor/components/HistoryPanel.tsx` | Grouped rows + expand |
| `apps/web/src/pages/EditorPage.tsx` | Wire `useActivityNotices`; emit chart-switch |
| `apps/web/src/styles/globals.css` | Optional `.ama-toast--activity` variant |

---

## YAGNI / V1 Limits

- No server-side burst aggregation.
- No chart-switch or section rows in History (no ledger entries).
- No user preference to disable activity toasts (future settings toggle).
- No click-to-jump from toast to affected note.

---

## Success Criteria

- [ ] Collaborator burst (4+ actions / 30s) produces **one** live toast, not N toasts.
- [ ] 1–3 actions produce individual toasts with correct copy.
- [ ] Current user never sees live toasts for own actions.
- [ ] History groups 4+ consecutive same-user events with expand detail.
- [ ] Pattern paste / batch apply counts all created + deleted notes.
- [ ] All shared unit tests pass; API tests pass; manual smoke checklist passes.
