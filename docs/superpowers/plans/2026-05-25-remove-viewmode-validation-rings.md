# Remove ViewMode + Validation Rings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the ViewMode toggle (Composer/Dev/QA/Preview) entirely, replace QA heuristic note rings with semantic validation-driven rings controlled by a toggle button, and redesign the ValidationPanel with colored severity cards.

**Architecture:** `viewMode` is deleted from the store and all consumers; `validationRingsEnabled` replaces it. `PianoRoll` accepts `validationIssues[]` and derives per-note ring severity via a helper. `ValidationPanel` is rewritten with left-border severity cards.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand, TanStack Query

**Spec:** `docs/superpowers/specs/2026-05-25-remove-viewmode-validation-rings-design.md`

---

## File Map

| Path | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/store/editor.store.ts` | Modify | Remove `ViewMode`/`viewMode`/`setViewMode`; add `validationRingsEnabled`/`setValidationRingsEnabled` |
| `apps/web/src/features/editor/components/TapNote.tsx` | Modify | Remove `viewMode` prop; add `validationRing` prop; apply ring class |
| `apps/web/src/features/editor/components/HoldNote.tsx` | Modify | Remove `viewMode` prop; add `validationRing` prop; always show tooltip |
| `apps/web/src/features/editor/components/NoteCircle.tsx` | No change | Props flow through unchanged — `NoteVariantProps` drives this |
| `apps/web/src/features/editor/components/PianoRoll.tsx` | Modify | Remove `viewMode`; add `validationIssues` prop + `noteRing` helper; pass ring to `NoteCircle` |
| `apps/web/src/features/editor/components/ValidationPanel.tsx` | Rewrite | Left-border severity cards, sticky header, empty state |
| `apps/web/src/pages/EditorPage.tsx` | Modify | Remove view toggle row + `VIEW_MODES`; add validation rings toggle button; pass `validationIssues` to `PianoRoll` |

---

## Task 1: Update editor store — remove `viewMode`, add `validationRingsEnabled`

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`

### Background

The store at `apps/web/src/store/editor.store.ts` currently has:
- `type ViewMode = 'composer' | 'developer' | 'qa' | 'preview'` (line ~20)
- `viewMode: ViewMode` field and `setViewMode` action (lines ~38–41, ~90–93)

We remove all of that and add a boolean toggle.

- [ ] **Step 1: Replace `ViewMode` type and fields in the store**

Open `apps/web/src/store/editor.store.ts`. Make these exact changes:

Remove line:
```ts
type ViewMode = 'composer' | 'developer' | 'qa' | 'preview'
```

In `interface EditorStore`, remove:
```ts
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
```

Add in their place:
```ts
  validationRingsEnabled: boolean
  setValidationRingsEnabled: (v: boolean) => void
```

In `create<EditorStore>((set) => ({`, remove:
```ts
  viewMode: 'composer',
  setViewMode: (viewMode) => set({ viewMode }),
```

Add in their place:
```ts
  validationRingsEnabled: false,
  setValidationRingsEnabled: (v) => set({ validationRingsEnabled: v }),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "editor.store\|viewMode\|setViewMode" | head -20
```

Expected: errors listing every consumer still using `viewMode` or `setViewMode`. That's correct — they get fixed in later tasks. Zero errors only after Task 5.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/editor.store.ts
git commit -m "refactor(store): remove viewMode, add validationRingsEnabled"
```

---

## Task 2: Update `TapNote` — remove `viewMode`, add `validationRing`

**Files:**
- Modify: `apps/web/src/features/editor/components/TapNote.tsx`

### Background

`TapNote.tsx` currently has:
- `viewMode?: 'composer' | 'developer' | 'qa' | 'preview'` in `NoteVariantProps`
- QA ring logic using `isNearBoundary`, `hasCloseNeighbor`
- Developer ID overlay
- `displayTime` that varies by mode

`NoteVariantProps` is imported by `HoldNote`, `NoteCircle`, and `SwipeNote` — changing the interface affects them all. We replace `viewMode` with `validationRing`.

- [ ] **Step 1: Rewrite `TapNote.tsx`**

Replace the full file content:

```tsx
import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import { trackColor, type Note } from '@ama-midi/shared'

export interface NoteVariantProps {
  note:            Note
  gridWidth:       number
  pxPerSecond:     number
  isSelected?:     boolean
  validationRing?: 'error' | 'warning' | null
  allNotes?:       Note[]
  onClick:         (note: Note, e: React.MouseEvent) => void
}

export function TapNote({
  note, gridWidth, pxPerSecond,
  isSelected = false, validationRing = null, onClick,
}: NoteVariantProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2
  const cy = y

  const ringClass =
    validationRing === 'error'   ? 'ring-2 ring-red-400' :
    validationRing === 'warning' ? 'ring-2 ring-yellow-400' : ''

  const selectionShadow = isSelected && !validationRing
    ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.90)' }
    : undefined

  const displayTime = Math.round(note.time * 10) / 10

  return (
    <>
      <div
        data-note={note.id}
        className={cn(
          'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear',
          ringClass,
        )}
        style={{ left: cx - 8, top: cy - 8, backgroundColor: trackColor(note.track), ...selectionShadow }}
        title={`${note.title} | Track ${note.track} | ${displayTime}s`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: cy - 24 }} />}
    </>
  )
}
```

- [ ] **Step 2: Verify file saved correctly**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "TapNote" | head -10
```

Expected: no errors mentioning `TapNote.tsx` itself. Other files may still error on `viewMode`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/TapNote.tsx
git commit -m "refactor(editor): replace viewMode with validationRing in TapNote"
```

---

## Task 3: Update `HoldNote` — remove `viewMode`, add `validationRing`

**Files:**
- Modify: `apps/web/src/features/editor/components/HoldNote.tsx`

### Background

`HoldNote.tsx` currently guards tooltip display with `viewMode === 'composer' || viewMode === 'developer'`. We remove that guard (always show tooltip on hover) and apply `validationRing` as an outline style.

- [ ] **Step 1: Rewrite `HoldNote.tsx`**

Replace the full file content:

```tsx
import { useState } from 'react'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import { trackColor } from '@ama-midi/shared'
import type { NoteVariantProps } from './TapNote'

export function HoldNote({
  note, gridWidth, pxPerSecond,
  isSelected = false, validationRing = null, onClick,
}: NoteVariantProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2
  const duration = note.duration ?? 0.5
  const bodyHeight = Math.max(24, duration * pxPerSecond)

  const outlineColor =
    validationRing === 'error'   ? 'rgb(248 113 113)' :
    validationRing === 'warning' ? 'rgb(251 191 36)'  :
    isSelected                   ? 'rgba(255,255,255,0.90)' : undefined

  return (
    <>
      <div
        data-note={note.id}
        className="absolute cursor-pointer"
        style={{
          left:            cx - tw / 6,
          top:             y,
          width:           tw / 3,
          height:          bodyHeight,
          backgroundColor: trackColor(note.track),
          opacity:         0.85,
          borderRadius:    4,
          outline:         outlineColor ? `2px solid ${outlineColor}` : undefined,
          outlineOffset:   outlineColor ? '2px' : undefined,
        }}
        title={`${note.title} | Track ${note.track} | ${note.time}s | HOLD ${duration}s`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: y - 24 }} />}
    </>
  )
}
```

- [ ] **Step 2: Verify no errors in HoldNote**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "HoldNote" | head -10
```

Expected: no errors mentioning `HoldNote.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/HoldNote.tsx
git commit -m "refactor(editor): replace viewMode with validationRing in HoldNote"
```

---

## Task 4: Update `PianoRoll` — remove `viewMode`, add validation ring logic

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

### Background

`PianoRoll.tsx` currently:
- Reads `viewMode` from store (line ~83)
- Derives `isPreview = viewMode === 'preview'` (line 104)
- Uses `effectiveCanEdit = canEdit && !isPreview` (line 105)
- Passes `viewMode={viewMode}` to `NoteCircle` (line ~518)
- Renders `{isPreview && <HitZone ... />}` (line ~595)
- Shows empty state only when `viewMode === 'composer'` (line ~580)

We add `validationIssues` prop, read `validationRingsEnabled` from store, add `noteRing` helper, and clean up.

`ValidationIssue` is imported from `../../validation/validation-summary`.

- [ ] **Step 1: Add `validationIssues` to `PianoRoll` Props interface**

Find the `interface Props {` block (around line 45) and add the new field. The import for `ValidationIssue` goes at the top of the file.

Add to imports section (near other feature imports):
```ts
import type { ValidationIssue } from '../../validation/validation-summary'
```

Change `interface Props {` to include:
```ts
  validationIssues?: ValidationIssue[]
```

Change the function signature destructure to include:
```ts
validationIssues = [],
```

- [ ] **Step 2: Remove `viewMode` from store destructure, remove `isPreview`**

Find line ~83:
```ts
const { pxPerSecond, viewMode, playheadTime, snapMode, heatmapEnabled, isPlaying, zoom, setZoom, createMode,
        selectedNoteIds, selectNote, toggleNoteSelection, addNoteSelection, clearSelection, setActiveTrack, setPlayheadTime } = useEditorStore()
```

Replace with:
```ts
const { pxPerSecond, validationRingsEnabled, playheadTime, snapMode, heatmapEnabled, isPlaying, zoom, setZoom, createMode,
        selectedNoteIds, selectNote, toggleNoteSelection, addNoteSelection, clearSelection, setActiveTrack, setPlayheadTime } = useEditorStore()
```

Remove lines 104–105:
```ts
const isPreview = viewMode === 'preview'
const effectiveCanEdit = canEdit && !isPreview
```

Replace with:
```ts
const effectiveCanEdit = canEdit
```

- [ ] **Step 3: Add `noteRing` helper function**

Add this function inside `PianoRoll` (after the store destructure, before the first `useEffect`):

```ts
function noteRing(note: Note): 'error' | 'warning' | null {
  if (!validationRingsEnabled || validationIssues.length === 0) return null
  const match = validationIssues.find(
    (i) =>
      Math.abs(i.time! - note.time) < 0.15 &&
      (i.track == null || i.track === note.track),
  )
  if (!match) return null
  return match.severity === 'error' ? 'error' : 'warning'
}
```

Note: `i.time` may be `undefined` for some issues (e.g. song-level issues). The `i.time!` is safe because we use `Math.abs` — if `i.time` is undefined, the result is `NaN` which is never `< 0.15`, so no match occurs.

- [ ] **Step 4: Update `NoteCircle` call to pass `validationRing`**

Find the `NoteCircle` render (around line 513):
```tsx
<NoteCircle
  key={note.id}
  note={note}
  gridWidth={layoutGridWidth}
  pxPerSecond={pxPerSecond}
  viewMode={viewMode}
  isSelected={selectedNoteIds.has(note.id)}
  allNotes={notes}
  onClick={handleNoteClick}
/>
```

Replace with:
```tsx
<NoteCircle
  key={note.id}
  note={note}
  gridWidth={layoutGridWidth}
  pxPerSecond={pxPerSecond}
  validationRing={noteRing(note)}
  isSelected={selectedNoteIds.has(note.id)}
  onClick={handleNoteClick}
/>
```

Note: `allNotes` was only used for QA close-neighbor detection — now removed.

- [ ] **Step 5: Remove `isPreview && <HitZone>` block**

Find (around line 595):
```tsx
{isPreview && (
  <HitZone
    pxPerSecond={pxPerSecond}
    playheadTime={playheadTime}
    width={layoutGridWidth}
    containerRef={containerRef}
  />
)}
```

Delete this entire block (keep the surrounding structure intact).

- [ ] **Step 6: Fix empty-state condition**

Find (around line 580):
```tsx
{visibleNotes.length === 0 && viewMode === 'composer' && effectiveCanEdit && (
```

Replace with:
```tsx
{visibleNotes.length === 0 && effectiveCanEdit && (
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "PianoRoll" | head -10
```

Expected: no errors in `PianoRoll.tsx` itself.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "refactor(editor): remove viewMode from PianoRoll, add validation ring logic"
```

---

## Task 5: Update `EditorPage` — remove view toggle, add rings toggle, pass `validationIssues`

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

### Background

`EditorPage.tsx` has several viewMode references to remove:
1. `viewMode` in store destructure (line ~67)
2. `VIEW_MODES` constant (lines ~704–709)
3. `ToolRow label="View"` ToggleGroup block (lines ~786–793)
4. `viewMode` and `setViewMode` in `ToolsTab`'s store destructure (line ~771)
5. `{viewMode !== 'composer' && …}` badge (lines ~683–687)

And we need to:
- Add `validationRingsEnabled`/`setValidationRingsEnabled` to `ToolsTab` store destructure
- Add `Validation rings` toggle button (same style as `Difficulty heatmap`)
- Pass `validationIssues` from `useValidation` to `PianoRoll`

- [ ] **Step 1: Remove `viewMode` from top-level store destructure**

Find (around line 67):
```ts
const {
  viewMode,
  rightPanelTab, setRightPanelTab,
  ...
} = useEditorStore()
```

Remove `viewMode,` from this destructure.

- [ ] **Step 2: Remove `VIEW_MODES` constant**

Find and delete these lines:
```ts
const VIEW_MODES = [
  { value: 'composer',  label: 'Composer' },
  { value: 'developer', label: 'Dev' },
  { value: 'qa',        label: 'QA' },
  { value: 'preview',   label: 'Preview' },
]
```

- [ ] **Step 3: Remove the viewMode badge**

Find and delete:
```tsx
{viewMode !== 'composer' && (
  <div className="fixed bottom-14 right-4 px-3 py-1 bg-shell-surface border border-shell-border rounded-full text-xs text-shell-muted uppercase tracking-wide z-50">
    {viewMode} view
  </div>
)}
```

- [ ] **Step 4: Pass `validationIssues` to `PianoRoll`**

`useValidation` is already called at line ~206:
```ts
const { summary: validationSummary, data: validationData } = useValidation(songId)
```

Change this to also destructure `issues`:
```ts
const { summary: validationSummary, data: validationData, issues: validationIssues } = useValidation(songId)
```

Find the `<PianoRoll` render (around line 667) and add the prop:
```tsx
<PianoRoll
  songId={songId}
  chartId={chartId}
  speedMultiplier={activeChart?.speedMultiplier ?? 1}
  canEdit={canEdit}
  readOnlyMessage={readOnlyMessage}
  mutedTracks={mutedTracks}
  validationIssues={validationIssues}
  onNoteSelected={handleNoteSelected}
  cursors={cursors}
  onCursorMove={emitCursorMove}
  onCursorHide={emitCursorHide}
  currentUserId={currentUser?.id}
/>
```

- [ ] **Step 5: Update `ToolsTab` — remove view, add rings toggle**

In `ToolsTab`'s store destructure (around line 770–776):
```ts
const {
  viewMode, setViewMode,
  zoom, setZoom,
  snapMode, setSnapMode,
  heatmapEnabled, setHeatmapEnabled,
  createMode, setCreateMode,
} = useEditorStore()
```

Replace with:
```ts
const {
  validationRingsEnabled, setValidationRingsEnabled,
  zoom, setZoom,
  snapMode, setSnapMode,
  heatmapEnabled, setHeatmapEnabled,
  createMode, setCreateMode,
} = useEditorStore()
```

Find and delete the entire `ToolRow label="View"` block:
```tsx
<ToolRow label="View" data-tour="view-mode">
  <ToggleGroup
    items={VIEW_MODES}
    value={viewMode}
    onValueChange={(v) => setViewMode(v as typeof viewMode)}
    className="w-full"
  />
</ToolRow>
```

After the existing `Difficulty heatmap` button, add the `Validation rings` toggle button:

```tsx
<button
  type="button"
  onClick={() => setValidationRingsEnabled(!validationRingsEnabled)}
  className="w-full flex items-center justify-between rounded-md border border-shell-border bg-shell-bg px-3 py-2 text-xs text-shell-text hover:bg-shell-surface transition-colors"
>
  <span>Validation rings</span>
  <span className={validationRingsEnabled ? 'text-warning' : 'text-shell-muted'}>
    {validationRingsEnabled ? 'On' : 'Off'}
  </span>
</button>
```

- [ ] **Step 6: Verify TypeScript — zero errors**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: `TypeScript: No errors found`

If errors remain, they will mention specific files — fix them before committing.

- [ ] **Step 7: Confirm viewMode is fully gone**

```bash
grep -r "viewMode\|setViewMode\|VIEW_MODES\|ViewMode" apps/web/src --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts"
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): remove view mode toggle, add validation rings toggle"
```

---

## Task 6: Rewrite `ValidationPanel`

**Files:**
- Modify: `apps/web/src/features/editor/components/ValidationPanel.tsx`

### Background

Current panel: minimal plain list. New design: sticky severity header, left-border colored issue cards, green empty state.

`useValidation` returns `{ issues, summary, isLoading, refetch }` where:
- `issues: ValidationIssue[]` — `{ ruleId, severity, message, track?, time? }`
- `summary: { errors, warnings, total }`

- [ ] **Step 1: Rewrite `ValidationPanel.tsx`**

Replace the entire file:

```tsx
import { useValidation } from '../../validation/useValidation'

interface Props {
  songId: string
  onJumpTo?: (time: number, track?: number) => void
}

export function ValidationPanel({ songId, onJumpTo }: Props) {
  const { issues, summary, isLoading, refetch } = useValidation(songId)

  if (isLoading) {
    return (
      <div className="p-3 space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-md bg-shell-border" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-shell-border bg-shell-surface">
        <div className="flex items-center gap-3 text-xs">
          {summary.errors > 0 && (
            <span className="flex items-center gap-1 font-medium text-red-400">
              <span>●</span>
              <span>{summary.errors} error{summary.errors > 1 ? 's' : ''}</span>
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="flex items-center gap-1 font-medium text-yellow-400">
              <span>▲</span>
              <span>{summary.warnings} warning{summary.warnings > 1 ? 's' : ''}</span>
            </span>
          )}
          {issues.length === 0 && (
            <span className="text-shell-muted">No issues</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm text-shell-muted hover:text-shell-text transition-colors"
          title="Refresh validation"
        >
          ↻
        </button>
      </div>

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
            <span className="text-2xl text-green-400">✓</span>
            <p className="text-xs font-medium text-green-400">All clear</p>
            <p className="text-[11px] text-shell-muted">No validation issues found</p>
          </div>
        ) : (
          <div className="divide-y divide-shell-border/50">
            {issues.map((issue, i) => {
              const isError = issue.severity === 'error'
              const canJump = issue.time !== undefined
              return (
                <button
                  key={`${issue.ruleId}-${i}`}
                  type="button"
                  onClick={() => canJump && onJumpTo?.(issue.time!, issue.track)}
                  disabled={!canJump}
                  className={[
                    'w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-l-4 transition-colors',
                    isError
                      ? 'border-l-red-400 hover:bg-red-400/5'
                      : 'border-l-yellow-400 hover:bg-yellow-400/5',
                    !canJump ? 'cursor-default' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'mt-0.5 shrink-0 text-[11px] leading-none',
                      isError ? 'text-red-400' : 'text-yellow-400',
                    ].join(' ')}
                  >
                    {isError ? '●' : '▲'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-shell-text leading-snug">{issue.message}</p>
                    {canJump && (
                      <p className="mt-0.5 text-[10px] text-shell-muted">
                        Jump to {issue.time!.toFixed(1)}s →
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "ValidationPanel" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/ValidationPanel.tsx
git commit -m "feat(editor): redesign ValidationPanel with severity cards"
```

---

## Task 7: Smoke test + final grep check

**Files:** None

- [ ] **Step 1: Run full test suite**

```bash
pnpm test 2>&1 | tail -15
```

Expected: all tests pass (existing suite covers store/note logic).

- [ ] **Step 2: Confirm viewMode fully gone**

```bash
grep -r "viewMode\|setViewMode\|VIEW_MODES\|ViewMode\|isPreview\|allNotes.*viewMode" \
  apps/web/src --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts"
```

Expected: **no output**.

- [ ] **Step 3: Start dev server and smoke test**

```bash
pnpm dev
```

Open `http://localhost:3000`. Log in. Open any song in the editor. Verify:

**View mode removed:**
- Right panel Tools tab has no "View" row
- No Composer/Dev/QA/Preview toggle visible

**Validation rings toggle:**
- "Validation rings" button appears in Tools tab below "Difficulty heatmap"
- Clicking it shows "On" in amber, clicking again shows "Off" in muted grey
- When On + chart has validation errors: affected notes show `ring-2 ring-red-400`
- When On + chart has validation warnings: affected notes show `ring-2 ring-yellow-400`
- When Off: no rings on any notes

**ValidationPanel:**
- "val" tab opens the redesigned panel
- Header shows `● N errors` in red and/or `▲ N warnings` in amber
- Each issue shows as a card with left color border
- Clicking a card with a time jumps to that time in the editor
- Chart with no issues shows green `✓ All clear` empty state

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final smoke verified — viewMode removed, validation rings live"
```
