# Editor Commands & Multi-Level Undo Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat `editor_events` undo model with a separate `editor_commands` table that records user intent (paste, repeat, single note), enabling multi-level per-user undo with a conflict resolution screen.

**Architecture:** A new `editor_commands` table owns the undo stack — one row per user action with `undoable`, `isCompensation`, and `undoneByCommandId` flags that make the stack loop-proof. The existing `editor_events` table becomes a pure mutation audit log, gaining a nullable `commandId` FK. History and Undo operate on `editor_commands` only.

**Tech Stack:** NestJS · Prisma · PostgreSQL · React 18 · TanStack Query · TypeScript · pnpm monorepo

---

## File Map

**New files:**
- `apps/api/src/modules/editor-commands/editor-command.types.ts`
- `apps/api/src/modules/editor-commands/editor-command.service.ts`
- `apps/api/src/modules/editor-commands/editor-command.controller.ts`
- `apps/api/src/modules/editor-commands/editor-command.module.ts`
- `apps/api/src/modules/editor-commands/__tests__/editor-command.service.spec.ts`
- `apps/api/prisma/migrations/20260524200000_editor_commands/migration.sql`
- `apps/web/src/features/editor/components/UndoConflictModal.tsx`

**Modified files:**
- `packages/shared/src/events.ts` — add `CommandType`, `EditorCommandRow`, `UndoConflict`, `UndoPreview`; extend `commandId` on note event types
- `packages/shared/src/types.ts` — extend `ConflictAction` with `'REPLACE_WITH_UNDO'`
- `packages/shared/src/index.ts` — re-export new types
- `apps/api/prisma/schema.prisma` — add `EditorCommand` model; add `commandId` to `EditorEvent`
- `apps/api/src/modules/notes/notes.service.ts` — inject `EditorCommandService`, write command before each mutation
- `apps/api/src/modules/notes/notes.module.ts` — import `EditorCommandModule`
- `apps/api/src/modules/notes/notes.controller.ts` — add `/commands/undo-preview` and `/commands/undo` routes; deprecate `/events/undo`
- `apps/api/src/modules/notes/note-copy.service.ts` — write command before batch
- `apps/api/src/modules/sections/sections.service.ts` — inject `EditorCommandService`, write command and mutation row
- `apps/api/src/modules/sections/sections.module.ts` — import `EditorCommandModule`
- `apps/api/src/modules/ledger/ledger.listener.ts` — stamp `commandId` from event payload onto `editor_events`
- `packages/shared/src/activity/group-history-events.ts` — delete (replaced by command-level rows)
- `packages/shared/src/activity/index.ts` — remove group-history-events export
- `apps/web/src/features/notes/useNotes.ts` — update `useUndo` hook with preview + conflict resolution
- `apps/web/src/features/editor/components/HistoryPanel.tsx` — switch to `EditorCommandRow`, new labels, remove grouping
- `apps/web/src/features/editor/components/ConflictListItem.tsx` — `StatusDot` handles `REPLACE_WITH_UNDO`
- `apps/web/src/pages/EditorPage.tsx` — wire Ctrl+Z to multi-level undo

**Deleted files:**
- `apps/api/src/modules/undo/undo.service.ts`
- `apps/api/src/modules/undo/undo.module.ts`
- `apps/api/src/modules/undo/__tests__/undo.service.spec.ts`

---

## Task 1: Shared types

**Files:**
- Modify: `packages/shared/src/events.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add `commandId` to note event interfaces in `packages/shared/src/events.ts`**

Replace the existing three event interfaces with:

```typescript
export interface NoteCreatedEvent {
  songId: string
  noteId: string
  userId: string
  afterState: Note
  batchId?: string
  replacesNoteId?: string
  realtimeMode?: 'single' | 'batch'
  commandId?: string
}

export interface NoteUpdatedEvent {
  songId: string
  noteId: string
  userId: string
  beforeState: Partial<Note>
  afterState: Note
  commandId?: string
}

export interface NoteDeletedEvent {
  songId: string
  noteId: string
  userId: string
  beforeState: Partial<Note>
  batchId?: string
  replacedByBatch?: boolean
  realtimeMode?: 'single' | 'batch'
  commandId?: string
}
```

- [ ] **Step 2: Add command and undo types to `packages/shared/src/events.ts`**

Append at the end of the file:

```typescript
export type CommandType =
  | 'SINGLE_NOTE_CREATED'
  | 'SINGLE_NOTE_UPDATED'
  | 'SINGLE_NOTE_DELETED'
  | 'PATTERN_PASTED'
  | 'NOTES_REPEATED'
  | 'NOTES_MOVED'
  | 'SECTION_CREATED'
  | 'SECTION_UPDATED'
  | 'SECTION_DELETED'
  | 'AI_NOTES_APPLIED'
  | 'CHART_SWITCHED'
  | 'UNDO'

export interface EditorCommandRow {
  id: string
  songId: string
  chartId?: string | null
  commandType: CommandType
  userId: string
  summary: Record<string, unknown>
  undoable: boolean
  undoneByCommandId?: string | null
  isCompensation: boolean
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string | null }
}

export interface UndoConflict {
  conflictId: string   // id of the note occupying the slot
  track: number
  time: number
  incomingNote: Record<string, unknown>   // note snapshot being restored
  existingNote: Record<string, unknown>   // note snapshot currently there
}

export interface UndoPreview {
  commandId: string
  commandType: CommandType
  summary: Record<string, unknown>
  conflicts: UndoConflict[]
}
```

- [ ] **Step 3: Extend `ConflictAction` in `packages/shared/src/types.ts`**

Find the line:
```typescript
export type ConflictAction = 'KEEP_EXISTING' | 'REPLACE_WITH_PATTERN'
```
Replace with:
```typescript
export type ConflictAction = 'KEEP_EXISTING' | 'REPLACE_WITH_PATTERN' | 'REPLACE_WITH_UNDO'
```

- [ ] **Step 4: Build shared package and verify types compile**

```bash
pnpm --filter @ama-midi/shared build
```
Expected: exits 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/events.ts packages/shared/src/types.ts
git commit -m "feat(shared): add CommandType, EditorCommandRow, UndoPreview types"
```

---

## Task 2: Prisma schema and migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260524200000_editor_commands/migration.sql`

- [ ] **Step 1: Add `EditorCommand` model to `schema.prisma`**

Add after the existing `EditorEvent` model:

```prisma
model EditorCommand {
  id                  String    @id @default(uuid())
  songId              String
  chartId             String?
  commandType         String
  userId              String
  summary             Json      @default("{}")
  undoable            Boolean   @default(true)
  undoneByCommandId   String?
  isCompensation      Boolean   @default(false)
  createdAt           DateTime  @default(now())

  song              Song            @relation(fields: [songId], references: [id], onDelete: Cascade)
  user              User            @relation(fields: [userId], references: [id])
  undoneByCommand   EditorCommand?  @relation("UndoChain", fields: [undoneByCommandId], references: [id])
  undoesCommands    EditorCommand[] @relation("UndoChain")
  mutations         EditorEvent[]

  @@index([chartId, userId, createdAt])
  @@index([chartId, createdAt])
  @@map("editor_commands")
}
```

- [ ] **Step 2: Add `commandId` FK to `EditorEvent` and update relations in `schema.prisma`**

Inside the `EditorEvent` model, add two lines after `undoable`:

```prisma
  commandId       String?
  command         EditorCommand? @relation(fields: [commandId], references: [id])
```

- [ ] **Step 3: Add `editorCommands` relations to `User` and `Song` models**

In `User` model, add: `editorCommands EditorCommand[]`  
In `Song` model, add: `editorCommands EditorCommand[]`

- [ ] **Step 4: Create migration SQL**

Create `apps/api/prisma/migrations/20260524200000_editor_commands/migration.sql`:

```sql
CREATE TABLE "editor_commands" (
  "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
  "song_id"               UUID NOT NULL,
  "chart_id"              UUID,
  "command_type"          TEXT NOT NULL,
  "user_id"               UUID NOT NULL,
  "summary"               JSONB NOT NULL DEFAULT '{}',
  "undoable"              BOOLEAN NOT NULL DEFAULT true,
  "undone_by_command_id"  UUID,
  "is_compensation"       BOOLEAN NOT NULL DEFAULT false,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "editor_commands_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "editor_commands"
  ADD CONSTRAINT "editor_commands_song_id_fkey"
    FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "editor_commands_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  ADD CONSTRAINT "editor_commands_undone_by_command_id_fkey"
    FOREIGN KEY ("undone_by_command_id") REFERENCES "editor_commands"("id");

CREATE INDEX "editor_commands_chart_user_created_idx"
  ON "editor_commands" ("chart_id", "user_id", "created_at" DESC);

CREATE INDEX "editor_commands_chart_created_idx"
  ON "editor_commands" ("chart_id", "created_at" DESC);

ALTER TABLE "editor_events"
  ADD COLUMN "command_id" UUID,
  ADD CONSTRAINT "editor_events_command_id_fkey"
    FOREIGN KEY ("command_id") REFERENCES "editor_commands"("id");

CREATE INDEX "editor_events_command_id_idx" ON "editor_events" ("command_id");
```

- [ ] **Step 5: Apply migration and regenerate Prisma client**

```bash
cd apps/api
npx prisma migrate deploy
npx prisma generate
```

Expected: migration applied, client regenerated with `prisma.editorCommand` available.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(api): add editor_commands table and commandId FK on editor_events"
```

---

## Task 3: `EditorCommandService` — record, findUndoStack, findById, previewUndo

**Files:**
- Create: `apps/api/src/modules/editor-commands/editor-command.types.ts`
- Create: `apps/api/src/modules/editor-commands/editor-command.service.ts`
- Create: `apps/api/src/modules/editor-commands/__tests__/editor-command.service.spec.ts`

- [ ] **Step 1: Create `editor-command.types.ts`**

```typescript
// apps/api/src/modules/editor-commands/editor-command.types.ts
import type { CommandType } from '@ama-midi/shared'

export interface RecordCommandInput {
  songId: string
  chartId?: string | null
  commandType: CommandType
  userId: string
  summary: Record<string, unknown>
  undoable?: boolean
  isCompensation?: boolean
}

export interface UndoResolution {
  conflictId: string
  action: 'KEEP_EXISTING' | 'REPLACE_WITH_UNDO'
}
```

- [ ] **Step 2: Write failing tests for `EditorCommandService` basic methods**

Create `apps/api/src/modules/editor-commands/__tests__/editor-command.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { EditorCommandService } from '../editor-command.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('EditorCommandService', () => {
  let service: EditorCommandService
  let prisma: jest.Mocked<PrismaService>

  const mockCommand = {
    id: 'cmd-1',
    songId: 'song-1',
    chartId: 'chart-1',
    commandType: 'SINGLE_NOTE_CREATED',
    userId: 'user-1',
    summary: { track: 3, time: 4.0 },
    undoable: true,
    isCompensation: false,
    undoneByCommandId: null,
    createdAt: new Date(),
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EditorCommandService,
        {
          provide: PrismaService,
          useValue: {
            editorCommand: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            editorEvent: {
              findMany: jest.fn(),
            },
            note: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile()

    service = module.get(EditorCommandService)
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>
  })

  describe('record', () => {
    it('creates a command row with defaults', async () => {
      ;(prisma.editorCommand.create as jest.Mock).mockResolvedValue(mockCommand)
      const result = await service.record({
        songId: 'song-1',
        chartId: 'chart-1',
        commandType: 'SINGLE_NOTE_CREATED',
        userId: 'user-1',
        summary: { track: 3, time: 4.0 },
      })
      expect(prisma.editorCommand.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          songId: 'song-1',
          chartId: 'chart-1',
          commandType: 'SINGLE_NOTE_CREATED',
          undoable: true,
          isCompensation: false,
        }),
      })
      expect(result.id).toBe('cmd-1')
    })
  })

  describe('findUndoStack', () => {
    it('returns undoable, non-compensated, non-undone commands for the user', async () => {
      ;(prisma.editorCommand.findMany as jest.Mock).mockResolvedValue([mockCommand])
      const result = await service.findUndoStack('chart-1', 'user-1')
      expect(prisma.editorCommand.findMany).toHaveBeenCalledWith({
        where: {
          chartId: 'chart-1',
          userId: 'user-1',
          undoable: true,
          isCompensation: false,
          undoneByCommandId: null,
        },
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toHaveLength(1)
    })

    it('returns empty array when nothing to undo', async () => {
      ;(prisma.editorCommand.findMany as jest.Mock).mockResolvedValue([])
      const result = await service.findUndoStack('chart-1', 'user-1')
      expect(result).toHaveLength(0)
    })
  })

  describe('previewUndo', () => {
    it('throws NotFoundException when stack is empty', async () => {
      ;(prisma.editorCommand.findMany as jest.Mock).mockResolvedValue([])
      await expect(service.previewUndo('chart-1', 'user-1')).rejects.toThrow(NotFoundException)
    })

    it('returns preview with empty conflicts when no slots occupied', async () => {
      ;(prisma.editorCommand.findMany as jest.Mock).mockResolvedValue([mockCommand])
      ;(prisma.editorEvent.findMany as jest.Mock).mockResolvedValue([])
      const result = await service.previewUndo('chart-1', 'user-1')
      expect(result.commandId).toBe('cmd-1')
      expect(result.conflicts).toHaveLength(0)
    })

    it('returns conflicts when a restored note slot is occupied', async () => {
      const deletedMutation = {
        id: 'ev-1',
        commandId: 'cmd-1',
        entityId: 'note-deleted-1',
        eventType: 'NOTE_DELETED',
        beforeState: { id: 'note-deleted-1', track: 3, time: 4.0, chartId: 'chart-1', title: 'A', description: '', noteType: 'TAP' },
      }
      const occupant = { id: 'note-occupant', track: 3, time: 4.0, title: 'B', description: '', noteType: 'TAP', createdBy: 'user-2', createdAt: new Date(), creator: { name: 'Other' } }

      ;(prisma.editorCommand.findMany as jest.Mock).mockResolvedValue([mockCommand])
      ;(prisma.editorEvent.findMany as jest.Mock).mockResolvedValue([deletedMutation])
      ;(prisma.note.findFirst as jest.Mock).mockResolvedValue(occupant)

      const result = await service.previewUndo('chart-1', 'user-1')
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].conflictId).toBe('note-occupant')
      expect(result.conflicts[0].track).toBe(3)
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/api && pnpm test -- --testPathPattern="editor-command.service" 2>&1 | tail -5
```
Expected: FAIL — `EditorCommandService` not found.

- [ ] **Step 4: Create `editor-command.service.ts`**

```typescript
// apps/api/src/modules/editor-commands/editor-command.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import type { CommandType, UndoConflict, UndoPreview } from '@ama-midi/shared'
import { PrismaService } from '../prisma/prisma.service'
import type { RecordCommandInput, UndoResolution } from './editor-command.types'

@Injectable()
export class EditorCommandService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordCommandInput) {
    return this.prisma.editorCommand.create({
      data: {
        songId: input.songId,
        chartId: input.chartId ?? null,
        commandType: input.commandType,
        userId: input.userId,
        summary: input.summary,
        undoable: input.undoable ?? true,
        isCompensation: input.isCompensation ?? false,
      },
    })
  }

  findUndoStack(chartId: string, userId: string) {
    return this.prisma.editorCommand.findMany({
      where: {
        chartId,
        userId,
        undoable: true,
        isCompensation: false,
        undoneByCommandId: null,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: string) {
    return this.prisma.editorCommand.findUnique({ where: { id } })
  }

  async previewUndo(chartId: string, userId: string): Promise<UndoPreview> {
    const stack = await this.findUndoStack(chartId, userId)
    if (stack.length === 0) throw new NotFoundException('Nothing to undo')

    const command = stack[0]
    const conflicts = await this.computeUndoConflicts(command)

    return {
      commandId: command.id,
      commandType: command.commandType as CommandType,
      summary: command.summary as Record<string, unknown>,
      conflicts,
    }
  }

  private async computeUndoConflicts(command: { id: string; chartId?: string | null }): Promise<UndoConflict[]> {
    // Only NOTE_DELETED mutations produce restore conflicts; NOTE_CREATED deletions never conflict
    const deletedMutations = await this.prisma.editorEvent.findMany({
      where: { commandId: command.id, eventType: 'NOTE_DELETED' },
    })

    const conflicts: UndoConflict[] = []

    for (const mutation of deletedMutations) {
      const before = mutation.beforeState as Record<string, unknown> | null
      if (!before || before.track == null || before.time == null) continue

      const occupant = await this.prisma.note.findFirst({
        where: {
          chartId: command.chartId ?? undefined,
          track: before.track as number,
          time: before.time as number,
          deletedAt: null,
          NOT: { id: mutation.entityId ?? '' },
        },
        include: { creator: { select: { name: true, avatarUrl: true } } },
      })

      if (occupant) {
        conflicts.push({
          conflictId: occupant.id,
          track: before.track as number,
          time: before.time as number,
          incomingNote: before,
          existingNote: {
            id: occupant.id,
            track: occupant.track,
            time: occupant.time,
            title: occupant.title,
            description: occupant.description,
            noteType: occupant.noteType,
            duration: occupant.duration ?? undefined,
            createdBy: occupant.createdBy,
            creatorName: occupant.creator?.name ?? '',
            createdAt: occupant.createdAt.toISOString(),
          },
        })
      }
    }

    return conflicts
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm test -- --testPathPattern="editor-command.service" 2>&1 | tail -10
```
Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/editor-commands/
git commit -m "feat(api): add EditorCommandService with record, findUndoStack, previewUndo"
```

---

## Task 4: `EditorCommandService.applyUndo` for single-note and section operations

**Files:**
- Modify: `apps/api/src/modules/editor-commands/editor-command.service.ts`
- Modify: `apps/api/src/modules/editor-commands/__tests__/editor-command.service.spec.ts`

- [ ] **Step 1: Add failing tests for `applyUndo`**

Add to the test file (inside the `describe('EditorCommandService')` block):

```typescript
  describe('applyUndo', () => {
    it('throws NotFoundException when commandId not found', async () => {
      ;(prisma.editorCommand.findUnique as jest.Mock).mockResolvedValue(null)
      await expect(
        service.applyUndo('chart-1', 'user-1', 'missing-id', []),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when command already undone', async () => {
      ;(prisma.editorCommand.findUnique as jest.Mock).mockResolvedValue({
        ...mockCommand,
        undoneByCommandId: 'already-undone',
      })
      await expect(
        service.applyUndo('chart-1', 'user-1', 'cmd-1', []),
      ).rejects.toThrow(NotFoundException)
    })

    it('soft-deletes a created note for SINGLE_NOTE_CREATED undo', async () => {
      const createdMutation = {
        id: 'ev-1',
        commandId: 'cmd-1',
        entityId: 'note-1',
        entityType: 'NOTE',
        eventType: 'NOTE_CREATED',
        beforeState: null,
        afterState: { id: 'note-1', songId: 'song-1', chartId: 'chart-1', track: 3, time: 4.0 },
      }
      const existingNote = { id: 'note-1', songId: 'song-1', chartId: 'chart-1', track: 3, time: 4.0, title: 'A', description: '', noteType: 'TAP', duration: null, createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date(), creator: { name: 'Huy', avatarUrl: null } }
      const undoCommand = { id: 'cmd-undo-1', ...mockCommand, commandType: 'UNDO', undoable: false, isCompensation: true }

      ;(prisma.editorCommand.findUnique as jest.Mock).mockResolvedValue(mockCommand)
      ;(prisma.editorEvent.findMany as jest.Mock).mockResolvedValue([createdMutation])
      ;(prisma.note.findFirst as jest.Mock).mockResolvedValue(existingNote)
      ;(prisma.note.update as jest.Mock).mockResolvedValue({ ...existingNote, deletedAt: new Date() })
      ;(prisma.editorCommand.create as jest.Mock).mockResolvedValue(undoCommand)
      ;(prisma.editorCommand.update as jest.Mock).mockResolvedValue({})
      ;(prisma.editorEvent.create as jest.Mock).mockResolvedValue({})

      const result = await service.applyUndo('chart-1', 'user-1', 'cmd-1', [])
      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { deletedAt: expect.any(Date) },
      })
      expect(result.commandType).toBe('UNDO')
    })
  })
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd apps/api && pnpm test -- --testPathPattern="editor-command.service" 2>&1 | tail -5
```
Expected: FAIL — `applyUndo` not defined.

- [ ] **Step 3: Add `applyUndo` method and required imports to `editor-command.service.ts`**

Add these imports at the top of the service file:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NOTE_EVENTS } from '@ama-midi/shared'
import type { Note, NoteCreatedEvent, NoteDeletedEvent } from '@ama-midi/shared'
```

Add `EventEmitter2` to the constructor:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly eventEmitter: EventEmitter2,
) {}
```

Add the `applyUndo` method to the service class:

```typescript
async applyUndo(
  chartId: string,
  userId: string,
  commandId: string,
  resolutions: UndoResolution[],
): Promise<{ id: string; commandType: string; isCompensation: boolean }> {
  const command = await this.findById(commandId)
  if (!command || command.userId !== userId) throw new NotFoundException('Command not found')
  if (command.undoneByCommandId) throw new NotFoundException('Already undone')

  // Re-validate conflicts (state may have changed since preview)
  const currentConflicts = await this.computeUndoConflicts(command)
  const resolvedIds = new Set(resolutions.map(r => r.conflictId))
  const currentIds = new Set(currentConflicts.map(c => c.conflictId))
  if (!this.setsEqual(resolvedIds, currentIds)) {
    throw new ConflictException({ error: 'CONFLICTS_CHANGED', conflicts: currentConflicts })
  }

  const resolutionMap = new Map(resolutions.map(r => [r.conflictId, r.action]))

  // Get all mutations for this command
  const mutations = await this.prisma.editorEvent.findMany({
    where: { commandId: command.id },
    orderBy: { createdAt: 'asc' },
  })

  // Write compensation command first
  const compensationCommand = await this.record({
    songId: command.songId,
    chartId: command.chartId,
    commandType: 'UNDO',
    userId,
    summary: {
      targetCommandId: command.id,
      targetCommandType: command.commandType,
    },
    undoable: false,
    isCompensation: true,
  })

  // Process NOTE_CREATED mutations first (soft-delete them) — must run before
  // NOTE_DELETED restorations to avoid unique constraint violations on same slot
  for (const mutation of mutations) {
    if (mutation.entityType !== 'NOTE' || mutation.eventType !== 'NOTE_CREATED') continue
    if (!mutation.entityId) continue

    const note = await this.prisma.note.findFirst({
      where: { id: mutation.entityId, deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })
    if (!note) continue

    await this.prisma.note.update({ where: { id: mutation.entityId }, data: { deletedAt: new Date() } })

    const before = this.toNote(note)
    this.eventEmitter.emit(NOTE_EVENTS.DELETED, {
      songId: note.songId,
      noteId: note.id,
      userId,
      beforeState: before,
      commandId: compensationCommand.id,
    } satisfies NoteDeletedEvent & { commandId: string })

    await this.prisma.editorEvent.create({
      data: {
        songId: note.songId,
        chartId: note.chartId,
        entityType: 'NOTE',
        entityId: note.id,
        eventType: 'NOTE_DELETED',
        userId,
        beforeState: before as object,
        commandId: compensationCommand.id,
        undoable: false,
      },
    })
  }

  // Process NOTE_DELETED mutations (restore notes), respecting conflict resolutions
  for (const mutation of mutations) {
    if (mutation.entityType !== 'NOTE' || mutation.eventType !== 'NOTE_DELETED') continue
    if (!mutation.entityId) continue

    const conflictForThisNote = currentConflicts.find(c => {
      const before = mutation.beforeState as Record<string, unknown> | null
      return before && c.track === before.track && c.time === before.time
    })

    if (conflictForThisNote) {
      const action = resolutionMap.get(conflictForThisNote.conflictId) ?? 'KEEP_EXISTING'
      if (action === 'KEEP_EXISTING') continue

      // REPLACE_WITH_UNDO: soft-delete the occupant first
      await this.prisma.note.update({
        where: { id: conflictForThisNote.conflictId },
        data: { deletedAt: new Date() },
      })
    }

    const softDeleted = await this.prisma.note.findFirst({ where: { id: mutation.entityId } })
    if (!softDeleted || softDeleted.deletedAt === null) continue

    const restored = await this.prisma.note.update({
      where: { id: mutation.entityId },
      data: { deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })
    const note = this.toNote(restored)

    this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
      songId: note.songId,
      noteId: note.id,
      userId,
      afterState: note,
      commandId: compensationCommand.id,
    } satisfies NoteCreatedEvent & { commandId: string })

    await this.prisma.editorEvent.create({
      data: {
        songId: note.songId,
        chartId: note.chartId,
        entityType: 'NOTE',
        entityId: note.id,
        eventType: 'NOTE_CREATED',
        userId,
        afterState: note as object,
        commandId: compensationCommand.id,
        undoable: false,
      },
    })
  }

  // Process NOTE_UPDATED mutations (restore beforeState)
  for (const mutation of mutations) {
    if (mutation.entityType !== 'NOTE' || mutation.eventType !== 'NOTE_UPDATED') continue
    if (!mutation.entityId) continue

    const before = mutation.beforeState as Partial<Note> | null
    if (!before) continue

    const existing = await this.prisma.note.findFirst({
      where: { id: mutation.entityId, deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })
    if (!existing) continue

    const updated = await this.prisma.note.update({
      where: { id: mutation.entityId },
      data: {
        title: before.title,
        description: before.description,
        noteType: before.noteType as any,
        duration: before.duration ?? null,
      },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })
    const note = this.toNote(updated)

    await this.prisma.editorEvent.create({
      data: {
        songId: note.songId,
        chartId: note.chartId,
        entityType: 'NOTE',
        entityId: note.id,
        eventType: 'NOTE_UPDATED',
        userId,
        beforeState: this.toNote(existing) as object,
        afterState: note as object,
        commandId: compensationCommand.id,
        undoable: false,
      },
    })
  }

  // Process SECTION mutations
  for (const mutation of mutations) {
    if (mutation.entityType !== 'SECTION') continue
    await this.applySectionMutationUndo(mutation, userId, compensationCommand.id)
  }

  // Mark original command as undone
  await this.prisma.editorCommand.update({
    where: { id: command.id },
    data: { undoneByCommandId: compensationCommand.id },
  })

  return compensationCommand
}

private async applySectionMutationUndo(
  mutation: { entityId?: string | null; eventType: string; beforeState: unknown; afterState: unknown; songId: string },
  userId: string,
  compensationCommandId: string,
): Promise<void> {
  if (mutation.eventType === 'SECTION_CREATED') {
    if (!mutation.entityId) return
    await this.prisma.sectionMarker.delete({ where: { id: mutation.entityId } }).catch(() => {})
    await this.prisma.editorEvent.create({
      data: {
        songId: mutation.songId,
        entityType: 'SECTION',
        entityId: mutation.entityId,
        eventType: 'SECTION_DELETED',
        userId,
        beforeState: mutation.afterState as object,
        commandId: compensationCommandId,
        undoable: false,
      },
    })
  }

  if (mutation.eventType === 'SECTION_DELETED') {
    const before = mutation.beforeState as { id?: string; songId?: string; time?: number; label?: string; color?: string; createdBy?: string } | null
    if (!before?.songId || before.time == null || !before.label) return
    const restored = await this.prisma.sectionMarker.create({
      data: {
        songId: before.songId,
        time: before.time,
        label: before.label,
        color: before.color ?? '#6C63FF',
        createdBy: before.createdBy ?? userId,
      },
    })
    await this.prisma.editorEvent.create({
      data: {
        songId: mutation.songId,
        entityType: 'SECTION',
        entityId: restored.id,
        eventType: 'SECTION_CREATED',
        userId,
        afterState: restored as object,
        commandId: compensationCommandId,
        undoable: false,
      },
    })
  }

  if (mutation.eventType === 'SECTION_UPDATED') {
    const before = mutation.beforeState as { id?: string; label?: string; color?: string } | null
    if (!mutation.entityId || !before) return
    const existing = await this.prisma.sectionMarker.findUnique({ where: { id: mutation.entityId } })
    if (!existing) return
    const updated = await this.prisma.sectionMarker.update({
      where: { id: mutation.entityId },
      data: { label: before.label, color: before.color },
    })
    await this.prisma.editorEvent.create({
      data: {
        songId: mutation.songId,
        entityType: 'SECTION',
        entityId: mutation.entityId,
        eventType: 'SECTION_UPDATED',
        userId,
        beforeState: existing as object,
        afterState: updated as object,
        commandId: compensationCommandId,
        undoable: false,
      },
    })
  }
}

private setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every(v => b.has(v))
}

private toNote(n: {
  id: string; chartId: string; songId: string; track: number; time: number;
  title: string; description: string; createdBy: string; noteType?: string;
  duration?: number | null; createdAt: Date; updatedAt: Date;
  creator?: { name: string; avatarUrl?: string | null }
}): Note {
  return {
    id: n.id, chartId: n.chartId, songId: n.songId,
    track: n.track, time: n.time, title: n.title, description: n.description,
    createdBy: n.createdBy, creatorName: n.creator?.name ?? '',
    creatorAvatarUrl: n.creator?.avatarUrl ?? undefined,
    createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString(),
    noteType: (n.noteType as Note['noteType']) ?? 'TAP',
    duration: n.duration ?? undefined,
  }
}
```

Also add `editorEvent: { create: jest.fn() }` and `editorCommand: { update: jest.fn() }` and `sectionMarker: { delete: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() }` to the prisma mock in the test file.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm test -- --testPathPattern="editor-command.service" 2>&1 | tail -10
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/editor-commands/
git commit -m "feat(api): add EditorCommandService.applyUndo with conflict resolution"
```

---

## Task 5: `EditorCommandController` and `EditorCommandModule`

**Files:**
- Create: `apps/api/src/modules/editor-commands/editor-command.controller.ts`
- Create: `apps/api/src/modules/editor-commands/editor-command.module.ts`
- Modify: `apps/api/src/modules/notes/notes.controller.ts`
- Modify: `apps/api/src/modules/notes/notes.module.ts`

- [ ] **Step 1: Create `editor-command.controller.ts`**

```typescript
// apps/api/src/modules/editor-commands/editor-command.controller.ts
import { Controller, Post, Param, Body, UseGuards, Req, HttpCode } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { EditorCommandService } from './editor-command.service'
import type { Request } from 'express'
import type { AuthUser, UndoPreview } from '@ama-midi/shared'
import type { UndoResolution } from './editor-command.types'

class ApplyUndoDto {
  commandId!: string
  resolutions?: UndoResolution[]
}

@Controller('charts/:chartId/commands')
@UseGuards(AuthGuard('jwt'))
export class EditorCommandController {
  constructor(private readonly commands: EditorCommandService) {}

  @Post('undo-preview')
  @HttpCode(200)
  previewUndo(@Param('chartId') chartId: string, @Req() req: Request): Promise<UndoPreview> {
    return this.commands.previewUndo(chartId, (req.user as AuthUser).id)
  }

  @Post('undo')
  @HttpCode(200)
  applyUndo(
    @Param('chartId') chartId: string,
    @Body() body: ApplyUndoDto,
    @Req() req: Request,
  ) {
    return this.commands.applyUndo(chartId, (req.user as AuthUser).id, body.commandId, body.resolutions ?? [])
  }
}
```

- [ ] **Step 2: Create `editor-command.module.ts`**

```typescript
// apps/api/src/modules/editor-commands/editor-command.module.ts
import { Module } from '@nestjs/common'
import { EditorCommandService } from './editor-command.service'
import { EditorCommandController } from './editor-command.controller'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  providers: [EditorCommandService],
  controllers: [EditorCommandController],
  exports: [EditorCommandService],
})
export class EditorCommandModule {}
```

- [ ] **Step 3: Import `EditorCommandModule` in `notes.module.ts`**

Add `EditorCommandModule` to the `imports` array in `apps/api/src/modules/notes/notes.module.ts`.  
Also add `EditorCommandModule` to `exports` so `NotesService` can inject `EditorCommandService`.

- [ ] **Step 4: Add 410 deprecation response to old `/events/undo` route in `notes.controller.ts`**

Replace the existing `undo` handler:

```typescript
@Post('events/undo')
@HttpCode(410)
undoDeprecated() {
  return { message: 'Use POST /charts/:chartId/commands/undo instead', status: 410 }
}
```

Also remove the `UndoService` import and injection since it is being deleted in this task.

- [ ] **Step 5: Delete the old undo module files**

```bash
rm apps/api/src/modules/undo/undo.service.ts
rm apps/api/src/modules/undo/undo.module.ts
rm apps/api/src/modules/undo/__tests__/undo.service.spec.ts
rmdir apps/api/src/modules/undo/__tests__
rmdir apps/api/src/modules/undo
```

- [ ] **Step 6: Build API to verify no broken imports**

```bash
pnpm --filter @ama-midi/api build 2>&1 | tail -5
```
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/editor-commands/ apps/api/src/modules/notes/
git commit -m "feat(api): add EditorCommandController + module, deprecate /events/undo"
```

---

## Task 6: `NotesService` writes commands

**Files:**
- Modify: `apps/api/src/modules/notes/notes.service.ts`

- [ ] **Step 1: Inject `EditorCommandService` into `NotesService`**

Add the import:
```typescript
import { EditorCommandService } from '../editor-commands/editor-command.service'
```

Add to the constructor parameters:
```typescript
private readonly editorCommands: EditorCommandService,
```

- [ ] **Step 2: Write command in `NotesService.create` and pass `commandId` through event**

In the `create` method, just before `this.eventEmitter.emit(NOTE_EVENTS.CREATED, ...)`:

```typescript
const command = await this.editorCommands.record({
  songId,
  chartId: note.chartId,
  commandType: 'SINGLE_NOTE_CREATED',
  userId: user.id,
  summary: { track: note.track, time: note.time },
})
```

Update the emit call to include `commandId`:

```typescript
this.eventEmitter.emit(NOTE_EVENTS.CREATED, {
  songId,
  noteId: note.id,
  userId: user.id,
  afterState: note,
  commandId: command.id,
} satisfies NoteCreatedEvent)
```

- [ ] **Step 3: Write command in `NotesService.softDelete`**

In the `softDelete` method, just before `this.eventEmitter.emit(NOTE_EVENTS.DELETED, ...)`:

```typescript
const command = await this.editorCommands.record({
  songId,
  chartId,
  commandType: 'SINGLE_NOTE_DELETED',
  userId: user.id,
  summary: { track: toNote(note).track, time: toNote(note).time },
})
```

Update the emit to include `commandId: command.id`.

- [ ] **Step 4: Write command in `NotesService.update`**

Find the `update` method. Just before its `this.eventEmitter.emit(NOTE_EVENTS.UPDATED, ...)` call:

```typescript
const command = await this.editorCommands.record({
  songId: updated.songId,
  chartId: updated.chartId,
  commandType: 'SINGLE_NOTE_UPDATED',
  userId: user.id,
  summary: { track: updated.track, time: updated.time },
})
```

Update the emit to include `commandId: command.id`.

- [ ] **Step 5: Build API**

```bash
pnpm --filter @ama-midi/api build 2>&1 | tail -5
```
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/notes/notes.service.ts
git commit -m "feat(api): NotesService writes SINGLE_NOTE_* commands before emitting events"
```

---

## Task 7: `NoteCopyService` writes commands

**Files:**
- Modify: `apps/api/src/modules/notes/note-copy.service.ts`

- [ ] **Step 1: Inject `EditorCommandService` into `NoteCopyService`**

Add import and constructor parameter (same pattern as Task 6 Step 1).

- [ ] **Step 2: Write command in `NoteCopyService.applyCopy`**

In `applyCopy`, after `const batchId = randomUUID()` and before the `await this.prisma.$transaction(...)`:

```typescript
const commandType =
  request.mode === 'REPEAT_INTERVAL' ? 'NOTES_REPEATED' :
  request.operation === 'MOVE'       ? 'NOTES_MOVED'    :
  'PATTERN_PASTED'

const command = await this.editorCommands.record({
  songId,
  chartId,
  commandType,
  userId: user.id,
  summary: {}, // filled in after transaction
})
```

After the transaction and after `deletedIds` / `createdEntries` are populated, update the command summary:

```typescript
await this.prisma.editorCommand.update({
  where: { id: command.id },
  data: {
    summary:
      commandType === 'NOTES_REPEATED'
        ? { createdCount: createdEntries.length, repeatCount: request.repeatCount ?? 1 }
        : commandType === 'NOTES_MOVED'
        ? { noteCount: createdEntries.length }
        : { createdCount: createdEntries.length, deletedCount: deletedIds.length },
  },
})
```

- [ ] **Step 3: Pass `commandId` in all emitted events**

In the `NOTE_EVENTS.DELETED` emit loop, add `commandId: command.id`.  
In the `NOTE_EVENTS.CREATED` emit loop, add `commandId: command.id`.

- [ ] **Step 4: Build and commit**

```bash
pnpm --filter @ama-midi/api build 2>&1 | tail -5
git add apps/api/src/modules/notes/note-copy.service.ts
git commit -m "feat(api): NoteCopyService writes PATTERN_PASTED/NOTES_REPEATED/NOTES_MOVED commands"
```

---

## Task 8: `SectionsService` writes commands

**Files:**
- Modify: `apps/api/src/modules/sections/sections.service.ts`
- Modify: `apps/api/src/modules/sections/sections.module.ts`

- [ ] **Step 1: Import `EditorCommandModule` in `sections.module.ts`**

Add `EditorCommandModule` to the `imports` array.

- [ ] **Step 2: Inject `EditorCommandService` into `SectionsService` and write commands with mutations**

Add import and constructor parameter.

In `SectionsService.create`, after the section is created, before the event emit:

```typescript
const command = await this.editorCommands.record({
  songId,
  commandType: 'SECTION_CREATED',
  userId: user.id,
  summary: { label: dom.label },
})
await this.prisma.editorEvent.create({
  data: {
    songId,
    entityType: 'SECTION',
    entityId: dom.id,
    eventType: 'SECTION_CREATED',
    userId: user.id,
    afterState: dom as object,
    commandId: command.id,
    undoable: false,
  },
})
```

Apply the same pattern for `update` (`SECTION_UPDATED`, writes `beforeState` + `afterState`) and `delete` (`SECTION_DELETED`, writes `beforeState`).

- [ ] **Step 3: Build and commit**

```bash
pnpm --filter @ama-midi/api build 2>&1 | tail -5
git add apps/api/src/modules/sections/
git commit -m "feat(api): SectionsService writes SECTION_* commands with mutation rows"
```

---

## Task 9: `LedgerListener` stamps `commandId`; update `getEvents` to return commands

**Files:**
- Modify: `apps/api/src/modules/ledger/ledger.listener.ts`
- Modify: `apps/api/src/modules/ledger/editor-event.service.ts`
- Modify: `apps/api/src/modules/notes/notes.service.ts` (`getEvents` method)

- [ ] **Step 1: Add `commandId` to `RecordEditorEventInput` in `editor-event.types.ts`**

```typescript
// apps/api/src/modules/ledger/editor-event.types.ts
export interface RecordEditorEventInput {
  // ... existing fields ...
  commandId?: string | null
}
```

- [ ] **Step 2: Update `EditorEventService.record` to save `commandId`**

In `editor-event.service.ts`, add `commandId: input.commandId ?? null` to the `data` object in the `record` method.

- [ ] **Step 3: Update `LedgerListener` to forward `commandId`**

In each `@OnEvent` handler, destructure `commandId` from the payload and pass it to `editorEvents.record`:

```typescript
@OnEvent(NOTE_EVENTS.CREATED)
onNoteCreated({ songId, noteId, userId, afterState, batchId, replacesNoteId, commandId }: NoteCreatedEvent) {
  return this.editorEvents.record({
    // ... existing fields ...
    commandId: commandId ?? null,
  })
}
```

Apply the same change to `onNoteUpdated` and `onNoteDeleted`.

- [ ] **Step 4: Update `NotesService.getEvents` to query `editor_commands`**

Find the `getEvents` method in `notes.service.ts`. Replace the `prisma.editorEvent.findMany` query with:

```typescript
async getEvents(chartId: string, user: AuthUser, cursor?: string, limit = 50) {
  await this.resolveChart(chartId, user)

  const rows = await this.prisma.editorCommand.findMany({
    where: { chartId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })

  const hasNextPage = rows.length > limit
  const items = rows.slice(0, limit)

  return {
    items: items.map(row => ({
      ...row,
      summary: row.summary as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: hasNextPage ? items[items.length - 1].id : null,
  }
}
```

- [ ] **Step 5: Build and run all API tests**

```bash
pnpm --filter @ama-midi/api build 2>&1 | tail -5
pnpm --filter @ama-midi/api test 2>&1 | tail -15
```
Expected: build exits 0, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/ledger/ apps/api/src/modules/notes/notes.service.ts
git commit -m "feat(api): stamp commandId on editor_events; getEvents returns editor_commands"
```

---

## Task 10: Frontend — `useUndo` with preview and conflict resolution flow

**Files:**
- Modify: `apps/web/src/features/notes/useNotes.ts`

- [ ] **Step 1: Update `useUndo` in `useNotes.ts`**

Replace the existing `useUndo` export with:

```typescript
export function useUndoPreview(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  return useMutation({
    mutationFn: (): Promise<import('@ama-midi/shared').UndoPreview> =>
      apiClient(token)<import('@ama-midi/shared').UndoPreview>(
        `/charts/${chartId}/commands/undo-preview`,
        { method: 'POST' },
      ),
  })
}

export function useApplyUndo(chartId: string | undefined) {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: {
      commandId: string
      resolutions?: { conflictId: string; action: 'KEEP_EXISTING' | 'REPLACE_WITH_UNDO' }[]
    }) =>
      apiClient(token)<{ id: string }>(`/charts/${chartId}/commands/undo`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (chartId) {
        qc.invalidateQueries({ queryKey: ['notes', chartId] })
        qc.invalidateQueries({ queryKey: ['events', chartId] })
        qc.invalidateQueries({ queryKey: ['chart-analysis', chartId] })
      }
    },
    onError: () => toast.error('Nothing to undo'),
  })
}

/** @deprecated use useUndoPreview + useApplyUndo */
export function useUndo(chartId: string | undefined) {
  return useApplyUndo(chartId)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/notes/useNotes.ts
git commit -m "feat(web): add useUndoPreview + useApplyUndo hooks"
```

---

## Task 11: Frontend — `UndoConflictModal` component

**Files:**
- Create: `apps/web/src/features/editor/components/UndoConflictModal.tsx`
- Modify: `apps/web/src/features/editor/components/ConflictListItem.tsx`

- [ ] **Step 1: Update `StatusDot` in `ConflictListItem.tsx` to handle `REPLACE_WITH_UNDO`**

Find the `StatusDot` function and replace the color logic:

```typescript
function StatusDot({ resolution }: { resolution: ConflictAction | undefined }) {
  const color =
    resolution === 'KEEP_EXISTING'
      ? 'var(--conflict-success)'
      : resolution === 'REPLACE_WITH_PATTERN' || resolution === 'REPLACE_WITH_UNDO'
      ? 'var(--conflict-danger)'
      : 'var(--conflict-warning)'
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}
```

- [ ] **Step 2: Create `UndoConflictModal.tsx`**

```typescript
// apps/web/src/features/editor/components/UndoConflictModal.tsx
import { useState } from 'react'
import type { UndoConflict, UndoPreview } from '@ama-midi/shared'
import { trackColor } from '@ama-midi/shared'
import { formatTime } from './conflict-formatters'

type UndoAction = 'KEEP_EXISTING' | 'REPLACE_WITH_UNDO'

interface Props {
  preview: UndoPreview
  resolutions: Record<string, UndoAction>
  onResolve: (conflictId: string, action: UndoAction) => void
  onApply: () => void
  onCancel: () => void
  conflictsChanged?: boolean
}

export function UndoConflictModal({ preview, resolutions, onResolve, onApply, onCancel, conflictsChanged }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const conflicts = preview.conflicts
  const activeConflict = conflicts[activeIndex] as UndoConflict | undefined

  const unresolved = conflicts.filter(c => resolutions[c.conflictId] === undefined)
  const allResolved = unresolved.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-shell-surface border border-shell-border rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-shell-border">
          <div>
            <h2 className="text-sm font-semibold text-shell-text">Undo conflicts</h2>
            <p className="text-xs text-shell-muted mt-0.5">
              {conflicts.length} note{conflicts.length !== 1 ? 's' : ''} can't be restored — their slots are occupied.
            </p>
          </div>
          <button onClick={onCancel} className="text-shell-muted hover:text-shell-text text-lg leading-none">×</button>
        </div>

        {conflictsChanged && (
          <div className="mx-5 mt-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
            The chart changed since you previewed. Please review the updated conflicts.
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Conflict list */}
          <div className="w-52 border-r border-shell-border overflow-y-auto">
            {conflicts.map((conflict, i) => (
              <button
                key={conflict.conflictId}
                onClick={() => setActiveIndex(i)}
                className="w-full text-left px-3 py-2.5 flex items-start gap-2 transition-colors border-l-2"
                style={{
                  backgroundColor: i === activeIndex ? 'var(--conflict-list-active, rgba(99,102,241,0.15))' : 'transparent',
                  borderLeftColor: i === activeIndex ? '#6366f1' : 'transparent',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: trackColor(conflict.track) }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate text-shell-text">
                    T{conflict.track} · {formatTime(conflict.time)}
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{
                  backgroundColor:
                    resolutions[conflict.conflictId] === 'KEEP_EXISTING' ? 'var(--conflict-success, #22c55e)'
                    : resolutions[conflict.conflictId] === 'REPLACE_WITH_UNDO' ? 'var(--conflict-danger, #ef4444)'
                    : 'var(--conflict-warning, #f59e0b)',
                }} />
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {activeConflict && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <p className="text-xs text-shell-muted">
                Slot <strong className="text-shell-text">T{activeConflict.track} · {formatTime(activeConflict.time)}</strong> is occupied.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Keep existing */}
                <button
                  onClick={() => onResolve(activeConflict.conflictId, 'KEEP_EXISTING')}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    resolutions[activeConflict.conflictId] === 'KEEP_EXISTING'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-shell-border hover:border-shell-text/30'
                  }`}
                >
                  <p className="text-xs font-semibold text-shell-text">Keep existing</p>
                  <p className="text-xs text-shell-muted mt-1 truncate">
                    {(activeConflict.existingNote as any).title || 'Note'} · {(activeConflict.existingNote as any).noteType}
                  </p>
                </button>

                {/* Restore original */}
                <button
                  onClick={() => onResolve(activeConflict.conflictId, 'REPLACE_WITH_UNDO')}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    resolutions[activeConflict.conflictId] === 'REPLACE_WITH_UNDO'
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-shell-border hover:border-shell-text/30'
                  }`}
                >
                  <p className="text-xs font-semibold text-shell-text">Restore original</p>
                  <p className="text-xs text-shell-muted mt-1 truncate">
                    {(activeConflict.incomingNote as any).title || 'Note'} · {(activeConflict.incomingNote as any).noteType}
                  </p>
                  <p className="text-xs text-red-400 mt-0.5">Removes existing note</p>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-shell-border">
          <p className="text-xs text-shell-muted">
            {unresolved.length > 0 ? `${unresolved.length} unresolved` : 'All resolved'}
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-xs text-shell-muted hover:text-shell-text">
              Cancel
            </button>
            <button
              onClick={onApply}
              disabled={!allResolved}
              className="px-4 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply undo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build web to verify no type errors**

```bash
pnpm --filter @ama-midi/web build 2>&1 | tail -5
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/UndoConflictModal.tsx apps/web/src/features/editor/components/ConflictListItem.tsx
git commit -m "feat(web): add UndoConflictModal; extend StatusDot for REPLACE_WITH_UNDO"
```

---

## Task 12: Frontend — `HistoryPanel` switches to `EditorCommandRow`

**Files:**
- Modify: `apps/web/src/features/editor/components/HistoryPanel.tsx`
- Modify: `packages/shared/src/activity/index.ts`

- [ ] **Step 1: Remove `group-history-events` export from `packages/shared/src/activity/index.ts`**

Remove the line:
```typescript
export * from './group-history-events'
```

- [ ] **Step 2: Rewrite `HistoryPanel.tsx`**

Replace the entire file contents with:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import { Avatar } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { apiClient } from '../../auth/api'
import type { EditorCommandRow, CommandType } from '@ama-midi/shared'

interface Props {
  chartId?: string
  onClose?: () => void
  inline?: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function commandLabel(cmd: EditorCommandRow): { dot: string; text: string } {
  const s = cmd.summary as Record<string, unknown>
  switch (cmd.commandType as CommandType) {
    case 'SINGLE_NOTE_CREATED':
      return { dot: 'bg-green-400', text: `Added note · Track ${s.track}, ${s.time}s` }
    case 'SINGLE_NOTE_UPDATED':
      return { dot: 'bg-blue-400', text: `Edited note · Track ${s.track}, ${s.time}s` }
    case 'SINGLE_NOTE_DELETED':
      return { dot: 'bg-red-400', text: `Removed note · Track ${s.track}, ${s.time}s` }
    case 'PATTERN_PASTED':
      return { dot: 'bg-indigo-400', text: `Pasted pattern · ${s.createdCount} added${s.deletedCount ? `, ${s.deletedCount} replaced` : ''}` }
    case 'NOTES_REPEATED':
      return { dot: 'bg-indigo-400', text: `Repeated notes · ${s.createdCount} added` }
    case 'NOTES_MOVED':
      return { dot: 'bg-yellow-400', text: `Moved ${s.noteCount} note${(s.noteCount as number) !== 1 ? 's' : ''}` }
    case 'SECTION_CREATED':
      return { dot: 'bg-green-400', text: `Added section "${s.label}"` }
    case 'SECTION_UPDATED':
      return { dot: 'bg-blue-400', text: `Updated section "${s.label}"` }
    case 'SECTION_DELETED':
      return { dot: 'bg-red-400', text: `Removed section "${s.label}"` }
    case 'UNDO': {
      const labels: Record<string, string> = {
        SINGLE_NOTE_CREATED: 'Created note', SINGLE_NOTE_UPDATED: 'Edited note',
        SINGLE_NOTE_DELETED: 'Deleted note', PATTERN_PASTED: 'Pasted pattern',
        NOTES_REPEATED: 'Repeated notes', NOTES_MOVED: 'Moved notes',
        SECTION_CREATED: 'Created section', SECTION_UPDATED: 'Updated section',
        SECTION_DELETED: 'Deleted section',
      }
      return { dot: 'bg-gray-400', text: `Undid "${labels[s.targetCommandType as string] ?? s.targetCommandType}"` }
    }
    default:
      return { dot: 'bg-gray-400', text: String(cmd.commandType) }
  }
}

export function HistoryPanel({ chartId, onClose, inline = false }: Props) {
  const token = useAuthStore(s => s.token)

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['events', chartId],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      apiClient(token)<{ items: EditorCommandRow[]; nextCursor: string | null }>(
        `/charts/${chartId}/events${pageParam ? `?cursor=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!token && !!chartId,
  })

  const commands = data?.pages.flatMap(p => p.items) ?? []

  return (
    <div className={`flex flex-col ${inline ? '' : 'h-full'} bg-shell-surface`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-shell-border">
        <span className="text-xs font-semibold text-shell-text uppercase tracking-wide">History</span>
        {onClose && (
          <button onClick={onClose} className="text-shell-muted hover:text-shell-text text-sm">×</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-shell-border flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-shell-border rounded w-3/4" />
                  <div className="h-2 bg-shell-border rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {commands.length === 0 && !isLoading && (
          <p className="p-4 text-sm text-shell-muted text-center">No history yet</p>
        )}

        <div className="p-3 space-y-2">
          {commands.map(cmd => {
            const { dot, text } = commandLabel(cmd)
            return (
              <div key={cmd.id} className="flex gap-3 items-start">
                <Avatar src={cmd.user?.avatarUrl ?? undefined} name={cmd.user?.name ?? 'Unknown'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-shell-text leading-relaxed">
                    <span className="font-semibold">{cmd.user?.name ?? 'Someone'}</span>
                    {' · '}
                    <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle mr-0.5 ${dot}`} />
                    {text}
                  </p>
                  <p className="text-xs text-shell-muted mt-0.5">{timeAgo(cmd.createdAt)}</p>
                </div>
              </div>
            )
          })}
        </div>

        {hasNextPage && (
          <div className="p-3 border-t border-shell-border">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full text-xs text-shell-muted hover:text-shell-text py-1"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build web**

```bash
pnpm --filter @ama-midi/web build 2>&1 | tail -5
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/HistoryPanel.tsx packages/shared/src/activity/index.ts
git commit -m "feat(web): HistoryPanel renders EditorCommandRow; remove time-window grouping"
```

---

## Task 13: Frontend — Wire Ctrl+Z to multi-level undo in `EditorPage`

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Replace `useUndo` wiring with `useUndoPreview` + `useApplyUndo` + conflict modal state**

In `EditorPage.tsx`:

1. Import the new hooks and modal:
```typescript
import { useUndoPreview, useApplyUndo } from '../features/notes/useNotes'
import { UndoConflictModal } from '../features/editor/components/UndoConflictModal'
import type { UndoPreview } from '@ama-midi/shared'
```

2. Replace the old `useUndo` hook call with:
```typescript
const undoPreview  = useUndoPreview(activeChart?.id)
const applyUndo    = useApplyUndo(activeChart?.id)
const [undoPending, setUndoPending] = useState<UndoPreview | null>(null)
const [undoResolutions, setUndoResolutions] = useState<Record<string, 'KEEP_EXISTING' | 'REPLACE_WITH_UNDO'>>({})
const [undoConflictsChanged, setUndoConflictsChanged] = useState(false)
```

3. Replace the `useEffect` that listens for `Ctrl+Z` (or add one if it doesn't exist):
```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (!activeChart?.id) return
      undoPreview.mutate(undefined, {
        onSuccess: (preview) => {
          if (preview.conflicts.length === 0) {
            applyUndo.mutate({ commandId: preview.commandId })
          } else {
            setUndoPending(preview)
            setUndoResolutions({})
            setUndoConflictsChanged(false)
          }
        },
      })
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [activeChart?.id, undoPreview, applyUndo])
```

4. Add the conflict modal to the render output (just before the closing `</div>` of the page):
```tsx
{undoPending && (
  <UndoConflictModal
    preview={undoPending}
    resolutions={undoResolutions}
    conflictsChanged={undoConflictsChanged}
    onResolve={(conflictId, action) =>
      setUndoResolutions(prev => ({ ...prev, [conflictId]: action }))
    }
    onApply={() => {
      applyUndo.mutate(
        { commandId: undoPending.commandId, resolutions: Object.entries(undoResolutions).map(([conflictId, action]) => ({ conflictId, action })) },
        {
          onSuccess: () => { setUndoPending(null); setUndoResolutions({}) },
          onError: (err: any) => {
            if (err?.body?.error === 'CONFLICTS_CHANGED') {
              setUndoPending(err.body)
              setUndoConflictsChanged(true)
            }
          },
        },
      )
    }}
    onCancel={() => { setUndoPending(null); setUndoResolutions({}) }}
  />
)}
```

- [ ] **Step 2: Remove any remaining references to old `useUndo` in `EditorPage`**

Search for and remove any `const undo = useUndo(...)` call and any `undo.mutate(...)` calls that were wired to old keyboard shortcuts.

- [ ] **Step 3: Build web**

```bash
pnpm --filter @ama-midi/web build 2>&1 | tail -5
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat(web): wire Ctrl+Z to multi-level undo with conflict resolution modal"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run all API tests**

```bash
pnpm --filter @ama-midi/api test 2>&1 | tail -20
```
Expected: all test suites pass.

- [ ] **Step 2: Build shared package**

```bash
pnpm --filter @ama-midi/shared build 2>&1 | tail -5
```
Expected: exits 0.

- [ ] **Step 3: Build web**

```bash
pnpm --filter @ama-midi/web build 2>&1 | tail -5
```
Expected: exits 0.

- [ ] **Step 4: Build API**

```bash
pnpm --filter @ama-midi/api build 2>&1 | tail -5
```
Expected: exits 0.

- [ ] **Step 5: Apply migration on dev database**

```bash
cd apps/api && npx prisma migrate deploy
```
Expected: migration `20260524200000_editor_commands` applied.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: editor commands & multi-level undo stack — complete implementation"
```

---

## Self-Review Notes

**Spec coverage check:**
- `editor_commands` table ✓ (Task 2)
- `commandId` FK on `editor_events` ✓ (Task 2 + Task 9)
- All command types (`SINGLE_NOTE_*`, `PATTERN_PASTED`, `NOTES_REPEATED`, `NOTES_MOVED`, `SECTION_*`, `UNDO`) ✓ (Tasks 6–8)
- Undo stack query (chartId + userId + undoable + isCompensation=false + undoneByCommandId IS NULL) ✓ (Task 3)
- Multi-level: repeated Ctrl+Z pops next stack item ✓ (Task 3 + Task 13)
- Conflict preview endpoint ✓ (Task 3 + Task 5)
- Conflict apply with `CONFLICTS_CHANGED` 409 ✓ (Task 4)
- Section undo ✓ (Task 4)
- `UndoConflictModal` reusing conflict list patterns ✓ (Task 11)
- History shows `EditorCommandRow` with labels ✓ (Task 12)
- `groupHistoryEvents` removed ✓ (Task 12)
- Old `/events/undo` returns 410 ✓ (Task 5)

**Type consistency check:**
- `RecordCommandInput.commandType` is `CommandType` (from shared) throughout ✓
- `UndoResolution.action` is `'KEEP_EXISTING' | 'REPLACE_WITH_UNDO'` consistently ✓
- `EditorCommandService.applyUndo` returns `{ id, commandType, isCompensation }` matching what `EditorCommandController` returns ✓
- `useApplyUndo` posts to `/charts/:chartId/commands/undo` and receives `{ id: string }` ✓
