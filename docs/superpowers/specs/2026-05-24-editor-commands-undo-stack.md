# Editor Commands & Multi-Level Undo Stack

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** `apps/api`, `apps/web`, `packages/shared`

---

## Problem

Paste, copy, repeat, and undo operations are stored as individual `NOTE_CREATED` / `NOTE_DELETED` rows in `editor_events`. This causes three bugs:

1. **History shows wrong labels** — "added note, removed note…" instead of "pasted pattern" or "repeated notes".
2. **Undo doesn't work for batch operations** — the `UndoService` has no handler for `NOTE_CREATED` / `NOTE_DELETED`, so it throws "nothing to undo".
3. **Undo creates an infinite loop** — compensating rows are written with `undoable=true`, so the next Ctrl+Z undoes the undo, cycling forever.

---

## Goals

- Per-action undo where one user action (paste, copy, repeat, single note) is one undo unit.
- Multi-level undo stack: repeated Ctrl+Z walks back through the user's own action history.
- Per-user only: users undo their own actions; collaborator actions are not in their stack.
- Conflict resolution on undo: if restoring deleted notes would collide, show the same conflict resolution screen that paste uses.
- Clean History panel: one row per command with a human-readable label; expandable to see individual mutations.

---

## Approach

Introduce a separate `editor_commands` table as the command log. The existing `editor_events` table becomes a pure mutation audit log, with a nullable `commandId` FK pointing to its parent command. History and Undo operate exclusively on `editor_commands`. Mutation rows are never in the undo stack.

---

## Data Model

### New table: `editor_commands`

```sql
CREATE TABLE editor_commands (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id               UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  chart_id              UUID REFERENCES song_charts(id),
  command_type          TEXT NOT NULL,
  user_id               UUID NOT NULL REFERENCES users(id),
  summary               JSONB NOT NULL DEFAULT '{}',
  undoable              BOOLEAN NOT NULL DEFAULT TRUE,
  undone_by_command_id  UUID REFERENCES editor_commands(id),
  is_compensation       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_editor_commands_chart_user_created
  ON editor_commands (chart_id, user_id, created_at DESC);

CREATE INDEX idx_editor_commands_chart_created
  ON editor_commands (chart_id, created_at DESC);
```

### Migration to `editor_events`

Add one nullable column (no data migration needed; existing rows are legacy):

```sql
ALTER TABLE editor_events ADD COLUMN command_id UUID REFERENCES editor_commands(id);
CREATE INDEX idx_editor_events_command_id ON editor_events (command_id);
```

Old columns (`undoable`, `undoneByEventId`, `batchId`) remain in place for backward compatibility but are no longer written by new code.

### Prisma models

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

Add to `EditorEvent`:
```prisma
commandId   String?
command     EditorCommand? @relation(fields: [commandId], references: [id])
```

---

## Command Types

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
```

### `summary` JSONB shapes

| commandType | summary |
|---|---|
| `SINGLE_NOTE_CREATED` | `{ track: number, time: number }` |
| `SINGLE_NOTE_UPDATED` | `{ track: number, time: number }` |
| `SINGLE_NOTE_DELETED` | `{ track: number, time: number }` |
| `PATTERN_PASTED` | `{ createdCount: number, deletedCount: number }` |
| `NOTES_REPEATED` | `{ createdCount: number, repeatCount: number }` |
| `NOTES_MOVED` | `{ noteCount: number }` |
| `SECTION_CREATED` | `{ label: string }` |
| `SECTION_UPDATED` | `{ label: string }` |
| `SECTION_DELETED` | `{ label: string }` |
| `AI_NOTES_APPLIED` | `{ createdCount: number }` |
| `CHART_SWITCHED` | `{ chartName: string }` |
| `UNDO` | `{ targetCommandId: string, targetCommandType: CommandType }` |

---

## Undo Stack

The stack for a given user on a given chart is:

```sql
SELECT * FROM editor_commands
WHERE chart_id = $chartId
  AND user_id  = $userId
  AND undoable = true
  AND is_compensation = false
  AND undone_by_command_id IS NULL
ORDER BY created_at DESC
```

Ctrl+Z always targets the first row. After undo:
- A new `UNDO` command is written (`undoable=false`, `isCompensation=true`).
- The original command's `undoneByCommandId` is set to the new UNDO command's id.
- The original command disappears from the stack query (it now has `undoneByCommandId IS NOT NULL`).

Multi-level undo: repeated Ctrl+Z pops the next command in the stack automatically.

---

## Undo Flow with Conflict Resolution

### Step 1 — Preview

```
POST /charts/:chartId/commands/undo-preview

Response 200:
{
  commandId: string
  commandType: CommandType
  summary: object
  conflicts: UndoConflict[]   // empty array if no conflicts
}
```

### Conflict shape

```typescript
interface UndoConflict {
  conflictId: string        // id of the note occupying the slot
  track: number
  time: number
  incomingNote: NoteSnapshot  // the note being restored
  existingNote: NoteSnapshot  // the note currently in that slot
}
```

### Resolution actions

| action | effect |
|---|---|
| `KEEP_EXISTING` | Skip restoring this note; the slot stays as-is |
| `REPLACE_WITH_UNDO` | Soft-delete the existing note, restore the original |

### Step 2 — Apply

```
POST /charts/:chartId/commands/undo
Body: { commandId: string, resolutions?: { conflictId: string, action: 'KEEP_EXISTING' | 'REPLACE_WITH_UNDO' }[] }

Response 200: { commandId: string }  // id of the new UNDO compensation command
Response 409: { error: 'CONFLICTS_CHANGED', conflicts: UndoConflict[] }
```

The apply step re-validates conflicts. If the conflict set changed since preview (a collaborator moved a note), it returns 409 and the client re-fetches and shows updated conflicts.

### Frontend flow

```
Ctrl+Z
  → POST /commands/undo-preview
  → conflicts.length === 0?
      → POST /commands/undo  (no body resolutions needed)
  → conflicts.length > 0?
      → open ConflictResolutionModal (reused from paste, new action labels)
      → user resolves
      → POST /commands/undo with resolutions
      → 409? → re-fetch preview, show updated modal
```

The existing `ConflictResolutionModal` component accepts the same conflict shape. Only the action labels change (`KEEP_EXISTING` / `REPLACE_WITH_UNDO` instead of `SKIP` / `REPLACE_WITH_PATTERN`).

---

## API Layer

### New module: `editor-commands`

```
apps/api/src/modules/editor-commands/
  editor-command.types.ts
  editor-command.service.ts
  editor-command.controller.ts
  editor-command.module.ts
  __tests__/
    editor-command.service.spec.ts
```

### `EditorCommandService` public interface

```typescript
record(input: RecordCommandInput): Promise<EditorCommand>
findUndoStack(chartId: string, userId: string): Promise<EditorCommand[]>
findById(id: string): Promise<EditorCommand | null>
previewUndo(chartId: string, userId: string): Promise<UndoPreview>
applyUndo(chartId: string, userId: string, commandId: string, resolutions: Resolution[]): Promise<EditorCommand>
```

### Where commands are written

Each service writes a command row **before** emitting mutation events, then passes `commandId` so mutation rows can reference it:

| Service | Command written |
|---|---|
| `NotesService.create` | `SINGLE_NOTE_CREATED` |
| `NotesService.update` | `SINGLE_NOTE_UPDATED` |
| `NotesService.softDelete` | `SINGLE_NOTE_DELETED` |
| `NoteCopyService.applyCopy` (COPY mode) | `PATTERN_PASTED` |
| `NoteCopyService.applyCopy` (COPY + REPEAT_INTERVAL) | `NOTES_REPEATED` |
| `NoteCopyService.applyCopy` (MOVE mode) | `NOTES_MOVED` |
| `SectionsService.create` | `SECTION_CREATED` |
| `SectionsService.update` | `SECTION_UPDATED` |
| `SectionsService.delete` | `SECTION_DELETED` |
| `EditorCommandService.applyUndo` | `UNDO` |

### Section undo behaviour

`SECTION_CREATED` undo: delete the section marker.  
`SECTION_DELETED` undo: restore the section marker from `beforeState` in the child mutation row.  
`SECTION_UPDATED` undo: restore `beforeState` fields (`label`, `color`) on the section marker.  
No conflict resolution needed for sections (section markers are keyed by `id`, not by position slot).

### Updated event payloads

`NoteCreatedEvent`, `NoteDeletedEvent`, `NoteUpdatedEvent` each add `commandId?: string`. The `LedgerListener` stamps `editor_events.commandId` from this field. No change to the realtime broadcast path.

### Routes

```
POST /charts/:chartId/commands/undo-preview   → EditorCommandController
POST /charts/:chartId/commands/undo           → EditorCommandController
```

The old `POST /charts/:chartId/events/undo` route is kept wired for one release, returning a `410 Gone` with a message pointing to the new route.

---

## History Panel

### API endpoint change

`GET /charts/:chartId/events` switches to returning `editor_commands` rows (excluding `isCompensation=true` UNDO commands — those are shown only when expanding a note's "was undone" status, not as top-level history items). Paginated by `createdAt DESC`, each row includes the actor user object.

Compensation commands (`isCompensation=true`) **are** shown in history — so users can see that "Huy undid Pasted pattern". They are simply not themselves undoable.

### History labels

| commandType | summary | Label |
|---|---|---|
| `SINGLE_NOTE_CREATED` | `{ track:3, time:4.0 }` | Added note · Track 3, 4.0s |
| `SINGLE_NOTE_UPDATED` | `{ track:3, time:4.0 }` | Edited note · Track 3, 4.0s |
| `SINGLE_NOTE_DELETED` | `{ track:3, time:4.0 }` | Removed note · Track 3, 4.0s |
| `PATTERN_PASTED` | `{ createdCount:12, deletedCount:3 }` | Pasted pattern · 12 added, 3 replaced |
| `NOTES_REPEATED` | `{ createdCount:8, repeatCount:2 }` | Repeated notes · 8 added |
| `NOTES_MOVED` | `{ noteCount:5 }` | Moved 5 notes |
| `SECTION_CREATED` | `{ label:"Verse" }` | Added section "Verse" |
| `UNDO` | `{ targetCommandType:"PATTERN_PASTED" }` | Undid "Pasted pattern" |

### Expandable mutations

Each command row in History has a toggle to expand its child `editor_events` rows. Collapsed by default. Useful for reviewing exactly what a paste or undo changed.

### Grouping removed

The `groupHistoryEvents` time-window grouping function is removed from the History panel. Each command row is already the correct granularity. The shared `group-history-events.ts` module and its usage in `HistoryPanel.tsx` are deleted.

---

## Shared Types (`packages/shared`)

Add to `packages/shared/src/events.ts`:

```typescript
export type CommandType =
  | 'SINGLE_NOTE_CREATED' | 'SINGLE_NOTE_UPDATED' | 'SINGLE_NOTE_DELETED'
  | 'PATTERN_PASTED' | 'NOTES_REPEATED' | 'NOTES_MOVED'
  | 'SECTION_CREATED' | 'SECTION_UPDATED' | 'SECTION_DELETED'
  | 'AI_NOTES_APPLIED' | 'CHART_SWITCHED' | 'UNDO'

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
  conflictId: string
  track: number
  time: number
  incomingNote: Record<string, unknown>
  existingNote: Record<string, unknown>
}

export interface UndoPreview {
  commandId: string
  commandType: CommandType
  summary: Record<string, unknown>
  conflicts: UndoConflict[]
}
```

---

## Error Handling

| Scenario | API response |
|---|---|
| No undoable command in stack | `404 { message: "Nothing to undo" }` |
| `commandId` not found or not owned by user | `404` |
| Conflict set changed between preview and apply | `409 { error: "CONFLICTS_CHANGED", conflicts: [...] }` |
| Chart not found or no edit access | `403` / `404` |

---

## Testing

### Unit tests

- `EditorCommandService.findUndoStack` returns only non-compensated, undoable commands for the right user.
- `EditorCommandService.previewUndo` returns empty conflicts when slots are free; returns conflicts when slots are occupied.
- `EditorCommandService.applyUndo` for `SINGLE_NOTE_CREATED` → soft-deletes the note.
- `EditorCommandService.applyUndo` for `PATTERN_PASTED` → reverses all child mutations, respects resolutions.
- `EditorCommandService.applyUndo` returns 409 when conflict set changes between preview and apply.
- Multi-level: stack shrinks by one on each undo call.

### Integration tests (real DB)

- Full paste → undo → paste flow with no loop.
- Paste with replace → undo with conflict resolution → slots restored correctly.

---

## Migration Strategy

1. Add `editor_commands` table and `editor_events.command_id` column in one migration.
2. Existing `editor_events` rows have `command_id = NULL` — treated as legacy, excluded from undo stack and History.
3. Old `POST /events/undo` route returns `410 Gone` pointing to new route.
4. `groupHistoryEvents` and related code removed after new History endpoint is live.
