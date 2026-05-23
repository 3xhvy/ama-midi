# Paste Pattern Conflict Review UI — Design Spec

**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** Frontend only — REVIEW phase of the paste-pattern state machine  
**Reference:** `AMA-MIDI_Paste_Pattern_UI_Plan.md` + design image

---

## Goal

Replace the minimal inline conflict list in `PatternPanel.tsx` with a full-screen git-style conflict resolver. Users step through each conflict one at a time, see a before/after diff, and cannot apply until every conflict is resolved.

---

## Approach

**A — Extract into `ConflictReviewModal.tsx`** (chosen)

Pull the REVIEW step out of `PatternPanel` into a dedicated component. `PatternPanel` keeps its state machine and `resolutions` map (needed for the apply call); it passes them as props to the new modal. All REVIEW-internal state (`activeIndex`, `conflictChangedBanner`) lives inside the modal.

Rejected alternatives:
- **B (useConflictReview hook):** Extra indirection for simple state. Overkill.
- **C (EditorPage-level portal):** Over-engineered. State is ephemeral and tightly coupled to paste flow.

---

## Files

```
apps/web/src/features/editor/components/
  ConflictReviewModal.tsx       ← root modal shell + keyboard handler
  ConflictListItem.tsx          ← single row in left panel
  ConflictDiffCards.tsx         ← before/after two-card layout
  ConflictContextStrip.tsx      ← surrounding notes strip on same track
  conflict-formatters.ts        ← formatTime(), formatOffset()
```

**`PatternPanel.tsx` changes (minimal):**
- Remove the REVIEW inline JSX (current `<ul>` conflict list + bulk buttons)
- When `step === 'REVIEW'`, render `<ConflictReviewModal>` instead
- Keep `resolutions` state in PatternPanel — needed for apply call

---

## Types

All types come from `@ama-midi/shared` — no new types needed:

```typescript
import type {
  ConflictAction,
  PatternPastePreview,
  PatternPasteConflict,
} from '@ama-midi/shared'
```

### Props

```typescript
interface ConflictReviewModalProps {
  preview:                  PatternPastePreview
  resolutions:              Record<string, ConflictAction>
  onResolve:                (conflictId: string, action: ConflictAction) => void
  onApply:                  () => void
  onCancel:                 () => void
  hasConflictChanged?:      boolean
  onDismissConflictBanner?: () => void
}
```

### Internal state (inside ConflictReviewModal)

```typescript
const [activeIndex, setActiveIndex]                   = useState(0)
const [conflictChangedBanner, setConflictChangedBanner] = useState(false)
```

### Derived values (compute, never store)

```typescript
const conflicts    = preview.conflicts
const unresolved   = conflicts.filter(c => resolutions[c.conflictId] === undefined)
const keepCount    = conflicts.filter(c => resolutions[c.conflictId] === 'KEEP_EXISTING').length
const replaceCount = conflicts.filter(c => resolutions[c.conflictId] === 'REPLACE_WITH_PATTERN').length
const skipCount    = keepCount
const createCount  = preview.summary.creatableNotes + replaceCount
const allResolved  = unresolved.length === 0
```

---

## Layout

```
┌─ fixed inset-0 z-50 backdrop (rgba(8,6,20,0.72)) ──────────────────────┐
│  ┌─ w-[80vw] max-w-[860px] h-[560px] rounded-2xl flex flex-col ──────┐ │
│  │  Header (flex-shrink-0)                                            │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  Body: flex flex-row flex-1 overflow-hidden                        │ │
│  │  ├─ Left: w-[220px] flex-shrink-0 border-r overflow-y-auto        │ │
│  │  └─ Right: flex-1 flex flex-col overflow-y-auto p-5               │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  Footer (flex-shrink-0)                                            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Not using `Modal.*` compound** — it caps at `max-w-[400px]`. This modal renders its own shell via `fixed inset-0` backdrop + inner div. Backdrop: `rgba(8,6,20,0.72)`. Shadow: `0 24px 60px rgba(0,0,0,0.30)`. Ring: `0 0 0 1px rgba(108,99,255,0.14)`.

---

## Components

### `conflict-formatters.ts`

```typescript
export function formatTime(seconds: number): string {
  return `${seconds.toFixed(1)}s`
}

export function formatOffset(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}s`
}
```

Raw JS floats must never reach the UI. These two functions are mandatory on every time value.

---

### `ConflictReviewModal.tsx` — shell + keyboard

Renders backdrop + modal div. Mounts `useEffect` keydown listener on mount, removes on unmount.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `←` | `activeIndex = Math.max(0, activeIndex - 1)` |
| `→` | `activeIndex = Math.min(conflicts.length - 1, activeIndex + 1)` |
| `K` | `resolveAndAdvance(active, 'KEEP_EXISTING')` |
| `R` | `resolveAndAdvance(active, 'REPLACE_WITH_PATTERN')` |
| `Escape` | `onCancel()` |
| `Enter` | `allResolved && onApply()` |

**Auto-advance logic:**

```typescript
function resolveAndAdvance(conflictId: string, action: ConflictAction) {
  onResolve(conflictId, action)
  const next = conflicts.findIndex((c, i) => i > activeIndex && resolutions[c.conflictId] === undefined)
  if (next !== -1) setActiveIndex(next)
  // If none found: stay on current (all resolved)
}
```

Note: `resolutions` passed to `findIndex` is the pre-update snapshot. The resolved conflict won't appear as unresolved — the `findIndex` skips index `<= activeIndex` so it correctly finds the next one.

**Structure (JSX outline):**

```
<div backdrop onClick={onCancel}>
  <div modal onClick={stopPropagation}>
    <ModalHeader />
    <div body>
      <ConflictList />       // left 220px
      <DetailPanel />        // right flex-1
    </div>
    <ModalFooter />
  </div>
</div>
```

---

### Header

```
Title: "Paste Pattern — {preview.patternName}"  (if patternName not on type, use patternId)
Sub:   "Pasting at {formatTime(preview.startTime)} · {preview.summary.totalPatternNotes} pattern notes"
Chips: [N will be created (green)] [N conflicts (red)] [N notes affected (amber)]
Close: ✕ button → onCancel
```

**StatChip colors (Tailwind):**

| Color | bg | text |
|---|---|---|
| green | `bg-emerald-50` | `text-emerald-500` |
| red | `bg-red-50` | `text-red-500` |
| amber | `bg-amber-50` | `text-amber-600` |

---

### `ConflictListItem.tsx`

Props: `conflict`, `resolution`, `isActive`, `onClick`

```
[track dot] [T{n} · {formatTime(time)}]   [status dot]
            [{existingType} → {patternType}]
            [{creatorName}]
```

**Active state:** `bg-[#EEF0FF] border-l-2 border-[#6C63FF]`

**Status dot colors:**

| State | Color |
|---|---|
| `undefined` (unresolved) | `bg-amber-300` |
| `KEEP_EXISTING` | `bg-emerald-500` |
| `REPLACE_WITH_PATTERN` | `bg-red-500` |

Track dot: `trackColor(conflict.track)` from `@ama-midi/shared`.

---

### Detail panel (right side)

**Detail header:**
```
[track dot] Track {n} · {formatTime(time)}     [← Prev]  {i+1} of {total}  [Next →]
```
Prev disabled at index 0. Next disabled at last index.

**409 changed banner** (shown when `hasConflictChanged`):
```
⚠ Conflicts changed — review again    [✕]
bg-amber-50 border border-amber-300 text-amber-800 rounded-md p-2 text-xs
```

---

### `ConflictDiffCards.tsx`

Two cards side by side, `→` arrow between them.

**Existing note card class logic:**

```typescript
const existingCls = resolution === 'REPLACE_WITH_PATTERN'
  ? 'border-slate-200 bg-slate-50 opacity-50'   // discarded
  : 'border-red-200 bg-red-50'                  // kept

const patternCls = resolution === 'KEEP_EXISTING'
  ? 'border-slate-200 bg-slate-50 opacity-50'   // skipped
  : 'border-[#6C63FF] bg-[#F5F3FF]'             // incoming
```

**Unresolved state:** both cards use `border-slate-200 bg-slate-50` (neutral).

**Strikethrough title:** `line-through text-slate-400` on existing note title when `resolution === 'REPLACE_WITH_PATTERN'`.

**Existing card content:**
- Label: "Existing — will be kept" / "Existing — will be removed" / "Existing note"
- Title: `conflict.existingNote.title`
- TypeChip: `conflict.existingNote.noteType`
- Duration (if set): `Duration: {formatTime(existing.duration)}`
- Avatar + creator name
- Date: `conflict.existingNote.createdAt` formatted as `YYYY-MM-DD · HH:mm`

**Pattern card content:**
- Label: "Pattern — will be skipped" / "Pattern — will be created" / "Pattern note"
- TypeChip: `conflict.patternNote.noteType`
- Duration (if set): `Duration: {formatTime(patternNote.duration)}`
- Offset: `offset {formatOffset(patternNote.timeOffset)} from paste point`

**TypeChip:** inline pill — `HOLD` = red, `TAP` = purple, `SWIPE` = blue (match existing note type display in codebase).

---

### `ConflictContextStrip.tsx`

Shows 2 notes before + 2 after the conflict on same track. Source: all notes on `conflict.track` from `preview` creatable list + existing notes visible in conflict data.

**Limitation:** The preview only contains `conflicts` and `creatable` notes — not all existing notes on the track. Context strip uses:
1. Other conflicts on the same track (sorted by time)
2. Creatable pattern notes on the same track

If fewer than 2 neighbors exist on either side, render what's available (no empty-state needed).

**Visual:** horizontal flex row of note dots + time labels. Conflict position = red ring circle with `!` inside. Other notes = colored dots using `trackColor`.

---

### Resolution action buttons

```
[ ✓ Keep Existing ]   [ Replace With Pattern ]
```

Both full-width, rounded, large. Selected state:
- Keep selected: `bg-[#EEF0FF] text-[#6C63FF] border-[#6C63FF]`
- Replace selected: `bg-red-50 text-red-500 border-red-500`
- Unselected: `bg-white text-slate-500 border-slate-200`

Clicking either calls `resolveAndAdvance`.

---

### Footer

```
[2 unresolved · ] Create {n} · Replace {n} · Skip {n}     [Cancel] [Paste {n} notes →]
```

- "unresolved" count: amber + semibold
- Apply button disabled when `!allResolved || (createCount + replaceCount === 0)`
- Apply label: `allResolved ? "Paste ${createCount} notes →" : "Resolve all to apply"`
- Disabled opacity: `opacity-40 cursor-not-allowed`

---

## 409 Error Handling

When server returns `409 CONFLICTS_CHANGED` or `409 PATTERN_VERSION_CHANGED`:

1. `PatternPanel` receives fresh preview from error response body
2. Calls a merge function:
   ```typescript
   function mergeResolutions(
     oldResolutions: Record<string, ConflictAction>,
     newConflicts: PatternPasteConflict[]
   ): Record<string, ConflictAction> {
     const result: Record<string, ConflictAction> = {}
     for (const c of newConflicts) {
       // Preserve REPLACE_WITH_PATTERN if conflict still exists; new conflicts = undefined
       if (oldResolutions[c.conflictId] === 'REPLACE_WITH_PATTERN') {
         result[c.conflictId] = 'REPLACE_WITH_PATTERN'
       }
       // KEEP_EXISTING resolutions are dropped — new conflicts default unresolved
     }
     return result
   }
   ```
3. Sets `hasConflictChanged=true` → modal shows banner
4. `activeIndex` resets to 0

---

## Acceptance Criteria

| Area | Done when |
|---|---|
| Float precision | No raw floats in UI — all times via `formatTime()` / `formatOffset()` |
| Status dots | Amber = unresolved, green = keeping, red = replacing — updates instantly |
| Active state | Clicked item: purple left border + blue-tinted background |
| Diff cards | Kept side colored, discarded side 50% opacity + strikethrough title |
| Context strip | Shows neighbors on same track (up to 2 before, 2 after) |
| Auto-advance | Keep or Replace → moves to next unresolved conflict |
| Navigation | `←` `→` keys + Prev/Next buttons both work |
| Keyboard | K = keep+advance, R = replace+advance, Escape = cancel, Enter = apply when ready |
| Footer counts | Create · Replace · Skip update in real time |
| Apply button | Disabled with "Resolve all to apply" until all resolved |
| Apply button | Disabled if `createCount + replaceCount === 0` even when all resolved |
| 409 handling | Banner shown, new conflicts unresolved, prior Replace resolutions preserved |
