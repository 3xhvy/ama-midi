# Paste Behavior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Git-like pattern paste flow that previews conflicts, shows affected note details including creator info, lets users resolve conflicts note-by-note, and applies the paste atomically.

**Architecture:** The backend becomes the source of truth for paste validation and conflict detection. The frontend keeps the existing paste popup, but replaces direct note-by-note creation with a preview/review/apply state machine. Pattern paste apply soft-deletes replaced notes, creates new notes, records a batch id, and broadcasts one batched realtime update.

**Tech Stack:** NestJS, Prisma, PostgreSQL, EventEmitter2, Socket.io, React, TanStack Query, Zustand, TypeScript, Node test, Jest.

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/shared/src/types.ts` | Shared paste request/response/resolution types. |
| `packages/shared/src/events.ts` | Batch event payload types and optional batch metadata on note events. |
| `apps/api/prisma/schema.prisma` | Add `batchId` and `replacesNoteId` to `NoteEvent`. |
| `apps/api/src/modules/patterns/dto/pattern-paste.dto.ts` | Validate preview/apply request bodies. |
| `apps/api/src/modules/patterns/pattern-paste.service.ts` | Pure-ish paste preview/apply workflow owned by patterns module. |
| `apps/api/src/modules/patterns/patterns.controller.ts` | Add preview/apply endpoints. |
| `apps/api/src/modules/patterns/patterns.module.ts` | Provide `PatternPasteService`. |
| `apps/api/src/modules/notes/note-overlap.ts` | Extend overlap helpers so preview and normal note creation share rules. |
| `apps/api/src/modules/ledger/ledger.listener.ts` | Persist batch metadata on note events. |
| `apps/api/src/modules/realtime/realtime.listener.ts` | Broadcast one `notes-batch-applied` event. |
| `apps/web/src/features/patterns/usePatterns.ts` | Add preview/apply mutations. |
| `apps/web/src/features/editor/components/PatternPanel.tsx` | Replace direct paste with conflict review UI. |
| `apps/web/src/features/collaboration/useSocket.ts` | Merge batch-created and batch-deleted notes into cache. |

## Task 1: Shared Paste Contracts

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/events.ts`
- Test: `apps/web/tests/pattern-placement.test.ts`

- [ ] **Step 1: Add shared paste types**

In `packages/shared/src/types.ts`, append these types after `NotePattern`:

```ts
export type ConflictAction = 'KEEP_EXISTING' | 'REPLACE_WITH_PATTERN'

export interface PatternPastePreviewRequest {
  songId: string
  startTime: number
}

export interface PatternPasteCreatableNote {
  patternNoteIndex: number
  track: number
  time: number
  noteType: NoteType
  duration?: number
}

export interface PatternPasteConflict {
  conflictId: string
  patternNoteIndex: number
  track: number
  time: number
  patternNote: {
    track: number
    timeOffset: number
    noteType: NoteType
    duration?: number
  }
  existingNote: {
    id: string
    title: string
    description: string
    track: number
    time: number
    noteType: NoteType
    duration?: number
    createdBy: string
    creatorName: string
    creatorAvatarUrl?: string
    createdAt: string
  }
}

export interface PatternPastePreview {
  patternId: string
  patternVersion: string
  songId: string
  startTime: number
  summary: {
    totalPatternNotes: number
    creatableNotes: number
    conflictCount: number
    affectedExistingNotes: number
  }
  creatable: PatternPasteCreatableNote[]
  conflicts: PatternPasteConflict[]
}

export interface PatternPasteApplyRequest {
  songId: string
  startTime: number
  patternVersion: string
  resolutions: Array<{
    conflictId: string
    action: ConflictAction
  }>
}

export interface PatternPasteApplyResult {
  batchId: string
  createdCount: number
  replacedCount: number
  skippedCount: number
  notes: Note[]
}
```

- [ ] **Step 2: Add batch event contracts**

In `packages/shared/src/events.ts`, update the note event interfaces:

```ts
export interface NoteCreatedEvent {
  songId: string
  noteId: string
  userId: string
  afterState: Note
  batchId?: string
  replacesNoteId?: string
  realtimeMode?: 'single' | 'batch'
}

export interface NoteDeletedEvent {
  songId: string
  noteId: string
  userId: string
  beforeState: Partial<Note>
  batchId?: string
  replacedByBatch?: boolean
  realtimeMode?: 'single' | 'batch'
}

export interface NotesBatchAppliedPayload {
  songId: string
  batchId: string
  created: Note[]
  deletedIds: string[]
  actorId: string
}
```

Also extend the event constants:

```ts
export const NOTE_EVENTS = {
  CREATED: 'note.created',
  UPDATED: 'note.updated',
  DELETED: 'note.deleted',
  BATCH_APPLIED: 'notes.batch-applied',
} as const
```

- [ ] **Step 3: Run frontend type-adjacent tests**

Run:

```bash
node --test apps/web/tests/pattern-placement.test.ts
```

Expected: PASS. This step proves the shared type changes did not break the existing Node ESM test import path.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/events.ts
git commit -m "feat: add pattern paste shared contracts"
```

## Task 2: Prisma Batch Metadata

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260523180000_note_event_batch_metadata/migration.sql`

- [ ] **Step 1: Update schema**

In `apps/api/prisma/schema.prisma`, update `model NoteEvent`:

```prisma
model NoteEvent {
  id             String        @id @default(uuid())
  songId         String
  noteId         String?
  eventType      NoteEventType
  userId         String
  beforeState    Json?
  afterState     Json?
  batchId        String?       @db.Uuid
  replacesNoteId String?       @db.Uuid
  createdAt      DateTime      @default(now())

  song Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@index([batchId])
  @@map("note_events")
}
```

- [ ] **Step 2: Create migration**

Create `apps/api/prisma/migrations/20260523180000_note_event_batch_metadata/migration.sql`:

```sql
ALTER TABLE "note_events"
ADD COLUMN "batchId" UUID,
ADD COLUMN "replacesNoteId" UUID;

CREATE INDEX "note_events_batchId_idx" ON "note_events"("batchId");
```

- [ ] **Step 3: Validate Prisma schema**

Run:

```bash
cd apps/api && npx prisma validate
```

Expected: Prisma schema validation succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat: add note event batch metadata"
```

## Task 3: Backend Paste DTOs and Overlap Helpers

**Files:**
- Create: `apps/api/src/modules/patterns/dto/pattern-paste.dto.ts`
- Modify: `apps/api/src/modules/notes/note-overlap.ts`
- Test: `apps/api/src/modules/notes/__tests__/note-overlap.spec.ts`

- [ ] **Step 1: Add DTOs**

Create `apps/api/src/modules/patterns/dto/pattern-paste.dto.ts`:

```ts
import { IsArray, IsEnum, IsNumber, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import type { ConflictAction } from '@ama-midi/shared'

class PatternPasteResolutionDto {
  @IsString()
  conflictId!: string

  @IsEnum(['KEEP_EXISTING', 'REPLACE_WITH_PATTERN'])
  action!: ConflictAction
}

export class PatternPastePreviewDto {
  @IsUUID()
  songId!: string

  @IsNumber()
  @Min(0)
  @Max(300)
  startTime!: number
}

export class PatternPasteApplyDto {
  @IsUUID()
  songId!: string

  @IsNumber()
  @Min(0)
  @Max(300)
  startTime!: number

  @IsString()
  patternVersion!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatternPasteResolutionDto)
  resolutions!: PatternPasteResolutionDto[]
}
```

- [ ] **Step 2: Extend overlap helpers**

Replace `apps/api/src/modules/notes/note-overlap.ts` with:

```ts
export interface NoteSpan {
  time: number
  noteType: string
  duration?: number | null
}

export interface NoteSlot extends NoteSpan {
  track: number
}

export function noteEnd(note: NoteSpan): number {
  if (note.noteType === 'HOLD' && note.duration != null && note.duration > 0) {
    return note.time + note.duration
  }
  return note.time
}

export function noteRange(note: NoteSpan): { start: number; end: number } {
  const start = note.time
  const end = noteEnd(note)
  return end === start ? { start, end: start + 0.0001 } : { start, end }
}

export function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end
}

export function notesOverlap(a: NoteSlot, b: NoteSlot): boolean {
  return a.track === b.track && rangesOverlap(noteRange(a), noteRange(b))
}

export function findOverlapping<T extends NoteSlot>(
  candidate: NoteSlot,
  existing: T[],
): T | undefined {
  return existing.find((note) => notesOverlap(candidate, note))
}

export function overlapsAny(
  candidate: NoteSpan,
  others: NoteSpan[],
): boolean {
  const next = noteRange(candidate)
  return others.some((other) => rangesOverlap(next, noteRange(other)))
}
```

- [ ] **Step 3: Add overlap tests**

In `apps/api/src/modules/notes/__tests__/note-overlap.spec.ts`, add:

```ts
import { findOverlapping, notesOverlap } from '../note-overlap'

describe('pattern paste overlap helpers', () => {
  it('treats tap notes at the same track and time as overlapping', () => {
    expect(notesOverlap(
      { track: 2, time: 42.5, noteType: 'TAP' },
      { track: 2, time: 42.5, noteType: 'TAP' },
    )).toBe(true)
  })

  it('does not conflict across different tracks', () => {
    expect(notesOverlap(
      { track: 2, time: 42.5, noteType: 'TAP' },
      { track: 3, time: 42.5, noteType: 'TAP' },
    )).toBe(false)
  })

  it('finds an existing hold note that overlaps a pasted tap', () => {
    const existing = [
      { id: 'n1', track: 4, time: 10, noteType: 'HOLD', duration: 2 },
    ]
    expect(findOverlapping({ track: 4, time: 11, noteType: 'TAP' }, existing)?.id).toBe('n1')
  })
})
```

- [ ] **Step 4: Run tests**

Run:

```bash
cd apps/api && pnpm test -- note-overlap
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/patterns/dto/pattern-paste.dto.ts apps/api/src/modules/notes/note-overlap.ts apps/api/src/modules/notes/__tests__/note-overlap.spec.ts
git commit -m "feat: add pattern paste dto and overlap helpers"
```

## Task 4: Backend Preview Service

**Files:**
- Create: `apps/api/src/modules/patterns/pattern-paste.service.ts`
- Modify: `apps/api/src/modules/patterns/patterns.module.ts`
- Modify: `apps/api/src/modules/patterns/patterns.controller.ts`
- Test: `apps/api/src/modules/patterns/__tests__/pattern-paste.service.spec.ts`

- [ ] **Step 1: Write failing preview tests**

Create `apps/api/src/modules/patterns/__tests__/pattern-paste.service.spec.ts` with tests for:

```ts
it('previews all notes as creatable when no existing note overlaps')
it('returns conflict details including existing note creator fields')
it('uses existing note id as stable conflictId')
it('rejects patterns larger than 500 notes')
```

Use Prisma mocks matching existing service test style. Mock `projectAccess.assertCanEditSongChart`, `prisma.notePattern.findUnique`, and `prisma.note.findMany`.

- [ ] **Step 2: Create preview service**

Create `apps/api/src/modules/patterns/pattern-paste.service.ts` with:

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectAccessService } from '../project-access/project-access.service'
import { findOverlapping, type NoteSlot } from '../notes/note-overlap'
import { NOTE_EVENTS, TIME_MAX, TIME_MIN, TRACK_MAX, TRACK_MIN } from '@ama-midi/shared'
import type {
  AuthUser,
  ConflictAction,
  Note,
  NotePattern,
  PatternNote,
  PatternPasteApplyRequest,
  PatternPasteApplyResult,
  PatternPasteConflict,
  PatternPastePreview,
  PatternPastePreviewRequest,
} from '@ama-midi/shared'

const MAX_PATTERN_PASTE_NOTES = 500

function snapTime(time: number): number {
  return Math.round(time * 10) / 10
}
```

Implement `previewPaste(patternId, request, user)`:

```ts
async previewPaste(patternId: string, request: PatternPastePreviewRequest, user: AuthUser): Promise<PatternPastePreview> {
  await this.access.assertCanEditSongChart(request.songId, user)
  const pattern = await this.loadPattern(patternId)
  return this.buildPreview(pattern, request.songId, request.startTime)
}
```

Required private helpers:

```ts
private async loadPattern(patternId: string)
private toPatternNoteSlots(pattern: NotePattern, songId: string, startTime: number)
private async buildPreview(pattern: NotePattern, songId: string, startTime: number)
private toDomainNote(row: any): Note
```

Implementation rules:

- `patternVersion = row.updatedAt?.toISOString() ?? row.createdAt.toISOString()`. If `NotePattern` lacks `updatedAt`, use `createdAt` for v1.
- Reject `pattern.notes.length > 500` with `UnprocessableEntityException`.
- Snap every pasted note absolute time.
- Reject absolute pasted time outside `0..300` with `BadRequestException`.
- Load active notes for affected tracks only:

```ts
const existing = await this.prisma.note.findMany({
  where: {
    songId,
    deletedAt: null,
    track: { in: [...new Set(slots.map((slot) => slot.track))] },
  },
  include: { creator: { select: { name: true, avatarUrl: true } } },
})
```

- Use `findOverlapping(candidate, existingSlots)` for conflicts.
- `conflictId = existingNote.id`.

- [ ] **Step 3: Register service and endpoint**

In `patterns.module.ts`, add `PatternPasteService` to providers.

In `patterns.controller.ts`, inject it and add:

```ts
@Post(':patternId/preview-paste')
previewPaste(
  @Req() req: Request,
  @Param('patternId') patternId: string,
  @Body() dto: PatternPastePreviewDto,
) {
  return this.paste.previewPaste(patternId, dto, req.user as AuthUser)
}
```

- [ ] **Step 4: Run backend tests**

Run:

```bash
cd apps/api && pnpm test -- pattern-paste.service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/patterns
git commit -m "feat: preview pattern paste conflicts"
```

## Task 5: Backend Atomic Apply

**Files:**
- Modify: `apps/api/src/modules/patterns/pattern-paste.service.ts`
- Modify: `apps/api/src/modules/patterns/patterns.controller.ts`
- Modify: `apps/api/src/modules/ledger/ledger.listener.ts`
- Modify: `apps/api/src/modules/realtime/realtime.listener.ts`
- Test: `apps/api/src/modules/patterns/__tests__/pattern-paste.service.spec.ts`

- [ ] **Step 1: Add failing apply tests**

Add tests for:

```ts
it('applies safe notes and skips conflicts marked KEEP_EXISTING')
it('soft-deletes conflicting notes and creates replacements for REPLACE_WITH_PATTERN')
it('returns 409 with fresh preview when patternVersion changes')
it('returns 409 with fresh preview when current conflict ids differ from requested resolutions')
it('emits one batch applied event with created notes and deleted ids')
```

- [ ] **Step 2: Implement apply endpoint**

In `patterns.controller.ts`:

```ts
@Post(':patternId/apply-paste')
applyPaste(
  @Req() req: Request,
  @Param('patternId') patternId: string,
  @Body() dto: PatternPasteApplyDto,
) {
  return this.paste.applyPaste(patternId, dto, req.user as AuthUser)
}
```

- [ ] **Step 3: Implement apply transaction**

In `PatternPasteService`, add:

```ts
async applyPaste(patternId: string, request: PatternPasteApplyRequest, user: AuthUser): Promise<PatternPasteApplyResult>
```

Rules:

- Assert edit access before transaction.
- Load pattern and verify `patternVersion`.
- Rebuild current preview before writing.
- If current conflict ids do not match request conflict ids, throw:

```ts
throw new ConflictException({
  error: 'CONFLICTS_CHANGED',
  preview,
})
```

- If pattern version changed, throw:

```ts
throw new ConflictException({
  error: 'PATTERN_VERSION_CHANGED',
  preview,
})
```

- Generate `batchId = randomUUID()`.
- For each `REPLACE_WITH_PATTERN`, soft-delete the existing note first.
- Create all safe notes and all replacement notes.
- Emit `NOTE_EVENTS.DELETED` and `NOTE_EVENTS.CREATED` with `realtimeMode: 'batch'`.
- Emit `NOTE_EVENTS.BATCH_APPLIED` once with:

```ts
{
  songId: request.songId,
  batchId,
  created,
  deletedIds,
  actorId: user.id,
}
```

- Return counts:

```ts
{
  batchId,
  createdCount: created.length,
  replacedCount: deletedIds.length,
  skippedCount: preview.conflicts.length - deletedIds.length,
  notes: created,
}
```

- [ ] **Step 4: Persist batch metadata**

In `ledger.listener.ts`, include optional metadata:

```ts
batchId: batchId ?? null,
replacesNoteId: replacesNoteId ?? null,
```

for create events, and:

```ts
batchId: batchId ?? null,
```

for delete events.

- [ ] **Step 5: Add batch realtime handling**

In `realtime.listener.ts`, ignore single note broadcasts when `realtimeMode === 'batch'`:

```ts
if (event.realtimeMode === 'batch') return
```

Add:

```ts
@OnEvent(NOTE_EVENTS.BATCH_APPLIED)
onNotesBatchApplied(payload: NotesBatchAppliedPayload) {
  this.gateway.broadcastToSong(payload.songId, 'notes-batch-applied', payload)
}
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
cd apps/api && pnpm test -- pattern-paste.service
cd apps/api && pnpm test -- notes.service
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/patterns apps/api/src/modules/ledger apps/api/src/modules/realtime
git commit -m "feat: apply pattern paste atomically"
```

## Task 6: Frontend API Hooks

**Files:**
- Modify: `apps/web/src/features/patterns/usePatterns.ts`
- Test: `apps/web/tests/pattern-placement.test.ts`

- [ ] **Step 1: Add paste hooks**

In `usePatterns.ts`, import paste types:

```ts
import type {
  NotePattern,
  PatternNote,
  PatternPasteApplyRequest,
  PatternPasteApplyResult,
  PatternPastePreview,
  PatternPastePreviewRequest,
} from '@ama-midi/shared'
```

Add:

```ts
export function usePreviewPatternPaste(patternId?: string) {
  const token = useAuthStore(s => s.token)
  return useMutation({
    mutationFn: (body: PatternPastePreviewRequest) =>
      apiClient(token)<PatternPastePreview>(`/patterns/${patternId}/preview-paste`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })
}

export function useApplyPatternPaste(patternId?: string) {
  const token = useAuthStore(s => s.token)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PatternPasteApplyRequest) =>
      apiClient(token)<PatternPasteApplyResult>(`/patterns/${patternId}/apply-paste`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['notes', variables.songId], exact: false })
      qc.invalidateQueries({ queryKey: ['validation', variables.songId] })
    },
  })
}
```

- [ ] **Step 2: Run web build**

Run:

```bash
pnpm --filter @ama-midi/web build
```

Expected: TypeScript passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/patterns/usePatterns.ts
git commit -m "feat: add pattern paste api hooks"
```

## Task 7: Frontend Conflict Review Popup

**Files:**
- Modify: `apps/web/src/features/editor/components/PatternPanel.tsx`
- Test: `apps/web/tests/pattern-placement.test.ts`

- [ ] **Step 1: Replace direct paste behavior**

Remove direct `useCreateNote` paste logic from `PatternPanel`. Keep the existing paste time input helpers.

Add state:

```ts
type PasteStep = 'INPUT' | 'VALIDATING' | 'REVIEW' | 'CONFIRM_REPLACE_ALL' | 'APPLYING'
type ConflictResolutionState = Record<string, ConflictAction>

const [step, setStep] = useState<PasteStep>('INPUT')
const [preview, setPreview] = useState<PatternPastePreview | null>(null)
const [resolutions, setResolutions] = useState<ConflictResolutionState>({})
```

- [ ] **Step 2: Add validation action**

On `Validate`, call:

```ts
previewPaste.mutate(
  { songId, startTime: pasteTime },
  {
    onSuccess: (next) => {
      setPreview(next)
      setResolutions(Object.fromEntries(
        next.conflicts.map((conflict) => [conflict.conflictId, 'KEEP_EXISTING']),
      ))
      setStep('REVIEW')
    },
  },
)
```

- [ ] **Step 3: Render review summary**

When `preview` exists, show:

```txt
<totalPatternNotes> pattern notes
<creatableNotes> will be created
<conflictCount> conflicts found
<affectedExistingNotes> existing notes affected
```

If `preview.conflicts.length === 0`, show `[Paste]`.

If conflicts exist, show:

```txt
[Keep all existing] [Replace all conflicts]
```

and one row per conflict:

```txt
Track {track} · {time}s
Existing: "{title}" · {noteType} · {creatorName}
Pattern: {noteType} · offset +{timeOffset}s
[Keep Existing] [Replace With Pattern]
```

- [ ] **Step 4: Add replace-all confirmation**

When user clicks `Replace all conflicts`, set `step = 'CONFIRM_REPLACE_ALL'`.

The confirmation body must list affected creators:

```ts
const affectedCreators = preview.conflicts.reduce<Record<string, number>>((acc, conflict) => {
  const name = conflict.existingNote.creatorName || 'Unknown'
  acc[name] = (acc[name] ?? 0) + 1
  return acc
}, {})
```

Confirmation copy:

```txt
Replace {conflictCount} existing notes?
This will remove notes created by:
{creatorName}: {count} notes
This action will be recorded in history.
```

On confirm, set every conflict action to `REPLACE_WITH_PATTERN` and return to `REVIEW`.

- [ ] **Step 5: Apply selected resolutions**

Compute final counts:

```ts
const replacedCount = Object.values(resolutions).filter((action) => action === 'REPLACE_WITH_PATTERN').length
const skippedCount = preview.conflicts.length - replacedCount
const createCount = preview.creatable.length + replacedCount
```

Apply payload:

```ts
{
  songId,
  startTime: preview.startTime,
  patternVersion: preview.patternVersion,
  resolutions: preview.conflicts.map((conflict) => ({
    conflictId: conflict.conflictId,
    action: resolutions[conflict.conflictId] ?? 'KEEP_EXISTING',
  })),
}
```

On success, close the popup and toast:

```txt
Pasted {createdCount} notes, replaced {replacedCount}, skipped {skippedCount}
```

On `409`, read `err.body.preview` if available, replace `preview`, reset resolutions to `KEEP_EXISTING`, and keep popup open with:

```txt
Paste changed while you were reviewing. Review the updated conflicts.
```

- [ ] **Step 6: Run web build**

Run:

```bash
pnpm --filter @ama-midi/web build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor/components/PatternPanel.tsx
git commit -m "feat: review pattern paste conflicts"
```

## Task 8: Frontend Batch Realtime Cache Merge

**Files:**
- Modify: `apps/web/src/features/collaboration/useSocket.ts`
- Test: `pnpm --filter @ama-midi/web build`

- [ ] **Step 1: Add batch socket handler**

Import `NotesBatchAppliedPayload` from shared and add:

```ts
socket.on('notes-batch-applied', (payload: NotesBatchAppliedPayload) => {
  queryClient.setQueriesData<Note[]>(
    { queryKey: ['notes', songId], exact: false },
    (old) => {
      if (!old) return payload.created
      const deleted = new Set(payload.deletedIds)
      const createdById = new Map(payload.created.map((note) => [note.id, note]))
      const kept = old.filter((note) => !deleted.has(note.id) && !createdById.has(note.id))
      return [...kept, ...payload.created]
    },
  )
  queryClient.invalidateQueries({ queryKey: ['validation', songId] })
})
```

- [ ] **Step 2: Run web build**

Run:

```bash
pnpm --filter @ama-midi/web build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/collaboration/useSocket.ts
git commit -m "feat: merge pattern paste batch updates"
```

## Task 9: Batch Undo

**Files:**
- Modify: `apps/api/src/modules/notes/notes.service.ts`
- Test: `apps/api/src/modules/notes/__tests__/notes.service.spec.ts`

- [ ] **Step 1: Add undo tests**

Add tests:

```ts
it('undo reverts every created note in the latest batch')
it('undo restores notes deleted by a replacement batch')
it('undo keeps single-note undo behavior when latest event has no batchId')
```

- [ ] **Step 2: Implement batch undo**

Update `NotesService.undo`:

- Load the latest `NoteEvent` for the user.
- If `lastEvent.batchId` is null, keep current behavior.
- If `lastEvent.batchId` exists, load all events with that batch id ordered by `createdAt desc`.
- For each `NOTE_CREATED`, soft-delete the active created note.
- For each `NOTE_DELETED`, recreate the note from `beforeState` if no active note occupies the same slot.
- Emit compensating events with a new batch id.

Use existing `softDelete` for created notes only when it is acceptable to enforce creator ownership; for replacement batch undo, direct service logic should allow the original actor to revert the batch they created.

- [ ] **Step 3: Run API tests**

Run:

```bash
cd apps/api && pnpm test -- notes.service
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notes/notes.service.ts apps/api/src/modules/notes/__tests__/notes.service.spec.ts
git commit -m "feat: undo pattern paste batches"
```

## Task 10: End-to-End Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend tests**

```bash
cd apps/api && pnpm test -- pattern-paste.service
cd apps/api && pnpm test -- notes.service
cd apps/api && pnpm test -- note-overlap
```

Expected: all pass.

- [ ] **Step 2: Run focused frontend tests**

```bash
node --test apps/web/tests/pattern-placement.test.ts
node --test apps/web/tests/editor-selection.test.ts
node --test apps/web/tests/selection-box.test.ts
```

Expected: all pass.

- [ ] **Step 3: Build web and API**

```bash
pnpm --filter @ama-midi/web build
pnpm --filter @ama-midi/api build
```

Expected: both builds pass. A Vite large chunk warning is acceptable.

- [ ] **Step 4: Manual QA**

Verify in the editor:

```txt
Paste pattern with no conflicts -> creates every pattern note.
Paste with TAP conflict -> preview shows existing note creator and defaults to Keep Existing.
Paste with HOLD overlap -> preview shows conflict even when time is not exactly equal.
Replace one conflict -> only that existing note is soft-deleted.
Replace all -> confirmation lists affected creators and counts.
Apply after another user creates a new conflict -> UI receives 409 and shows fresh conflict review.
Undo after paste -> whole paste batch reverts.
Collaborator tab receives one notes-batch-applied update.
History shows deleted and created events with the same batchId.
```

- [ ] **Step 5: Commit final fixes**

```bash
git status --short
git add packages/shared/src/types.ts \
        packages/shared/src/events.ts \
        apps/api/prisma/schema.prisma \
        apps/api/prisma/migrations/20260523180000_note_event_batch_metadata/migration.sql \
        apps/api/src/modules/patterns \
        apps/api/src/modules/notes \
        apps/api/src/modules/ledger/ledger.listener.ts \
        apps/api/src/modules/realtime/realtime.listener.ts \
        apps/web/src/features/patterns/usePatterns.ts \
        apps/web/src/features/editor/components/PatternPanel.tsx \
        apps/web/src/features/collaboration/useSocket.ts
git commit -m "test: verify pattern paste conflict flow"
```

## Self-Review Checklist

- Spec coverage: preview, affected count, creator details, per-note replace, replace-all confirmation, atomic apply, patternVersion, stable conflictId, batch realtime, and batch undo are covered.
- Placeholder scan: no task relies on an unspecified file or behavior; each task states concrete files and commands.
- Type consistency: `ConflictAction`, `PatternPastePreview`, `PatternPasteApplyRequest`, and `PatternPasteApplyResult` are used consistently across shared types, backend DTOs, frontend hooks, and UI.
