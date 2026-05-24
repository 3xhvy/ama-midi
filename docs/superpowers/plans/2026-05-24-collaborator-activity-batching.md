# Collaborator Activity Batching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build collaborator activity toasts, grouped History rows, and a generic editor-event ledger that supports richer undo.

**Architecture:** Replace the note-only ledger with an `EditorEvent` ledger that records notes, sections, and chart-switch activity. Realtime broadcasts are wrapped with `{ actor, data }`; the web app unwraps payloads for cache updates and feeds a shared activity aggregator for toasts and History grouping. Undo uses only `undoable` editor events with explicit inverse operations.

**Tech Stack:** Prisma + NestJS + EventEmitter2 + Socket.IO on the API; React + TanStack Query + Sonner + Socket.IO client on the web; shared TypeScript package for event/activity types and grouping logic.

---

## File Structure

**Shared package**
- Modify: `packages/shared/src/events.ts` - add generic editor event/activity types while preserving existing note event constants during migration.
- Create: `packages/shared/src/activity/aggregate-actions.ts` - streaming activity burst aggregator.
- Create: `packages/shared/src/activity/group-history-events.ts` - offline grouping for History rows.
- Create: `packages/shared/src/activity/index.ts` - activity exports.
- Modify: `packages/shared/src/index.ts` - export activity helpers.
- Create: `packages/shared/src/activity/aggregate-actions.test.ts` - shared unit tests.
- Create: `packages/shared/src/activity/group-history-events.test.ts` - shared unit tests.

**API**
- Modify: `apps/api/prisma/schema.prisma` - add `EditorEvent` model and keep `NoteEvent` until all code is moved.
- Create: `apps/api/prisma/migrations/20260524180000_editor_events/migration.sql` - create/backfill `editor_events`.
- Modify: `apps/api/src/modules/ledger/ledger.listener.ts` - write generic editor events for note events.
- Create: `apps/api/src/modules/ledger/editor-event.service.ts` - helper for writing/querying/marking editor events.
- Create: `apps/api/src/modules/ledger/editor-event.types.ts` - local DTO/type helpers for Prisma JSON states.
- Modify: `apps/api/src/modules/ledger/ledger.module.ts` - provide/export editor event service.
- Modify: `apps/api/src/modules/notes/notes.service.ts` - delegate undo to a generic undo service and include update events in ledger.
- Create: `apps/api/src/modules/undo/undo.service.ts` - inverse operations for note/section events.
- Create: `apps/api/src/modules/undo/undo.module.ts` - module registration.
- Modify: `apps/api/src/app.module.ts` or `apps/api/src/modules/notes/notes.module.ts` - import undo/ledger modules where needed.
- Modify: `apps/api/src/modules/sections/sections.service.ts` - emit section events with userId and before/after state.
- Modify: `apps/api/src/modules/sections/sections.listener.ts` - broadcast wrapped section events.
- Modify: `apps/api/src/modules/realtime/realtime.listener.ts` - resolve actor and wrap note/batch payloads.
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts` - add validated `chart-switch` handler.
- Modify: `apps/api/src/modules/notes/notes.controller.ts` - `GET /events` reads editor events, `POST /events/undo` calls generic undo.
- Add/modify API tests under `apps/api/src/modules/**/__tests__`.

**Web**
- Create: `apps/web/src/features/collaboration/activity-payload.ts` - unwrap legacy/wrapped payloads.
- Create: `apps/web/src/features/collaboration/useActivityNotices.ts` - toast orchestration.
- Modify: `apps/web/src/features/collaboration/useSocket.ts` - unwrap payloads, keep cache updates, forward activity callbacks, emit chart switch.
- Modify: `apps/web/src/features/editor/components/HistoryPanel.tsx` - render grouped editor events.
- Modify: `apps/web/src/pages/EditorPage.tsx` - wire activity notices and chart switch.
- Modify: `apps/web/src/styles/globals.css` - optional activity toast class.

---

## Task 1: Shared Editor Event Types

**Files:**
- Modify: `packages/shared/src/events.ts`

- [ ] **Step 1: Extend shared event types**

Append these exports below the existing `NotesBatchAppliedPayload` interface in `packages/shared/src/events.ts`:

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

export interface EditorEventRow {
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

- [ ] **Step 2: Run shared type check through web build**

Run: `pnpm --filter @ama-midi/web build`

Expected: PASS or unrelated existing build warning only. If TypeScript fails because shared exports are not referenced yet, fix the export shape before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/events.ts
git commit -m "feat(shared): add editor activity event types"
```

---

## Task 2: Shared Activity Aggregator

**Files:**
- Create: `packages/shared/src/activity/aggregate-actions.ts`
- Create: `packages/shared/src/activity/index.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/activity/aggregate-actions.test.ts`

- [ ] **Step 1: Write failing aggregator tests**

Create `packages/shared/src/activity/aggregate-actions.test.ts`:

```ts
import { ActivityAggregator } from './aggregate-actions'
import type { ActivityActor } from '../events'

const actor: ActivityActor = { id: 'u1', name: 'Huy', avatarUrl: null }

function action(at: number, weight = 1) {
  return {
    type: 'NOTE_CREATED' as const,
    at,
    weight,
    label: `note at ${at}`,
  }
}

describe('ActivityAggregator', () => {
  it('emits individual results for the first three actions', () => {
    const agg = new ActivityAggregator()
    expect(agg.push(actor, action(1000)).kind).toBe('individual')
    expect(agg.push(actor, action(2000)).kind).toBe('individual')
    const third = agg.push(actor, action(3000))
    expect(third).toMatchObject({ kind: 'individual' })
  })

  it('replaces the first three toasts when the fourth action crosses the burst threshold', () => {
    const agg = new ActivityAggregator()
    agg.push(actor, action(1000))
    agg.push(actor, action(2000))
    agg.push(actor, action(3000))

    const result = agg.push(actor, action(4000))

    expect(result.kind).toBe('burst')
    if (result.kind !== 'burst') throw new Error('expected burst')
    expect(result.burst.total).toBe(4)
    expect(result.replacedToastIds).toEqual([
      'activity-u1-1000-0',
      'activity-u1-1000-1',
      'activity-u1-1000-2',
    ])
  })

  it('emits burst updates after the threshold', () => {
    const agg = new ActivityAggregator()
    agg.push(actor, action(1000))
    agg.push(actor, action(2000))
    agg.push(actor, action(3000))
    agg.push(actor, action(4000))

    const result = agg.push(actor, action(5000))

    expect(result.kind).toBe('burst-update')
    if (result.kind !== 'burst-update') throw new Error('expected update')
    expect(result.burst.total).toBe(5)
  })

  it('starts a new window after thirty seconds from the first action', () => {
    const agg = new ActivityAggregator()
    agg.push(actor, action(1000))
    agg.push(actor, action(2000))
    agg.push(actor, action(3000))

    const result = agg.push(actor, action(32001))

    expect(result.kind).toBe('individual')
    if (result.kind !== 'individual') throw new Error('expected individual')
    expect(result.toastId).toBe('activity-u1-32001-0')
  })

  it('uses weight to create an immediate burst for a large batch', () => {
    const agg = new ActivityAggregator()
    const result = agg.push(actor, {
      type: 'NOTE_CREATED',
      at: 1000,
      weight: 15,
      label: '15 pasted notes',
    })

    expect(result.kind).toBe('burst')
    if (result.kind !== 'burst') throw new Error('expected burst')
    expect(result.burst.total).toBe(15)
    expect(result.replacedToastIds).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @ama-midi/api test -- aggregate-actions`

Expected: FAIL because `aggregate-actions.ts` does not exist or `ActivityAggregator` is not exported.

- [ ] **Step 3: Implement the aggregator**

Create `packages/shared/src/activity/aggregate-actions.ts`:

```ts
import type { ActivityActor, EditorEventType } from '../events'

const BURST_THRESHOLD = 4
const WINDOW_MS = 30_000

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

interface ActorWindow {
  actor: ActivityActor
  actions: ActivityAction[]
  windowStartedAt: number
  total: number
  burstStarted: boolean
  individualToastIds: string[]
}

export class ActivityAggregator {
  private windows = new Map<string, ActorWindow>()

  push(actor: ActivityActor, action: ActivityAction): ActivityPushResult {
    const current = this.windows.get(actor.id)
    const window =
      current && action.at - current.windowStartedAt <= WINDOW_MS
        ? current
        : {
            actor,
            actions: [],
            windowStartedAt: action.at,
            total: 0,
            burstStarted: false,
            individualToastIds: [],
          }

    window.actor = actor
    window.actions.push(action)
    window.total += Math.max(1, action.weight)
    this.windows.set(actor.id, window)

    const burst: ActivityBurst = {
      actor,
      actions: [...window.actions],
      windowStartedAt: window.windowStartedAt,
      total: window.total,
    }

    if (window.total >= BURST_THRESHOLD) {
      if (!window.burstStarted) {
        window.burstStarted = true
        const replacedToastIds = [...window.individualToastIds]
        window.individualToastIds = []
        return { kind: 'burst', burst, replacedToastIds }
      }
      return { kind: 'burst-update', burst }
    }

    const toastId = `activity-${actor.id}-${window.windowStartedAt}-${window.individualToastIds.length}`
    window.individualToastIds.push(toastId)
    return { kind: 'individual', action, actor, toastId }
  }

  clear(actorId?: string) {
    if (actorId) this.windows.delete(actorId)
    else this.windows.clear()
  }
}
```

Create `packages/shared/src/activity/index.ts`:

```ts
export * from './aggregate-actions'
```

Add to `packages/shared/src/index.ts`:

```ts
export * from './activity'
```

- [ ] **Step 4: Run test and build**

Run: `pnpm --filter @ama-midi/api test -- aggregate-actions`

Expected: PASS.

Run: `pnpm --filter @ama-midi/web build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/activity/aggregate-actions.ts packages/shared/src/activity/aggregate-actions.test.ts packages/shared/src/activity/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): add activity burst aggregator"
```

---

## Task 3: Shared History Grouping

**Files:**
- Create: `packages/shared/src/activity/group-history-events.ts`
- Test: `packages/shared/src/activity/group-history-events.test.ts`
- Modify: `packages/shared/src/activity/index.ts`

- [ ] **Step 1: Write failing History grouping tests**

Create `packages/shared/src/activity/group-history-events.test.ts`:

```ts
import { groupHistoryEvents } from './group-history-events'
import type { EditorEventRow } from '../events'

function row(id: string, userId: string, createdAt: string, eventType = 'NOTE_CREATED'): EditorEventRow {
  return {
    id,
    songId: 'song-1',
    chartId: 'chart-1',
    entityType: 'NOTE',
    entityId: id,
    eventType: eventType as EditorEventRow['eventType'],
    userId,
    beforeState: null,
    afterState: { track: 1, time: 1 },
    batchId: null,
    undoable: true,
    undoneByEventId: null,
    createdAt,
    user: { id: userId, name: userId, avatarUrl: null },
  }
}

describe('groupHistoryEvents', () => {
  it('leaves one to three events as individual rows', () => {
    const grouped = groupHistoryEvents([
      row('e3', 'u1', '2026-05-24T10:00:03.000Z'),
      row('e2', 'u1', '2026-05-24T10:00:02.000Z'),
      row('e1', 'u1', '2026-05-24T10:00:01.000Z'),
    ])

    expect(grouped).toHaveLength(3)
    expect(grouped.every(item => item.kind === 'event')).toBe(true)
  })

  it('groups four same-user events within thirty seconds', () => {
    const grouped = groupHistoryEvents([
      row('e4', 'u1', '2026-05-24T10:00:04.000Z'),
      row('e3', 'u1', '2026-05-24T10:00:03.000Z'),
      row('e2', 'u1', '2026-05-24T10:00:02.000Z'),
      row('e1', 'u1', '2026-05-24T10:00:01.000Z'),
    ])

    expect(grouped).toHaveLength(1)
    expect(grouped[0]).toMatchObject({ kind: 'burst', total: 4 })
  })

  it('does not group different users together', () => {
    const grouped = groupHistoryEvents([
      row('e4', 'u2', '2026-05-24T10:00:04.000Z'),
      row('e3', 'u1', '2026-05-24T10:00:03.000Z'),
      row('e2', 'u1', '2026-05-24T10:00:02.000Z'),
      row('e1', 'u1', '2026-05-24T10:00:01.000Z'),
    ])

    expect(grouped).toHaveLength(4)
  })

  it('starts a new group after thirty seconds', () => {
    const grouped = groupHistoryEvents([
      row('e4', 'u1', '2026-05-24T10:00:40.000Z'),
      row('e3', 'u1', '2026-05-24T10:00:03.000Z'),
      row('e2', 'u1', '2026-05-24T10:00:02.000Z'),
      row('e1', 'u1', '2026-05-24T10:00:01.000Z'),
    ])

    expect(grouped).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @ama-midi/api test -- group-history-events`

Expected: FAIL because `group-history-events.ts` does not exist.

- [ ] **Step 3: Implement grouping**

Create `packages/shared/src/activity/group-history-events.ts`:

```ts
import type { EditorEventRow } from '../events'

const BURST_THRESHOLD = 4
const WINDOW_MS = 30_000

export type GroupedHistoryItem =
  | { kind: 'event'; event: EditorEventRow }
  | {
      kind: 'burst'
      id: string
      actor: EditorEventRow['user']
      events: EditorEventRow[]
      total: number
      createdAt: string
    }

function withinWindow(newest: EditorEventRow, candidate: EditorEventRow) {
  return new Date(newest.createdAt).getTime() - new Date(candidate.createdAt).getTime() <= WINDOW_MS
}

export function groupHistoryEvents(events: EditorEventRow[]): GroupedHistoryItem[] {
  const result: GroupedHistoryItem[] = []
  let i = 0

  while (i < events.length) {
    const first = events[i]
    const group = [first]
    let j = i + 1

    while (j < events.length && events[j].userId === first.userId && withinWindow(first, events[j])) {
      group.push(events[j])
      j += 1
    }

    if (group.length >= BURST_THRESHOLD) {
      result.push({
        kind: 'burst',
        id: `burst-${first.userId}-${first.id}`,
        actor: first.user,
        events: group,
        total: group.length,
        createdAt: first.createdAt,
      })
    } else {
      group.forEach(event => result.push({ kind: 'event', event }))
    }

    i = j
  }

  return result
}
```

Update `packages/shared/src/activity/index.ts`:

```ts
export * from './aggregate-actions'
export * from './group-history-events'
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @ama-midi/api test -- group-history-events aggregate-actions`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/activity/group-history-events.ts packages/shared/src/activity/group-history-events.test.ts packages/shared/src/activity/index.ts
git commit -m "feat(shared): add history event grouping"
```

---

## Task 4: Prisma Editor Event Model and Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260524180000_editor_events/migration.sql`

- [ ] **Step 1: Add Prisma model**

Add this model after `NoteEvent` in `apps/api/prisma/schema.prisma`:

```prisma
model EditorEvent {
  id              String   @id @default(uuid())
  songId          String
  chartId         String?
  entityType      String
  entityId        String?
  eventType       String
  userId          String
  beforeState     Json?
  afterState      Json?
  batchId         String?  @db.Uuid
  replacesEventId String?  @db.Uuid
  undoneByEventId String?  @db.Uuid
  undoable        Boolean  @default(false)
  createdAt       DateTime @default(now())

  song Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@index([songId, createdAt])
  @@index([chartId, createdAt])
  @@index([batchId])
  @@index([userId, createdAt])
  @@map("editor_events")
}
```

- [ ] **Step 2: Add migration SQL**

Create `apps/api/prisma/migrations/20260524180000_editor_events/migration.sql`:

```sql
CREATE TABLE "editor_events" (
  "id" TEXT NOT NULL,
  "songId" TEXT NOT NULL,
  "chartId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "eventType" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "beforeState" JSONB,
  "afterState" JSONB,
  "batchId" UUID,
  "replacesEventId" UUID,
  "undoneByEventId" UUID,
  "undoable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "editor_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "editor_events"
ADD CONSTRAINT "editor_events_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "editor_events"
ADD CONSTRAINT "editor_events_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "editor_events_songId_createdAt_idx" ON "editor_events"("songId", "createdAt");
CREATE INDEX "editor_events_chartId_createdAt_idx" ON "editor_events"("chartId", "createdAt");
CREATE INDEX "editor_events_batchId_idx" ON "editor_events"("batchId");
CREATE INDEX "editor_events_userId_createdAt_idx" ON "editor_events"("userId", "createdAt");

INSERT INTO "editor_events" (
  "id",
  "songId",
  "chartId",
  "entityType",
  "entityId",
  "eventType",
  "userId",
  "beforeState",
  "afterState",
  "batchId",
  "undoable",
  "createdAt"
)
SELECT
  "id",
  "songId",
  NULL,
  'NOTE',
  "noteId",
  "eventType"::TEXT,
  "userId",
  "beforeState",
  "afterState",
  "batchId",
  CASE WHEN "eventType" IN ('NOTE_CREATED', 'NOTE_DELETED') THEN true ELSE false END,
  "createdAt"
FROM "note_events";
```

- [ ] **Step 3: Generate Prisma client**

Run: `pnpm --filter @ama-midi/api exec prisma generate`

Expected: Prisma Client generated successfully.

- [ ] **Step 4: Build API**

Run: `pnpm --filter @ama-midi/api build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260524180000_editor_events/migration.sql
git commit -m "feat(api): add editor event ledger schema"
```

---

## Task 5: Editor Event Service and Ledger Listener

**Files:**
- Create: `apps/api/src/modules/ledger/editor-event.types.ts`
- Create: `apps/api/src/modules/ledger/editor-event.service.ts`
- Modify: `apps/api/src/modules/ledger/ledger.listener.ts`
- Modify: `apps/api/src/modules/ledger/ledger.module.ts`
- Test: `apps/api/src/modules/ledger/__tests__/editor-event.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/api/src/modules/ledger/__tests__/editor-event.service.spec.ts`:

```ts
import { EditorEventService } from '../editor-event.service'

describe('EditorEventService', () => {
  const prisma = {
    editorEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any

  beforeEach(() => jest.clearAllMocks())

  it('writes a note created event as undoable', async () => {
    prisma.editorEvent.create.mockResolvedValue({ id: 'event-1' })
    const service = new EditorEventService(prisma)

    await service.record({
      songId: 'song-1',
      chartId: 'chart-1',
      entityType: 'NOTE',
      entityId: 'note-1',
      eventType: 'NOTE_CREATED',
      userId: 'user-1',
      afterState: { id: 'note-1' },
      undoable: true,
    })

    expect(prisma.editorEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        songId: 'song-1',
        chartId: 'chart-1',
        entityType: 'NOTE',
        entityId: 'note-1',
        eventType: 'NOTE_CREATED',
        userId: 'user-1',
        afterState: { id: 'note-1' },
        undoable: true,
      }),
    })
  })

  it('finds latest undoable event for a user', async () => {
    prisma.editorEvent.findMany.mockResolvedValue([{ id: 'event-1', batchId: null }])
    const service = new EditorEventService(prisma)

    const result = await service.findLatestUndoable('song-1', 'user-1', 'chart-1')

    expect(result?.id).toBe('event-1')
    expect(prisma.editorEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        songId: 'song-1',
        userId: 'user-1',
        chartId: 'chart-1',
        undoable: true,
        undoneByEventId: null,
      }),
      orderBy: { createdAt: 'desc' },
      take: 1,
    }))
  })
})
```

- [ ] **Step 2: Run and verify fail**

Run: `pnpm --filter @ama-midi/api test -- editor-event.service`

Expected: FAIL because `EditorEventService` does not exist.

- [ ] **Step 3: Implement service types**

Create `apps/api/src/modules/ledger/editor-event.types.ts`:

```ts
import type { EditorEntityType, EditorEventType } from '@ama-midi/shared'

export interface RecordEditorEventInput {
  songId: string
  chartId?: string | null
  entityType: EditorEntityType
  entityId?: string | null
  eventType: EditorEventType
  userId: string
  beforeState?: object | null
  afterState?: object | null
  batchId?: string | null
  replacesEventId?: string | null
  undoneByEventId?: string | null
  undoable: boolean
}
```

- [ ] **Step 4: Implement service**

Create `apps/api/src/modules/ledger/editor-event.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { RecordEditorEventInput } from './editor-event.types'

@Injectable()
export class EditorEventService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordEditorEventInput) {
    return this.prisma.editorEvent.create({
      data: {
        songId: input.songId,
        chartId: input.chartId ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        eventType: input.eventType,
        userId: input.userId,
        beforeState: input.beforeState ?? undefined,
        afterState: input.afterState ?? undefined,
        batchId: input.batchId ?? null,
        replacesEventId: input.replacesEventId ?? null,
        undoneByEventId: input.undoneByEventId ?? null,
        undoable: input.undoable,
      },
    })
  }

  async findLatestUndoable(songId: string, userId: string, chartId?: string | null) {
    const rows = await this.prisma.editorEvent.findMany({
      where: {
        songId,
        userId,
        ...(chartId ? { chartId } : {}),
        undoable: true,
        undoneByEventId: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })
    return rows[0] ?? null
  }

  findUndoableBatch(songId: string, userId: string, batchId: string) {
    return this.prisma.editorEvent.findMany({
      where: { songId, userId, batchId, undoable: true, undoneByEventId: null },
      orderBy: { createdAt: 'desc' },
    })
  }

  markUndone(eventIds: string[], undoneByEventId: string) {
    return this.prisma.editorEvent.updateMany({
      where: { id: { in: eventIds } },
      data: { undoneByEventId },
    })
  }
}
```

- [ ] **Step 5: Update ledger listener**

Replace `apps/api/src/modules/ledger/ledger.listener.ts` with:

```ts
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { NoteCreatedEvent, NoteDeletedEvent, NoteUpdatedEvent } from '@ama-midi/shared'
import { EditorEventService } from './editor-event.service'

@Injectable()
export class LedgerListener {
  constructor(private readonly editorEvents: EditorEventService) {}

  @OnEvent(NOTE_EVENTS.CREATED)
  onNoteCreated({ songId, noteId, userId, afterState, batchId, replacesNoteId }: NoteCreatedEvent) {
    return this.editorEvents.record({
      songId,
      chartId: afterState.chartId,
      entityType: 'NOTE',
      entityId: noteId,
      eventType: 'NOTE_CREATED',
      userId,
      afterState: afterState as object,
      batchId: batchId ?? null,
      replacesEventId: replacesNoteId ?? null,
      undoable: true,
    })
  }

  @OnEvent(NOTE_EVENTS.UPDATED)
  onNoteUpdated({ songId, noteId, userId, beforeState, afterState }: NoteUpdatedEvent) {
    return this.editorEvents.record({
      songId,
      chartId: afterState.chartId,
      entityType: 'NOTE',
      entityId: noteId,
      eventType: 'NOTE_UPDATED',
      userId,
      beforeState: beforeState as object,
      afterState: afterState as object,
      undoable: true,
    })
  }

  @OnEvent(NOTE_EVENTS.DELETED)
  onNoteDeleted({ songId, noteId, userId, beforeState, batchId }: NoteDeletedEvent) {
    return this.editorEvents.record({
      songId,
      chartId: beforeState.chartId as string | undefined,
      entityType: 'NOTE',
      entityId: noteId,
      eventType: 'NOTE_DELETED',
      userId,
      beforeState: beforeState as object,
      batchId: batchId ?? null,
      undoable: true,
    })
  }
}
```

- [ ] **Step 6: Update module**

Modify `apps/api/src/modules/ledger/ledger.module.ts` so it provides and exports `EditorEventService`:

```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { LedgerListener } from './ledger.listener'
import { EditorEventService } from './editor-event.service'

@Module({
  imports: [PrismaModule],
  providers: [LedgerListener, EditorEventService],
  exports: [EditorEventService],
})
export class LedgerModule {}
```

- [ ] **Step 7: Run tests and build**

Run: `pnpm --filter @ama-midi/api test -- editor-event.service`

Expected: PASS.

Run: `pnpm --filter @ama-midi/api build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/ledger apps/api/src/modules/ledger/__tests__/editor-event.service.spec.ts
git commit -m "feat(api): write generic editor events"
```

---

## Task 6: Generic Undo Service for Notes

**Files:**
- Create: `apps/api/src/modules/undo/undo.service.ts`
- Create: `apps/api/src/modules/undo/undo.module.ts`
- Modify: `apps/api/src/modules/notes/notes.service.ts`
- Modify: `apps/api/src/modules/notes/notes.module.ts`
- Test: `apps/api/src/modules/undo/__tests__/undo.service.spec.ts`

- [ ] **Step 1: Write failing tests for note update undo**

Create `apps/api/src/modules/undo/__tests__/undo.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common'
import { UndoService } from '../undo.service'

describe('UndoService', () => {
  const editorEvents = {
    findLatestUndoable: jest.fn(),
    findUndoableBatch: jest.fn(),
    markUndone: jest.fn(),
    record: jest.fn(),
  }
  const prisma = {
    note: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    sectionMarker: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), delete: jest.fn() },
  }
  const events = { emit: jest.fn() }
  const access = { assertCanEditSongChart: jest.fn() }
  const analyze = { run: jest.fn() }

  beforeEach(() => jest.clearAllMocks())

  it('reverts a note update using beforeState', async () => {
    editorEvents.findLatestUndoable.mockResolvedValue({
      id: 'event-1',
      songId: 'song-1',
      chartId: 'chart-1',
      entityType: 'NOTE',
      entityId: 'note-1',
      eventType: 'NOTE_UPDATED',
      beforeState: {
        id: 'note-1',
        chartId: 'chart-1',
        songId: 'song-1',
        track: 2,
        time: 4,
        title: 'Before',
        description: '',
        noteType: 'TAP',
        createdBy: 'user-1',
      },
      batchId: null,
    })
    prisma.note.findFirst.mockResolvedValue({ id: 'note-1', chartId: 'chart-1', songId: 'song-1', createdBy: 'user-1' })
    prisma.note.update.mockResolvedValue({
      id: 'note-1',
      chartId: 'chart-1',
      songId: 'song-1',
      track: 2,
      time: 4,
      title: 'Before',
      description: '',
      noteType: 'TAP',
      duration: null,
      createdBy: 'user-1',
      createdAt: new Date('2026-05-24T10:00:00Z'),
      updatedAt: new Date('2026-05-24T10:00:01Z'),
      creator: { name: 'Huy', avatarUrl: null },
    })
    editorEvents.record.mockResolvedValue({ id: 'undo-event-1' })

    const service = new UndoService(prisma as any, editorEvents as any, events as any, access as any, analyze as any)

    await service.undo('chart-1', { id: 'user-1', role: 'ADMIN', email: 'a@test.com', name: 'Huy' } as any)

    expect(prisma.note.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'note-1' },
      data: expect.objectContaining({ title: 'Before', description: '', noteType: 'TAP' }),
    }))
    expect(editorEvents.markUndone).toHaveBeenCalledWith(['event-1'], 'undo-event-1')
  })

  it('throws when there is no undoable event', async () => {
    editorEvents.findLatestUndoable.mockResolvedValue(null)
    const service = new UndoService(prisma as any, editorEvents as any, events as any, access as any, analyze as any)

    await expect(service.undo('chart-1', { id: 'user-1' } as any)).rejects.toBeInstanceOf(NotFoundException)
  })
})
```

- [ ] **Step 2: Run and verify fail**

Run: `pnpm --filter @ama-midi/api test -- undo.service`

Expected: FAIL because `UndoService` does not exist.

- [ ] **Step 3: Implement note-focused UndoService**

Create `apps/api/src/modules/undo/undo.service.ts` with this minimal note support first:

```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { randomUUID } from 'crypto'
import { NOTE_EVENTS, type AuthUser, type Note, type NoteUpdatedEvent } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import { EditorEventService } from '../ledger/editor-event.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { ChartAnalyzeService } from '../charts/chart-analyze.service'

function toNote(n: any): Note {
  return {
    id: n.id,
    chartId: n.chartId,
    songId: n.songId,
    track: n.track,
    time: n.time,
    title: n.title,
    description: n.description,
    createdBy: n.createdBy,
    creatorName: n.creator?.name ?? '',
    creatorAvatarUrl: n.creator?.avatarUrl ?? undefined,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    noteType: n.noteType ?? 'TAP',
    duration: n.duration ?? undefined,
  }
}

@Injectable()
export class UndoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly editorEvents: EditorEventService,
    private readonly events: EventEmitter2,
    private readonly access: ProjectAccessService,
    private readonly analyze: ChartAnalyzeService,
  ) {}

  async undo(chartId: string, user: AuthUser): Promise<{ eventId: string }> {
    const chart = await this.prisma.songChart.findUnique({ where: { id: chartId }, select: { songId: true } })
    if (!chart) throw new NotFoundException('Chart not found')
    await this.access.assertCanEditSongChart(chart.songId, user)

    const latest = await this.editorEvents.findLatestUndoable(chart.songId, user.id, chartId)
    if (!latest) throw new NotFoundException('Nothing to undo')

    const events = latest.batchId
      ? await this.editorEvents.findUndoableBatch(chart.songId, user.id, latest.batchId)
      : [latest]

    const undoBatchId = latest.batchId ? randomUUID() : null
    const undoneIds: string[] = []
    let undoEventId: string | null = null

    for (const event of events) {
      if (event.entityType === 'NOTE' && event.eventType === 'NOTE_UPDATED') {
        const before = event.beforeState as Partial<Note> | null
        if (!event.entityId || !before) continue
        const existing = await this.prisma.note.findFirst({ where: { id: event.entityId, deletedAt: null } })
        if (!existing) continue
        const updated = await this.prisma.note.update({
          where: { id: event.entityId },
          data: {
            title: before.title,
            description: before.description,
            noteType: before.noteType as any,
            duration: before.duration ?? null,
          },
          include: { creator: { select: { name: true, avatarUrl: true } } },
        })
        const note = toNote(updated)
        this.events.emit(NOTE_EVENTS.UPDATED, {
          songId: note.songId,
          noteId: note.id,
          userId: user.id,
          beforeState: existing as any,
          afterState: note,
        } satisfies NoteUpdatedEvent)
        const undoEvent = await this.editorEvents.record({
          songId: note.songId,
          chartId: note.chartId,
          entityType: 'NOTE',
          entityId: note.id,
          eventType: 'NOTE_UPDATED',
          userId: user.id,
          beforeState: existing as any,
          afterState: note as any,
          batchId: undoBatchId,
          undoable: true,
        })
        undoEventId = undoEvent.id
        undoneIds.push(event.id)
      }
    }

    if (!undoEventId || undoneIds.length === 0) throw new NotFoundException('Nothing to undo')
    await this.editorEvents.markUndone(undoneIds, undoEventId)
    await this.analyze.run(chartId)
    return { eventId: undoEventId }
  }
}
```

- [ ] **Step 4: Add module**

Create `apps/api/src/modules/undo/undo.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { LedgerModule } from '../ledger/ledger.module'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { ChartsModule } from '../charts/charts.module'
import { UndoService } from './undo.service'

@Module({
  imports: [PrismaModule, LedgerModule, ProjectAccessModule, ChartsModule],
  providers: [UndoService],
  exports: [UndoService],
})
export class UndoModule {}
```

- [ ] **Step 5: Wire controller to UndoService**

Modify `apps/api/src/modules/notes/notes.controller.ts`:

```ts
import { UndoService } from '../undo/undo.service'
```

Add constructor dependency:

```ts
private readonly undoService: UndoService,
```

Change `undo()` endpoint:

```ts
@Post('events/undo')
undo(@Param('chartId') chartId: string, @Req() req: Request) {
  return this.undoService.undo(chartId, req.user as AuthUser)
}
```

Import `UndoModule` into `apps/api/src/modules/notes/notes.module.ts`.

- [ ] **Step 6: Run tests and build**

Run: `pnpm --filter @ama-midi/api test -- undo.service`

Expected: PASS.

Run: `pnpm --filter @ama-midi/api build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/undo apps/api/src/modules/notes/notes.controller.ts apps/api/src/modules/notes/notes.module.ts
git commit -m "feat(api): add generic undo service foundation"
```

---

## Task 7: Section Events in Ledger and Realtime

**Files:**
- Modify: `apps/api/src/modules/sections/sections.service.ts`
- Modify: `apps/api/src/modules/sections/sections.listener.ts`
- Test: `apps/api/src/modules/sections/__tests__/sections.service.spec.ts`

- [ ] **Step 1: Add section event assertions to existing tests**

In `apps/api/src/modules/sections/__tests__/sections.service.spec.ts`, add or update tests to expect:

```ts
expect(events.emit).toHaveBeenCalledWith('section.created', {
  songId: 'song-1',
  userId: 'user-1',
  section: expect.objectContaining({ id: expect.any(String) }),
})

expect(events.emit).toHaveBeenCalledWith('section.updated', {
  songId: 'song-1',
  userId: 'user-1',
  beforeState: expect.objectContaining({ id: 'section-1' }),
  section: expect.objectContaining({ id: 'section-1' }),
})

expect(events.emit).toHaveBeenCalledWith('section.deleted', {
  songId: 'song-1',
  userId: 'user-1',
  beforeState: expect.objectContaining({ id: 'section-1' }),
  id: 'section-1',
})
```

- [ ] **Step 2: Run and verify fail**

Run: `pnpm --filter @ama-midi/api test -- sections.service`

Expected: FAIL because current section events do not include `userId`/`beforeState`.

- [ ] **Step 3: Update section service events**

Modify emitted payloads:

```ts
this.events.emit('section.created', { songId, userId: user.id, section: dom })
this.events.emit('section.updated', { songId, userId: user.id, beforeState: this.toDomain(existing), section: dom })
this.events.emit('section.deleted', { songId, userId: user.id, beforeState: this.toDomain(existing), id })
```

If `existing` does not include `creator`, adjust `toDomain` to tolerate missing creator as it already does.

- [ ] **Step 4: Update section listener**

Modify `apps/api/src/modules/sections/sections.listener.ts` to accept and forward the richer payload:

```ts
@OnEvent('section.created')
handleCreated(payload: { songId: string; userId: string; section: SectionMarker }) {
  this.realtime.broadcastToSong(payload.songId, 'section-created', payload.section)
}

@OnEvent('section.updated')
handleUpdated(payload: { songId: string; userId: string; beforeState: SectionMarker; section: SectionMarker }) {
  this.realtime.broadcastToSong(payload.songId, 'section-updated', payload.section)
}

@OnEvent('section.deleted')
handleDeleted(payload: { songId: string; userId: string; beforeState: SectionMarker; id: string }) {
  this.realtime.broadcastToSong(payload.songId, 'section-deleted', { id: payload.id, beforeState: payload.beforeState })
}
```

Actor wrapping happens in a later realtime task.

- [ ] **Step 5: Run tests and build**

Run: `pnpm --filter @ama-midi/api test -- sections.service`

Expected: PASS.

Run: `pnpm --filter @ama-midi/api build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/sections
git commit -m "feat(api): enrich section domain events"
```

---

## Task 8: Realtime Actor Wrapping and Chart Switch

**Files:**
- Modify: `apps/api/src/modules/realtime/realtime.listener.ts`
- Modify: `apps/api/src/modules/realtime/realtime.gateway.ts`
- Test: `apps/api/src/modules/realtime/__tests__/realtime.listener.spec.ts`

- [ ] **Step 1: Write failing realtime listener tests**

Create `apps/api/src/modules/realtime/__tests__/realtime.listener.spec.ts`:

```ts
import { RealtimeListener } from '../realtime.listener'

describe('RealtimeListener', () => {
  const gateway = { broadcastToSong: jest.fn(), server: { to: jest.fn() } }
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Huy', avatarUrl: null }),
    },
  }

  beforeEach(() => jest.clearAllMocks())

  it('wraps note-created payload with actor', async () => {
    const listener = new RealtimeListener(gateway as any, prisma as any)

    await listener.onNoteCreated({
      songId: 'song-1',
      noteId: 'note-1',
      userId: 'u1',
      afterState: { id: 'note-1', chartId: 'chart-1' } as any,
    })

    expect(gateway.broadcastToSong).toHaveBeenCalledWith('song-1', 'note-created', {
      actor: { id: 'u1', name: 'Huy', avatarUrl: null },
      data: { id: 'note-1', chartId: 'chart-1' },
    })
  })

  it('falls back when actor lookup fails', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null)
    const listener = new RealtimeListener(gateway as any, prisma as any)

    await listener.onNotesBatchApplied({
      songId: 'song-1',
      batchId: 'batch-1',
      created: [],
      deletedIds: [],
      actorId: 'missing',
    })

    expect(gateway.broadcastToSong).toHaveBeenCalledWith('song-1', 'notes-batch-applied', {
      actor: { id: 'missing', name: 'Someone', avatarUrl: null },
      data: expect.objectContaining({ batchId: 'batch-1' }),
    })
  })
})
```

- [ ] **Step 2: Run and verify fail**

Run: `pnpm --filter @ama-midi/api test -- realtime.listener`

Expected: FAIL because constructor/signatures do not match.

- [ ] **Step 3: Update listener**

Modify `apps/api/src/modules/realtime/realtime.listener.ts`:

```ts
constructor(
  private readonly gateway: RealtimeGateway,
  private readonly prisma: PrismaService,
) {}

private actorCache = new Map<string, ActivityActor>()

private async resolveActor(userId: string): Promise<ActivityActor> {
  const cached = this.actorCache.get(userId)
  if (cached) return cached
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, avatarUrl: true },
  })
  const actor = user
    ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
    : { id: userId, name: 'Someone', avatarUrl: null }
  this.actorCache.set(userId, actor)
  return actor
}

private async wrap<T>(userId: string, data: T): Promise<RealtimeActivityPayload<T>> {
  return { actor: await this.resolveActor(userId), data }
}
```

Make note handlers `async`, and broadcast wrapped payloads:

```ts
this.gateway.broadcastToSong(event.songId, 'note-created', await this.wrap(event.userId, event.afterState))
this.gateway.broadcastToSong(songId, 'note-updated', await this.wrap(userId, afterState))
this.gateway.broadcastToSong(event.songId, 'note-deleted', await this.wrap(event.userId, { noteId: event.noteId, beforeState: event.beforeState }))
this.gateway.broadcastToSong(payload.songId, 'notes-batch-applied', await this.wrap(payload.actorId, payload))
```

- [ ] **Step 4: Add chart switch gateway handler**

In `apps/api/src/modules/realtime/realtime.gateway.ts`, inject `ProjectAccessService` and `EventEmitter2` if not already available. Add:

```ts
@SubscribeMessage('chart-switch')
async handleChartSwitch(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { songId: string; chartId: string; chartName: string },
) {
  if (!client.data.user || !data.songId || !data.chartId) return
  await this.projectAccess.assertCanViewSong(data.songId, client.data.user)
  client.to(`song:${data.songId}`).emit('chart-switched', {
    actor: {
      id: client.data.user.id,
      name: client.data.user.name,
      avatarUrl: client.data.user.avatarUrl ?? null,
    },
    data: { chartId: data.chartId, chartName: data.chartName },
  })
  this.eventEmitter.emit('chart.switched', {
    songId: data.songId,
    chartId: data.chartId,
    chartName: data.chartName,
    userId: client.data.user.id,
  })
}
```

- [ ] **Step 5: Run tests/build**

Run: `pnpm --filter @ama-midi/api test -- realtime.listener`

Expected: PASS.

Run: `pnpm --filter @ama-midi/api build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/realtime
git commit -m "feat(api): wrap realtime activity payloads"
```

---

## Task 9: Web Payload Unwrap and Socket Activity Events

**Files:**
- Create: `apps/web/src/features/collaboration/activity-payload.ts`
- Modify: `apps/web/src/features/collaboration/useSocket.ts`
- Test: `apps/web/tests/activity-payload.test.ts`

- [ ] **Step 1: Write unwrap tests**

Create `apps/web/tests/activity-payload.test.ts`:

```ts
import { unwrapActivityPayload } from '../src/features/collaboration/activity-payload'

describe('unwrapActivityPayload', () => {
  it('unwraps activity payloads', () => {
    const actor = { id: 'u1', name: 'Huy', avatarUrl: null }
    expect(unwrapActivityPayload({ actor, data: { id: 'n1' } })).toEqual({
      actor,
      data: { id: 'n1' },
    })
  })

  it('keeps legacy payloads usable', () => {
    expect(unwrapActivityPayload({ id: 'n1' })).toEqual({
      actor: null,
      data: { id: 'n1' },
    })
  })
})
```

- [ ] **Step 2: Run and verify fail**

Run: `pnpm --filter @ama-midi/api test -- activity-payload`

Expected: FAIL if Jest cannot resolve web tests. If this repo does not run web tests through Jest, run `pnpm --filter @ama-midi/web build` after implementation and keep this file for the existing test harness.

- [ ] **Step 3: Implement unwrap helper**

Create `apps/web/src/features/collaboration/activity-payload.ts`:

```ts
import type { ActivityActor, RealtimeActivityPayload } from '@ama-midi/shared'

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

- [ ] **Step 4: Extend `useSocket` return API**

Add callback types near the top of `apps/web/src/features/collaboration/useSocket.ts`:

```ts
export interface ActivityNoticeEvent {
  actor: ActivityActor
  type: EditorEventType
  weight: number
  label: string
  at: number
}

export interface UseSocketOptions {
  onActivity?: (event: ActivityNoticeEvent) => void
}
```

Change signature:

```ts
export function useSocket(songId: string, chartId?: string, projectId?: string, options: UseSocketOptions = {}) {
```

For each socket event, use `unwrapActivityPayload`. Example for note created:

```ts
socket.on('note-created', (payload: Note | RealtimeActivityPayload<Note>) => {
  const { actor, data: note } = unwrapActivityPayload(payload)
  // existing cache update uses note
  if (actor) {
    options.onActivity?.({
      actor,
      type: 'NOTE_CREATED',
      weight: 1,
      label: `${actor.name} added a note at Track ${note.track}, ${note.time}s`,
      at: Date.now(),
    })
  }
})
```

Repeat with exact labels for `note-updated`, `note-deleted`, `notes-batch-applied`, section events, and `chart-switched`.

- [ ] **Step 5: Add chart switch emit**

Return a new function:

```ts
function emitChartSwitch(chartName: string) {
  if (!chartId) return
  socketRef.current?.emit('chart-switch', { songId, chartId, chartName })
}

return { presenceList, isConnected, cursors, emitCursorMove, emitCursorHide, emitChartSwitch }
```

- [ ] **Step 6: Build web**

Run: `pnpm --filter @ama-midi/web build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/collaboration/activity-payload.ts apps/web/src/features/collaboration/useSocket.ts apps/web/tests/activity-payload.test.ts
git commit -m "feat(web): normalize realtime activity payloads"
```

---

## Task 10: Web Activity Toast Hook

**Files:**
- Create: `apps/web/src/features/collaboration/useActivityNotices.ts`
- Modify: `apps/web/src/pages/EditorPage.tsx`
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: Implement `useActivityNotices`**

Create `apps/web/src/features/collaboration/useActivityNotices.ts`:

```ts
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ActivityAggregator } from '@ama-midi/shared'
import type { ActivityNoticeEvent } from './useSocket'

function formatCount(total: number) {
  return total >= 1000 ? '999+' : String(total)
}

export function useActivityNotices(currentUserId?: string | null) {
  const aggregatorRef = useRef(new ActivityAggregator())
  const timersRef = useRef(new Map<string, number>())

  const clearActor = useCallback((actorId: string) => {
    aggregatorRef.current.clear(actorId)
    toast.dismiss(`activity-${actorId}`)
    const timer = timersRef.current.get(actorId)
    if (timer) window.clearTimeout(timer)
    timersRef.current.delete(actorId)
  }, [])

  const onActivity = useCallback((event: ActivityNoticeEvent) => {
    if (event.actor.id === currentUserId) return
    const result = aggregatorRef.current.push(event.actor, {
      type: event.type,
      at: event.at,
      weight: event.weight,
      label: event.label,
    })

    if (result.kind === 'individual') {
      toast(result.action.label, {
        id: result.toastId,
        duration: 4000,
        className: 'ama-toast ama-toast--activity',
      })
    }

    if (result.kind === 'burst') {
      result.replacedToastIds.forEach(id => toast.dismiss(id))
      toast(`${result.burst.actor.name} did ${formatCount(result.burst.total)} actions`, {
        id: `activity-${result.burst.actor.id}`,
        duration: Infinity,
        className: 'ama-toast ama-toast--activity',
      })
    }

    if (result.kind === 'burst-update') {
      toast(`${result.burst.actor.name} did ${formatCount(result.burst.total)} actions`, {
        id: `activity-${result.burst.actor.id}`,
        duration: Infinity,
        className: 'ama-toast ama-toast--activity',
      })
    }

    if (result.kind === 'burst' || result.kind === 'burst-update') {
      const actorId = result.burst.actor.id
      const existing = timersRef.current.get(actorId)
      if (existing) window.clearTimeout(existing)
      timersRef.current.set(actorId, window.setTimeout(() => {
        toast.dismiss(`activity-${actorId}`)
        timersRef.current.delete(actorId)
      }, 5000))
    }
  }, [currentUserId])

  const clearAll = useCallback(() => {
    aggregatorRef.current.clear()
    timersRef.current.forEach(timer => window.clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  useEffect(() => clearAll, [clearAll])

  return { onActivity, clearActor, clearAll }
}
```

- [ ] **Step 2: Add toast CSS**

Append to `apps/web/src/styles/globals.css`:

```css
.ama-toast--activity {
  border-left: 3px solid #6C63FF;
}
```

- [ ] **Step 3: Wire into EditorPage**

In `apps/web/src/pages/EditorPage.tsx`, import:

```ts
import { useActivityNotices } from '../features/collaboration/useActivityNotices'
import { useAuthStore } from '../store/auth.store'
```

Inside `EditorPage`, derive current user id:

```ts
const currentUser = useAuthStore(s => s.user)
const activity = useActivityNotices(currentUser?.id)
```

Pass callback to `useSocket`:

```ts
const { presenceList, isConnected, cursors, emitCursorMove, emitCursorHide, emitChartSwitch } =
  useSocket(songId!, chartId, projectId, { onActivity: activity.onActivity })
```

Call `emitChartSwitch` in an effect when `chartId`/chart name changes:

```ts
useEffect(() => {
  const activeChartName = activeChart?.name
  if (activeChartName) emitChartSwitch(activeChartName)
}, [activeChart?.name, chartId, emitChartSwitch])
```

- [ ] **Step 4: Build web**

Run: `pnpm --filter @ama-midi/web build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/collaboration/useActivityNotices.ts apps/web/src/pages/EditorPage.tsx apps/web/src/styles/globals.css
git commit -m "feat(web): show collaborator activity toasts"
```

---

## Task 11: History Panel Uses Editor Events and Grouping

**Files:**
- Modify: `apps/api/src/modules/notes/notes.service.ts`
- Modify: `apps/api/src/modules/notes/notes.controller.ts`
- Modify: `apps/web/src/features/editor/components/HistoryPanel.tsx`

- [ ] **Step 1: Update API event query**

Change `NotesService.getEvents` to query `editorEvent`:

```ts
const events = await this.prisma.editorEvent.findMany({
  where: {
    songId,
    ...(cursor ? { id: { lt: cursor } } : {}),
  },
  orderBy: { createdAt: 'desc' },
  take: limit + 1,
  include: { user: { select: { id: true, name: true, avatarUrl: true } } },
})
```

Return rows with string `createdAt`:

```ts
return {
  events: items.map(event => ({ ...event, createdAt: event.createdAt.toISOString() })),
  nextCursor: hasMore ? items[items.length - 1].id : null,
}
```

- [ ] **Step 2: Update HistoryPanel types and grouping**

In `HistoryPanel.tsx`, import:

```ts
import { groupHistoryEvents, type EditorEventRow } from '@ama-midi/shared'
```

Replace local `NoteEventRow` with `EditorEventRow`.

Replace:

```ts
const events = data?.pages.flatMap(p => p.events) ?? []
```

with:

```ts
const events = data?.pages.flatMap(p => p.events) ?? []
const groupedEvents = groupHistoryEvents(events)
```

- [ ] **Step 3: Update labels**

Replace `eventLabel` with:

```ts
function eventLabel(event: EditorEventRow): string {
  const state = event.eventType.endsWith('CREATED') || event.eventType.endsWith('UPDATED')
    ? event.afterState
    : event.beforeState
  const name = event.user?.name ?? 'Someone'
  if (event.entityType === 'NOTE') {
    const track = state?.track ?? '?'
    const time = state?.time ?? '?'
    if (event.eventType === 'NOTE_CREATED') return `${name} added a note at Track ${track}, ${time}s`
    if (event.eventType === 'NOTE_UPDATED') return `${name} edited a note at Track ${track}, ${time}s`
    return `${name} removed a note at Track ${track}, ${time}s`
  }
  if (event.entityType === 'SECTION') {
    const label = state?.label ? `"${state.label}"` : 'a section'
    if (event.eventType === 'SECTION_CREATED') return `${name} added section ${label}`
    if (event.eventType === 'SECTION_UPDATED') return `${name} updated section ${label}`
    return `${name} removed ${label}`
  }
  const chartName = state?.chartName ?? event.afterState?.chartName ?? 'a chart'
  return `${name} switched to chart "${chartName}"`
}
```

- [ ] **Step 4: Render grouped rows**

Replace `events.map` with:

```tsx
{groupedEvents.map(item => {
  if (item.kind === 'burst') {
    return (
      <details key={item.id} className="group">
        <summary className="flex gap-3 items-start cursor-pointer list-none">
          <Avatar src={item.actor.avatarUrl ?? undefined} name={item.actor.name ?? 'Unknown'} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-shell-text leading-relaxed">{item.actor.name} did {item.total} actions</p>
            <p className="text-xs text-shell-muted mt-0.5">{timeAgo(item.createdAt)}</p>
          </div>
        </summary>
        <div className="ml-11 mt-2 space-y-1">
          {item.events.map(event => (
            <p key={event.id} className="text-xs text-shell-muted">{eventLabel(event)}</p>
          ))}
        </div>
      </details>
    )
  }
  const event = item.event
  return (
    <div key={event.id} className="flex gap-3 items-start">
      <Avatar src={event.user?.avatarUrl ?? undefined} name={event.user?.name ?? 'Unknown'} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-shell-text leading-relaxed">{eventLabel(event)}</p>
        <p className="text-xs text-shell-muted mt-0.5">{timeAgo(event.createdAt)}</p>
      </div>
    </div>
  )
})}
```

- [ ] **Step 5: Build web and API**

Run: `pnpm --filter @ama-midi/api build`

Expected: PASS.

Run: `pnpm --filter @ama-midi/web build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/notes/notes.service.ts apps/api/src/modules/notes/notes.controller.ts apps/web/src/features/editor/components/HistoryPanel.tsx
git commit -m "feat: group editor history events"
```

---

## Task 12: Section Undo Support

**Files:**
- Modify: `apps/api/src/modules/undo/undo.service.ts`
- Test: `apps/api/src/modules/undo/__tests__/undo.service.spec.ts`

- [ ] **Step 1: Add section undo tests**

Add tests to `undo.service.spec.ts`:

```ts
it('deletes a section created by the latest event', async () => {
  editorEvents.findLatestUndoable.mockResolvedValue({
    id: 'event-section-created',
    songId: 'song-1',
    chartId: null,
    entityType: 'SECTION',
    entityId: 'section-1',
    eventType: 'SECTION_CREATED',
    afterState: { id: 'section-1', songId: 'song-1', label: 'Verse', time: 1, color: '#fff' },
    batchId: null,
  })
  prisma.sectionMarker.findUnique.mockResolvedValue({ id: 'section-1', songId: 'song-1' })
  prisma.sectionMarker.delete.mockResolvedValue({ id: 'section-1' })
  editorEvents.record.mockResolvedValue({ id: 'undo-section-event' })
  const service = new UndoService(prisma as any, editorEvents as any, events as any, access as any, analyze as any)

  await service.undo('chart-1', { id: 'user-1', role: 'ADMIN' } as any)

  expect(prisma.sectionMarker.delete).toHaveBeenCalledWith({ where: { id: 'section-1' } })
  expect(editorEvents.markUndone).toHaveBeenCalledWith(['event-section-created'], 'undo-section-event')
})
```

- [ ] **Step 2: Run and verify fail**

Run: `pnpm --filter @ama-midi/api test -- undo.service`

Expected: FAIL because section inverse operations are not implemented.

- [ ] **Step 3: Implement section inverse branches**

Inside the UndoService event loop, add:

```ts
if (event.entityType === 'SECTION' && event.eventType === 'SECTION_CREATED') {
  if (!event.entityId) continue
  const existing = await this.prisma.sectionMarker.findUnique({ where: { id: event.entityId } })
  if (!existing) continue
  await this.prisma.sectionMarker.delete({ where: { id: event.entityId } })
  const undoEvent = await this.editorEvents.record({
    songId: event.songId,
    entityType: 'SECTION',
    entityId: event.entityId,
    eventType: 'SECTION_DELETED',
    userId: user.id,
    beforeState: event.afterState as object,
    batchId: undoBatchId,
    undoable: true,
  })
  undoEventId = undoEvent.id
  undoneIds.push(event.id)
}
```

Add the `SECTION_DELETED` branch:

```ts
if (event.entityType === 'SECTION' && event.eventType === 'SECTION_DELETED') {
  const before = event.beforeState as {
    id?: string
    songId?: string
    time?: number
    label?: string
    color?: string
    createdBy?: string
  } | null
  if (!before?.songId || before.time == null || !before.label) continue
  const restored = await this.prisma.sectionMarker.create({
    data: {
      songId: before.songId,
      time: before.time,
      label: before.label,
      color: before.color ?? '#6C63FF',
      createdBy: before.createdBy ?? user.id,
    },
  })
  const undoEvent = await this.editorEvents.record({
    songId: event.songId,
    entityType: 'SECTION',
    entityId: restored.id,
    eventType: 'SECTION_CREATED',
    userId: user.id,
    afterState: restored as object,
    batchId: undoBatchId,
    undoable: true,
  })
  undoEventId = undoEvent.id
  undoneIds.push(event.id)
}
```

Add the `SECTION_UPDATED` branch:

```ts
if (event.entityType === 'SECTION' && event.eventType === 'SECTION_UPDATED') {
  const before = event.beforeState as {
    id?: string
    label?: string
    color?: string
  } | null
  if (!event.entityId || !before) continue
  const existing = await this.prisma.sectionMarker.findUnique({ where: { id: event.entityId } })
  if (!existing) continue
  const updated = await this.prisma.sectionMarker.update({
    where: { id: event.entityId },
    data: {
      label: before.label,
      color: before.color,
    },
  })
  const undoEvent = await this.editorEvents.record({
    songId: event.songId,
    entityType: 'SECTION',
    entityId: event.entityId,
    eventType: 'SECTION_UPDATED',
    userId: user.id,
    beforeState: existing as object,
    afterState: updated as object,
    batchId: undoBatchId,
    undoable: true,
  })
  undoEventId = undoEvent.id
  undoneIds.push(event.id)
}
```

- [ ] **Step 4: Run tests/build**

Run: `pnpm --filter @ama-midi/api test -- undo.service`

Expected: PASS.

Run: `pnpm --filter @ama-midi/api build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/undo
git commit -m "feat(api): support section undo"
```

---

## Task 13: Final Verification and Manual Smoke

**Files:**
- No new files unless fixing defects found by verification.

- [ ] **Step 1: Run API tests**

Run: `pnpm --filter @ama-midi/api test`

Expected: PASS. If any test fails, fix the defect and rerun the full command.

- [ ] **Step 2: Run builds**

Run: `pnpm --filter @ama-midi/api build`

Expected: PASS.

Run: `pnpm --filter @ama-midi/web build`

Expected: PASS with only the existing Vite chunk-size warning.

- [ ] **Step 3: Run dev servers**

Run API if not already running:

```bash
pnpm --filter @ama-midi/api start:dev
```

Run web if not already running:

```bash
pnpm --filter @ama-midi/web dev
```

Expected: API on port `3001`, web on port `3000`.

- [ ] **Step 4: Manual smoke checklist**

In two browsers or two profiles:

1. User A and User B open the same song.
2. User A creates 3 notes. User B sees 3 individual activity toasts.
3. User A creates a 4th note within 30 seconds. User B sees prior individual toasts dismissed and one burst toast.
4. User A pastes or copies a batch. User B sees one burst toast with the correct count.
5. User A edits a note. User B sees edit activity. History contains `NOTE_UPDATED`.
6. User A creates, edits, and deletes a section. User B sees activity. History shows section rows.
7. User A switches chart. User B sees chart switch activity. History shows a non-undoable chart switch.
8. User A clicks Undo. The latest undoable event reverts and cannot be undone twice.
9. Same account in two tabs does not show live toasts for own actions.

- [ ] **Step 5: Commit verification fixes**

If verification required fixes in known task files, stage those exact paths. For example, if the fixes are in the activity and undo modules:

```bash
git add packages/shared/src/activity apps/api/src/modules/undo apps/web/src/features/collaboration
git commit -m "fix: stabilize collaborator activity batching"
```

If fixes touched different files, run `git status --short`, stage only the exact files you changed for this feature, and use the same commit message. If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - Shared activity aggregation: Task 2.
  - History grouping: Task 3 and Task 11.
  - Editor event ledger: Task 4 and Task 5.
  - Note update persistence: Task 5.
  - Generic undo foundation: Task 6 and Task 12.
  - Section events: Task 7 and Task 12.
  - Actor-wrapped realtime payloads: Task 8.
  - Chart switch: Task 8 and Task 10.
  - Frontend payload normalization and toasts: Task 9 and Task 10.
  - Verification: Task 13.
- Placeholder scan: no `TBD`, `TODO`, or intentionally vague implementation steps.
- Type consistency:
  - `EditorEventRow`, `ActivityActor`, `RealtimeActivityPayload`, `EditorEventType`, and `EditorEntityType` come from `@ama-midi/shared`.
  - `ActivityNoticeEvent` is defined in `useSocket.ts` and consumed by `useActivityNotices.ts`.
  - `EditorEventService` methods are used by `UndoService` with matching names.
