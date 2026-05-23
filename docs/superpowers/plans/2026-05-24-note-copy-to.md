# Note Copy / Move To — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MultiSelectBar "Copy to…" for 2+ selected notes with Time/Track/Track+Time transforms, Copy/Move toggle, and reuse the conflict review modal on slot conflicts.

**Architecture:** New `NoteCopyService` with preview/apply endpoints; extract shared slot-overlap preview from pattern paste; generalize `ConflictReviewModal` to accept a `PlacementPreview` shape; wire `CopyToModal` from `EditorPage`.

**Tech Stack:** NestJS, Prisma, React 18, TypeScript, Tailwind, `@ama-midi/shared`, Node.js built-in test runner (`node:test`)

**Design spec:** `docs/superpowers/specs/2026-05-24-note-copy-to-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/shared/src/types.ts` | **Modify** | Note copy request/preview/result types |
| `packages/shared/src/placement-preview.ts` | **Create** | Shared `PlacementPreview` types |
| `apps/api/src/modules/notes/note-slot-preview.ts` | **Create** | Overlap detection shared by pattern paste + note copy |
| `apps/api/src/modules/notes/note-copy.service.ts` | **Create** | Preview + apply logic |
| `apps/api/src/modules/notes/dto/note-copy.dto.ts` | **Create** | Request validation |
| `apps/api/src/modules/notes/notes.controller.ts` | **Modify** | Two new endpoints |
| `apps/api/src/modules/notes/notes.module.ts` | **Modify** | Register `NoteCopyService` |
| `apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts` | **Create** | Service unit tests |
| `apps/api/src/modules/patterns/pattern-paste.service.ts` | **Modify** | Use shared slot preview |
| `apps/web/src/features/editor/components/placement-preview.ts` | **Create** | Map API previews → `PlacementPreview` |
| `apps/web/src/features/editor/hooks/useNoteCopy.ts` | **Create** | TanStack Query mutations |
| `apps/web/src/features/editor/components/copy-to-transform.ts` | **Create** | Client-side input validation helpers |
| `apps/web/tests/copy-to-transform.test.ts` | **Create** | Unit tests for transform helpers |
| `apps/web/src/features/editor/components/CopyToModal.tsx` | **Create** | Destination input modal |
| `apps/web/src/features/editor/components/ConflictReviewModal.tsx` | **Modify** | Accept `PlacementPreview` |
| `apps/web/src/features/editor/components/ConflictListItem.tsx` | **Modify** | Incoming note labels |
| `apps/web/src/features/editor/components/ConflictDiffCards.tsx` | **Modify** | Show incoming title |
| `apps/web/src/features/editor/components/ConflictContextStrip.tsx` | **Modify** | Use `PlacementPreview` |
| `apps/web/src/features/editor/components/PatternPanel.tsx` | **Modify** | Pass placement mapper |
| `apps/web/src/features/editor/components/MultiSelectBar.tsx` | **Modify** | Add Copy to… button |
| `apps/web/src/pages/EditorPage.tsx` | **Modify** | Wire copy flow |

---

## Task 1: Shared types

**Files:**
- Create: `packages/shared/src/placement-preview.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts` (if barrel export exists)

- [ ] **Step 1: Create placement preview types**

```typescript
// packages/shared/src/placement-preview.ts
import type { ConflictAction, NoteType } from './types'

export interface PlacementExistingNote {
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

export interface PlacementIncomingNote {
  title: string
  description: string
  track: number
  timeOffset: number
  noteType: NoteType
  duration?: number
}

export interface PlacementCreatableSlot {
  sourceIndex: number
  sourceNoteId: string
  track: number
  time: number
  noteType: NoteType
  duration?: number
  title: string
  description: string
}

export interface PlacementConflict {
  conflictId: string
  sourceIndex: number
  sourceNoteId: string
  track: number
  time: number
  incomingNote: PlacementIncomingNote
  existingNote: PlacementExistingNote
}

export interface PlacementSummary {
  totalNotes: number
  creatableNotes: number
  conflictCount: number
  affectedExistingNotes: number
}

export interface PlacementPreview {
  songId: string
  version: string
  anchorTime?: number
  summary: PlacementSummary
  creatable: PlacementCreatableSlot[]
  conflicts: PlacementConflict[]
}

export type ConflictResolutionMap = Record<string, ConflictAction>
```

- [ ] **Step 2: Add note copy types to `types.ts`**

```typescript
export type NoteCopyOperation = 'COPY' | 'MOVE'
export type NoteCopyTransformMode = 'TIME_SHIFT' | 'TRACK_SHIFT' | 'TRACK_TIME_ANCHOR'

export interface NoteCopyPreviewRequest {
  noteIds: string[]
  operation: NoteCopyOperation
  mode: NoteCopyTransformMode
  timeDelta?: number
  targetTrack?: number
  anchorTrack?: number
  anchorTime?: number
}

export interface NoteCopyApplyRequest extends NoteCopyPreviewRequest {
  selectionVersion: string
  resolutions: Array<{ conflictId: string; action: ConflictAction }>
}

export interface NoteCopyPreview {
  songId: string
  selectionVersion: string
  operation: NoteCopyOperation
  mode: NoteCopyTransformMode
  summary: PlacementSummary
  creatable: PlacementCreatableSlot[]
  conflicts: PlacementConflict[]
}

export interface NoteCopyApplyResult {
  batchId: string
  createdCount: number
  replacedCount: number
  skippedCount: number
  movedCount: number
  notes: Note[]
}
```

- [ ] **Step 3: Export from shared package index**

- [ ] **Step 4: Build shared package**

```bash
cd packages/shared && pnpm build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/placement-preview.ts packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "feat(shared): add note copy and placement preview types"
```

---

## Task 2: Shared slot preview helper (API)

**Files:**
- Create: `apps/api/src/modules/notes/note-slot-preview.ts`
- Create: `apps/api/src/modules/notes/__tests__/note-slot-preview.spec.ts`

- [ ] **Step 1: Write failing test for overlap classification**

```typescript
// apps/api/src/modules/notes/__tests__/note-slot-preview.spec.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifySlots } from '../note-slot-preview'

describe('classifySlots', () => {
  const existing = [
    { id: 'ex-1', track: 1, time: 5.0, noteType: 'TAP', duration: null },
  ]

  it('returns creatable when slot is empty', () => {
    const result = classifySlots(
      [{ sourceIndex: 0, sourceNoteId: 'a', track: 2, time: 5.0, noteType: 'TAP', title: 'A', description: '' }],
      existing,
      new Set(),
    )
    assert.equal(result.creatable.length, 1)
    assert.equal(result.conflicts.length, 0)
  })

  it('returns conflict when slot occupied', () => {
    const result = classifySlots(
      [{ sourceIndex: 0, sourceNoteId: 'a', track: 1, time: 5.0, noteType: 'TAP', title: 'A', description: '' }],
      existing,
      new Set(),
    )
    assert.equal(result.conflicts.length, 1)
    assert.equal(result.conflicts[0].conflictId, 'ex-1')
  })

  it('excludes ignored ids from overlap (MOVE)', () => {
    const result = classifySlots(
      [{ sourceIndex: 0, sourceNoteId: 'a', track: 1, time: 5.0, noteType: 'TAP', title: 'A', description: '' }],
      [{ id: 'a', track: 1, time: 5.0, noteType: 'TAP', duration: null }],
      new Set(['a']),
    )
    assert.equal(result.creatable.length, 1)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && pnpm test -- --test-path-pattern=note-slot-preview
```

- [ ] **Step 3: Implement `note-slot-preview.ts`**

Export:
- `IncomingSlot` interface
- `classifySlots(slots, existingRows, excludeIds)` → `{ creatable, conflicts, internalCollision? }`
- `detectInternalCollision(slots)` → boolean

Use existing `findOverlapping` from `note-overlap.ts`.

- [ ] **Step 4: Run test to confirm it passes**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notes/note-slot-preview.ts apps/api/src/modules/notes/__tests__/note-slot-preview.spec.ts
git commit -m "feat(api): add shared note slot preview classifier"
```

---

## Task 3: NoteCopyService

**Files:**
- Create: `apps/api/src/modules/notes/note-copy.service.ts`
- Create: `apps/api/src/modules/notes/dto/note-copy.dto.ts`
- Create: `apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts`
- Modify: `apps/api/src/modules/notes/notes.module.ts`
- Modify: `apps/api/src/modules/notes/notes.controller.ts`

- [ ] **Step 1: Write failing tests for transform + preview**

Test cases (minimum):
1. `TIME_SHIFT` +2.0s moves all times, preserves tracks
2. `TRACK_SHIFT` targetTrack=3 with minTrack=1 applies delta +2
3. `TRACK_SHIFT` rejects when any track > 8
4. `TRACK_TIME_ANCHOR` anchors earliest note
5. `MOVE` excludes source IDs from overlap
6. Internal collision → `UnprocessableEntityException`
7. Apply MOVE: source deleted only for creatable + replace slots

- [ ] **Step 2: Run tests — confirm fail**

```bash
cd apps/api && pnpm test -- --test-path-pattern=note-copy.service
```

- [ ] **Step 3: Implement DTO with class-validator**

Validate:
- `noteIds`: array, min 2, max 500
- `operation`: enum
- `mode`: enum
- mode-specific fields required per mode

- [ ] **Step 4: Implement `NoteCopyService`**

Key private methods:
- `loadSelection(noteIds, songId)` — verify ownership, chart edit access
- `computeTransformedSlots(notes, mode, params)` — apply transform + bounds check
- `buildSelectionVersion(...)` — hash for 409
- `previewCopy(request, user)` → `NoteCopyPreview`
- `applyCopy(request, user)` → `NoteCopyApplyResult`

Apply uses `$transaction`, soft-deletes, ledger events (mirror `PatternPasteService.applyPaste`).

- [ ] **Step 5: Register in module + add controller routes**

```typescript
@Post('copy-preview')
@Post('copy-apply')
```

Under `@Controller('songs/:songId/notes')` or equivalent existing notes route prefix.

- [ ] **Step 6: Run tests — confirm pass**

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/notes/
git commit -m "feat(api): add note copy/move preview and apply endpoints"
```

---

## Task 4: Refactor pattern paste to use shared classifier

**Files:**
- Modify: `apps/api/src/modules/patterns/pattern-paste.service.ts`

- [ ] **Step 1: Run existing pattern paste tests**

```bash
cd apps/api && pnpm test -- --test-path-pattern=pattern-paste
```

Note baseline pass count.

- [ ] **Step 2: Replace inline overlap loop in `buildPreview` with `classifySlots`**

Map pattern slots to `IncomingSlot` shape; map results back to `PatternPasteCreatableNote` / `PatternPasteConflict`.

- [ ] **Step 3: Run pattern paste tests — confirm still pass**

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/patterns/pattern-paste.service.ts
git commit -m "refactor(api): use shared slot classifier in pattern paste"
```

---

## Task 5: Frontend transform helpers

**Files:**
- Create: `apps/web/src/features/editor/components/copy-to-transform.ts`
- Create: `apps/web/tests/copy-to-transform.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTimeDeltaDraft, validateTrackTarget } from '../src/features/editor/components/copy-to-transform.ts'

test('parseTimeDeltaDraft accepts signed decimal', () => {
  assert.equal(parseTimeDeltaDraft('+2.0'), 2.0)
  assert.equal(parseTimeDeltaDraft('-1.5'), -1.5)
})

test('validateTrackTarget rejects out of range for selection minTrack', () => {
  const err = validateTrackTarget(3, 1, 2) // minTrack=1, count=2 → max target 7
  assert.equal(err, null)
  const bad = validateTrackTarget(8, 1, 2) // would push note on track 2 to track 9
  assert.ok(bad)
})
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd apps/web && node --experimental-strip-types --test tests/copy-to-transform.test.ts
```

- [ ] **Step 3: Implement helpers**

- [ ] **Step 4: Run — confirm pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/copy-to-transform.ts apps/web/tests/copy-to-transform.test.ts
git commit -m "feat(editor): add copy-to transform validation helpers"
```

---

## Task 6: Generalize conflict review UI

**Files:**
- Create: `apps/web/src/features/editor/components/placement-preview.ts`
- Modify: `ConflictReviewModal.tsx`, `ConflictListItem.tsx`, `ConflictDiffCards.tsx`, `ConflictContextStrip.tsx`, `PatternPanel.tsx`

- [ ] **Step 1: Create mappers**

```typescript
// placement-preview.ts
import type { NoteCopyPreview, PatternPastePreview, PlacementPreview } from '@ama-midi/shared'

export function patternPreviewToPlacement(preview: PatternPastePreview, patternName: string): PlacementPreview
export function noteCopyPreviewToPlacement(preview: NoteCopyPreview): PlacementPreview
export function mergeResolutions(
  old: Record<string, ConflictAction>,
  conflicts: PlacementConflict[],
): Record<string, ConflictAction>
```

Extract `mergeResolutions` from `PatternPanel.tsx` into this file.

- [ ] **Step 2: Update ConflictReviewModal props**

Replace `PatternPastePreview` with `PlacementPreview`. Replace `patternName` with `title: string`. Add optional `incomingLabel` (default `'Incoming'`).

Update footer/header strings:
- Pattern: `"Paste Pattern — {name}"`
- Copy: `"Copy Notes"`
- Move: `"Move Notes"`

- [ ] **Step 3: Update sub-components**

`ConflictListItem`: read `incomingNote.noteType` instead of `patternNote.noteType`.

`ConflictDiffCards`: show `incomingNote.title` instead of hardcoded "New note"; update label text from "PATTERN" to `incomingLabel`.

`ConflictContextStrip`: accept `PlacementPreview`.

- [ ] **Step 4: Update PatternPanel to use mapper**

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/
git commit -m "feat(editor): generalize conflict review UI for placement preview"
```

---

## Task 7: useNoteCopy hook

**Files:**
- Create: `apps/web/src/features/editor/hooks/useNoteCopy.ts`

- [ ] **Step 1: Implement hooks**

```typescript
export function usePreviewNoteCopy(songId: string)
export function useApplyNoteCopy(songId: string)
```

Mirror `usePatterns.ts` pattern:
- `POST /songs/${songId}/notes/copy-preview`
- `POST /songs/${songId}/notes/copy-apply`
- Invalidate `['notes', songId]` on apply success

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/hooks/useNoteCopy.ts
git commit -m "feat(editor): add useNoteCopy preview/apply hooks"
```

---

## Task 8: CopyToModal

**Files:**
- Create: `apps/web/src/features/editor/components/CopyToModal.tsx`

- [ ] **Step 1: Create modal component**

State machine: `INPUT` | `VALIDATING`

Props:
```typescript
interface Props {
  songId: string
  selectedNotes: Note[]
  onCancel: () => void
  onPreviewReady: (preview: NoteCopyPreview, operation: NoteCopyOperation) => void
}
```

UI per design spec:
- Copy/Move toggle
- Mode tabs: Time | Track | Track + Time
- Mode inputs using `copy-to-transform` helpers + `pattern-placement` time formatters
- Validate button calls `usePreviewNoteCopy`

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep CopyToModal
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/CopyToModal.tsx
git commit -m "feat(editor): add CopyToModal for note copy/move destination"
```

---

## Task 9: Wire EditorPage + MultiSelectBar

**Files:**
- Modify: `MultiSelectBar.tsx`
- Modify: `EditorPage.tsx`

- [ ] **Step 1: Add button to MultiSelectBar**

```typescript
interface Props {
  count: number
  onSavePattern: () => void
  onCopyTo: () => void
  onDelete: () => void
  onDeselect: () => void
  copyDisabled?: boolean
}
```

- [ ] **Step 2: Wire EditorPage state**

```typescript
const [showCopyTo, setShowCopyTo] = useState(false)
const [copyPreview, setCopyPreview] = useState<NoteCopyPreview | null>(null)
const [copyResolutions, setCopyResolutions] = useState<ConflictResolutionMap>({})
const [copyConflictChanged, setCopyConflictChanged] = useState(false)
const [copyStep, setCopyStep] = useState<'INPUT' | 'REVIEW' | 'APPLYING'>('INPUT')
```

Flow:
1. MultiSelectBar `onCopyTo` → `setShowCopyTo(true)`
2. CopyToModal `onPreviewReady` → set preview, `{}` resolutions, `setCopyStep('REVIEW')`, close CopyToModal
3. `copyStep === 'REVIEW'` → render `ConflictReviewModal` with `noteCopyPreviewToPlacement(preview)` and title `"Copy Notes"` or `"Move Notes"`
4. Apply calls `useApplyNoteCopy` with 409 handler using `mergeResolutions`

Pass `copyDisabled={!canEdit}` to MultiSelectBar.

- [ ] **Step 3: Run web tests**

```bash
cd apps/web && node --experimental-strip-types --test tests/copy-to-transform.test.ts tests/conflict-formatters.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/MultiSelectBar.tsx apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): wire copy-to flow from MultiSelectBar through conflict review"
```

---

## Task 10: Manual verification

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify acceptance criteria**

| Check | Expected |
|---|---|
| MultiSelectBar | "Copy to…" visible at 2+ selection, disabled when read-only |
| CopyToModal | Copy/Move toggle + 3 mode tabs |
| Time shift | Notes offset by delta, no track change |
| Track shift | Relative track spacing preserved; track 9 blocked |
| Track+Time | Earliest note anchors to target |
| Conflicts | Same ConflictReviewModal UI as pattern paste |
| Copy | Originals remain after apply |
| Move | Sources removed for moved slots; kept when KEEP_EXISTING |
| 409 | Banner + resolution merge on stale selection |
| K / R keys | Resolve active conflict |
| Escape | Cancels, clears selection state |

- [ ] **Step 3: Run API tests**

```bash
cd apps/api && pnpm test -- --test-path-pattern="note-copy|note-slot-preview|pattern-paste"
```

---

## Self-Review Notes

- **Float precision:** All times in UI use `formatTime()` / `formatOffset()` from `conflict-formatters.ts`.
- **MOVE + KEEP_EXISTING:** Source note is **not** deleted when user keeps the existing note at that destination — documented in spec; tests must cover this.
- **`REPLACE_WITH_PATTERN` name:** Kept for compatibility; UI shows "Replace With Incoming" in copy flow via `incomingLabel` prop.
- **PatternPanel regression:** Task 6 must keep pattern paste working via `patternPreviewToPlacement` mapper.
- **No single-note entry:** By design; MultiSelectBar requires 2+.
