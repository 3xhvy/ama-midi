# Note Copy / Move To — Design Spec

**Date:** 2026-05-24  
**Status:** Approved (user requested full design + plan)  
**Scope:** Backend API + frontend editor flow for multi-selected notes  
**Depends on:** Paste Pattern Conflict Review UI (`ConflictReviewModal` and sub-components)

---

## Goal

Add a **Copy to…** action on the MultiSelectBar (2+ notes selected) that lets users duplicate or relocate the selection to new track/time positions. When destination slots are occupied, show the same git-style conflict resolver used for pattern paste.

---

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Operation | User toggles **Copy** (originals stay) or **Move** (originals deleted on apply) |
| Destination modes | All three in one dialog: **Time shift**, **Track shift**, **Track + Time anchor** |
| Entry point | **MultiSelectBar only** — requires 2+ selected notes |
| Track remap | Preserve relative track spacing (shared delta); **block** if any note would leave tracks 1–8 |
| Time bounds | Same rule for time: block if any note (or HOLD end) would leave 0.0–300.0s |
| Note data | Full clone: title, description, noteType, duration; new notes attributed to **current user** |
| Conflicts | Reuse `ConflictReviewModal` UI; per-conflict Keep Existing / Replace With Incoming |
| Architecture | Dedicated preview/apply API; shared overlap logic with pattern paste |

---

## User Flow

```
MultiSelectBar [Copy to…]
       ↓
CopyToModal
  - Copy / Move toggle
  - Mode: Time | Track | Track+Time
  - Mode inputs (see below)
  - [Validate]
       ↓
API preview
       ↓
ConflictReviewModal (if conflicts OR zero-conflict summary)
  - Resolve each conflict
  - [Paste N notes →] / [Move N notes →]
       ↓
API apply → toast → clear selection
```

### Mode inputs

| Mode | User input | Transform |
|---|---|---|
| **Time shift** | Delta in seconds (±), e.g. `+2.0` | `newTime = snap(oldTime + delta)`, track unchanged |
| **Track shift** | Target track for the selection's **lowest track** | `trackDelta = targetTrack − minTrack`; `newTrack = oldTrack + trackDelta` |
| **Track + Time** | Target track (for lowest track) + target time (for earliest note) | Same deltas applied together |

**Anchor references** (computed server-side from selection):
- `minTrack` = minimum track among selected notes
- `minTime` = minimum time among selected notes

Relative spacing between selected notes is always preserved.

### Validation (client + server)

- Selection must contain **2–500** note IDs, all in the same song, all non-deleted
- Resulting track for every note ∈ [1, 8]
- Resulting time for every note ∈ [0.0, 300.0]
- HOLD notes: duration preserved; end time must also ∈ [0.0, 300.0]
- **Internal collision:** if two selected notes map to the same `(track, time)` after transform → `422` with message (before conflict review)
- **Move + no net change:** allowed (effectively a no-op create path) but apply button disabled if nothing would be created and nothing moved

---

## Architecture

### Approach A — Dedicated note-copy API *(chosen)*

New `NoteCopyService` in `apps/api/src/modules/notes/` with:
- `previewCopy(request, user)` → `NoteCopyPreview`
- `applyCopy(request, user)` → `NoteCopyApplyResult`

Extract slot overlap preview builder from `PatternPasteService` into shared module `note-slot-preview.ts` used by both pattern paste and note copy.

**Rejected:**
- **Ephemeral pattern bridge** — pattern notes lack title/description; wrong entity lifecycle
- **Client-only preview** — no atomic batch, no ledger batchId, race-prone

### Conflict UI generalization

`ConflictReviewModal` and sub-components currently assume `PatternPastePreview` and label incoming side "Pattern". Generalize to a shared **`PlacementPreview`** shape:

```typescript
interface PlacementPreview {
  songId: string
  version: string                    // patternVersion OR selectionVersion
  startTime?: number                 // optional anchor time for header display
  summary: PlacementSummary
  creatable: PlacementCreatableSlot[]
  conflicts: PlacementConflict[]
}

interface PlacementConflict {
  conflictId: string                 // existing note id at destination
  sourceIndex: number
  track: number
  time: number
  incomingNote: PlacementIncomingNote
  existingNote: PlacementExistingNote
}
```

Pattern paste adapts its preview to this shape (thin mapper). Note copy uses the same shape natively. Modal props:

```typescript
interface ConflictReviewModalProps {
  preview: PlacementPreview
  title: string                      // "Paste Pattern — Foo" | "Copy Notes" | "Move Notes"
  incomingLabel?: string             // default "Incoming"
  resolutions: Record<string, ConflictAction>
  onResolve: (id, action) => void
  onApply: () => void
  onCancel: () => void
  hasConflictChanged?: boolean
  onDismissConflictBanner?: () => void
}
```

`ConflictAction` values stay the same: `KEEP_EXISTING` | `REPLACE_WITH_PATTERN`. The second value means "replace existing with incoming" for both flows (rename to `REPLACE_WITH_INCOMING` is a follow-up refactor; not in scope).

---

## Backend Design

### Endpoints

```
POST /songs/:songId/notes/copy-preview
POST /songs/:songId/notes/copy-apply
```

Registered on `NotesController` (notes already song-scoped).

### Request types (`packages/shared/src/types.ts`)

```typescript
export type NoteCopyOperation = 'COPY' | 'MOVE'
export type NoteCopyTransformMode = 'TIME_SHIFT' | 'TRACK_SHIFT' | 'TRACK_TIME_ANCHOR'

export interface NoteCopyPreviewRequest {
  noteIds: string[]
  operation: NoteCopyOperation
  mode: NoteCopyTransformMode
  timeDelta?: number       // TIME_SHIFT
  targetTrack?: number     // TRACK_SHIFT
  anchorTrack?: number     // TRACK_TIME_ANCHOR
  anchorTime?: number      // TRACK_TIME_ANCHOR
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
  summary: {
    totalNotes: number
    creatableNotes: number
    conflictCount: number
    affectedExistingNotes: number
  }
  creatable: Array<{
    sourceNoteId: string
    sourceIndex: number
    track: number
    time: number
    noteType: NoteType
    duration?: number
    title: string
    description: string
  }>
  conflicts: Array<{
    conflictId: string
    sourceNoteId: string
    sourceIndex: number
    track: number
    time: number
    incomingNote: {
      title: string
      description: string
      track: number
      timeOffset: number
      noteType: NoteType
      duration?: number
    }
    existingNote: PatternPasteConflict['existingNote']  // same shape
  }>
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

### `selectionVersion`

Deterministic stale-check token:

```
selectionVersion = sha256(
  noteIds.sort().join(',') + '|' +
  each note's updatedAt ISO + '|' +
  operation + mode + transform params
).slice(0, 32)
```

On apply, recompute from live DB rows. Mismatch → `409 CONFLICTS_CHANGED` with fresh preview (same as pattern paste).

### Overlap rules

| Operation | Notes excluded from destination overlap check |
|---|---|
| **COPY** | None |
| **MOVE** | All source note IDs (slots vacated before create) |

For each transformed slot:
1. Check internal collision (two incoming slots same track+time) → `422`
2. `findOverlapping(candidate, existingSlots)` → conflict or creatable

### Apply transaction (single `$transaction`)

1. Rebuild preview; assert resolutions match
2. **If MOVE:** soft-delete all source notes first; emit `NOTE_DELETED` events with `batchId`
3. For each conflict with `REPLACE_WITH_PATTERN`: soft-delete existing note
4. Create all creatable + replace-resolved incoming notes with cloned title/description
5. Emit `NOTE_CREATED` + `BATCH_APPLIED` events

All mutations write ledger events (existing note service patterns).

### Move semantics

- Source notes deleted **before** creates (so they don't conflict with their own destinations)
- If user chose Keep Existing on all conflicts and MOVE: only sources deleted if... **No** — unresolved conflicts block apply. If all conflicts Keep Existing: creates skipped, but MOVE still deletes sources that had **creatable** destinations. Sources that mapped to conflicts and were "kept" are **not deleted** (user kept the existing note at that slot; the moved note is skipped).

**Move + conflict resolution per slot:**

| Resolution | Effect on source (MOVE) | Effect on destination |
|---|---|---|
| Creatable (no conflict) | Source deleted | New note created |
| KEEP_EXISTING | Source **kept** (not deleted) | Existing kept, incoming skipped |
| REPLACE_WITH_PATTERN | Source deleted | Existing deleted, new note created |

This matches intuitive "move" behavior: keeping an existing note at a destination means that particular note doesn't move there.

---

## Frontend Design

### New files

```
apps/web/src/features/editor/components/CopyToModal.tsx
apps/web/src/features/editor/hooks/useNoteCopy.ts
apps/web/src/features/editor/components/placement-preview.ts   // mappers + shared types
```

### Modified files

```
apps/web/src/features/editor/components/MultiSelectBar.tsx      // + Copy to… button
apps/web/src/pages/EditorPage.tsx                             // wire copy flow state
apps/web/src/features/editor/components/ConflictReviewModal.tsx // generalize props
apps/web/src/features/editor/components/ConflictListItem.tsx
apps/web/src/features/editor/components/ConflictDiffCards.tsx
apps/web/src/features/editor/components/ConflictContextStrip.tsx
apps/web/src/features/editor/components/PatternPanel.tsx        // use placement mapper
```

### CopyToModal layout

- Header: "Copy / Move Notes" + `{n} notes selected`
- Toggle: Copy | Move
- Segmented control: Time | Track | Track + Time
- Input area (mode-dependent):
  - Time: delta input with ± steppers (reuse `pattern-placement` formatters)
  - Track: track picker 1–8
  - Track+Time: track picker + time input
- Footer: Cancel | Validate

On validate success with conflicts → close CopyToModal, open ConflictReviewModal.  
On validate success with zero conflicts → open ConflictReviewModal in summary-only mode (already supported).

### MultiSelectBar

Add button between "Save as Pattern" and "Delete":

```tsx
<Button size="sm" variant="secondary" icon={<CopyIcon />} onClick={onCopyTo}>
  Copy to…
</Button>
```

---

## Error Handling

| Case | HTTP | UX |
|---|---|---|
| Note not found / wrong song | 404 | Toast error |
| Track/time out of bounds | 400 | Inline validation in CopyToModal |
| Internal collision in selection | 422 | Toast with explanation |
| Selection changed during review | 409 | Banner in ConflictReviewModal + merge resolutions (preserve REPLACE only) |
| Duplicate position on apply (P2002) | 409 | Same 409 recovery path |
| Read-only chart | 403 | Button disabled when `!canEdit` |

---

## Testing

### API unit tests (`note-copy.service.spec.ts`)

- Time shift preview: creatable slots, conflict detection
- Track shift: relative delta, bounds rejection (track 8 + delta)
- Track+Time anchor: correct minTrack/minTime anchoring
- MOVE excludes self from overlap
- COPY detects conflict with original positions when delta is zero on same slots
- Internal collision returns 422
- Apply MOVE deletes sources for creatable/replace paths only
- 409 on stale selectionVersion

### Frontend unit tests

- Transform input validation (copy-to-modal helpers)
- `toPlacementPreview(noteCopyPreview)` mapper
- `mergeResolutions` reuse for 409 (already in PatternPanel — extract to shared util)

### Manual verification

1. Select 3 notes across 2 tracks → Copy → Time shift +2s → validate → apply
2. Same selection → Move → Track shift → conflict → resolve → apply
3. Track shift that would go to track 9 → blocked with error
4. 409 recovery: edit note during review → banner + resolution merge

---

## Out of Scope

- Single-note copy/move (requires different entry point)
- Keyboard shortcut
- Copy to another song
- Renaming `REPLACE_WITH_PATTERN` → `REPLACE_WITH_INCOMING` in shared types
- Tools panel entry point

---

## File Map Summary

| File | Action |
|---|---|
| `packages/shared/src/types.ts` | Add note copy types |
| `apps/api/src/modules/notes/note-copy.service.ts` | Create |
| `apps/api/src/modules/notes/note-slot-preview.ts` | Create (extracted overlap builder) |
| `apps/api/src/modules/notes/dto/note-copy.dto.ts` | Create |
| `apps/api/src/modules/notes/notes.controller.ts` | Add endpoints |
| `apps/api/src/modules/notes/notes.module.ts` | Register service |
| `apps/api/src/modules/notes/__tests__/note-copy.service.spec.ts` | Create |
| `apps/api/src/modules/patterns/pattern-paste.service.ts` | Refactor to use shared preview |
| `apps/web/src/features/editor/components/CopyToModal.tsx` | Create |
| `apps/web/src/features/editor/hooks/useNoteCopy.ts` | Create |
| `apps/web/src/features/editor/components/placement-preview.ts` | Create |
| `apps/web/src/features/editor/components/ConflictReviewModal.tsx` | Generalize |
| `apps/web/src/features/editor/components/ConflictListItem.tsx` | Generalize |
| `apps/web/src/features/editor/components/ConflictDiffCards.tsx` | Generalize |
| `apps/web/src/features/editor/components/ConflictContextStrip.tsx` | Generalize |
| `apps/web/src/features/editor/components/MultiSelectBar.tsx` | Add button |
| `apps/web/src/pages/EditorPage.tsx` | Wire flow |
