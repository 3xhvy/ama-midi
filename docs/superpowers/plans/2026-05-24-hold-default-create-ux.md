# Hold-Default Note Creation UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the **Create type** toggle, always use hold-first canvas placement (click = Tap, drag = Hold), and add affordances so the gesture is discoverable.

**Architecture:** Panel simplification in `EditorPage`; remove unused `activeNoteType` store field; update `PianoRoll` to split creation by `createMode` (fast = mousedown/drag, popup = click opens popup); enhance `GhostCircle` with a vertical stem hint.

**Tech Stack:** React 18, Zustand, TypeScript, `@ama-midi/shared` (`HOLD_DRAG_THRESHOLD_PX`, `trackColor`)

**Spec:** `docs/superpowers/specs/2026-05-24-hold-default-create-ux-design.md`

---

## File Map

| File | Action |
|------|--------|
| `apps/web/src/pages/EditorPage.tsx` | Remove Create type toggle; add placement hint; fix multi-select `selectedType` |
| `apps/web/src/store/editor.store.ts` | Remove `activeNoteType` / `setActiveNoteType` |
| `apps/web/src/features/editor/components/GhostCircle.tsx` | Add vertical stem affordance |
| `apps/web/src/features/editor/components/PianoRoll.tsx` | Interaction split, cursor, copy, track-colored drag preview |

---

## Task 1: Right panel — remove Create type, add hint

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Update `ToolsTab` store destructuring**

In `ToolsTab`, remove `activeNoteType` and `setActiveNoteType` from the `useEditorStore()` destructure (around line 601):

```tsx
  const {
    viewMode, setViewMode,
    zoom, setZoom,
    snapMode, setSnapMode,
    heatmapEnabled, setHeatmapEnabled,
    createMode, setCreateMode,
  } = useEditorStore()
```

- [ ] **Step 2: Fix `selectedType` for Selection panel**

Replace:

```tsx
  const selectedType = selectedCount === 1 ? selectedNotes[0].noteType : activeNoteType
```

With:

```tsx
  const selectedType = selectedCount > 0 ? selectedNotes[0].noteType : 'TAP'
```

(`Type` toggle is only rendered when `selectedCount > 0`, so `'TAP'` is unreachable fallback.)

- [ ] **Step 3: Replace Create type row with placement hint**

Replace the entire **Create type** `ToolRow` block (lines ~651–660):

```tsx
            <ToolRow label="Create type">
              <ToggleGroup
                items={TYPE_MODES}
                value={activeNoteType}
                onValueChange={(v) => setActiveNoteType(v as NoteType)}
                className="w-full"
              />
            </ToolRow>
```

With:

```tsx
            <p className="text-xs leading-relaxed text-shell-muted">
              Place notes: click for tap · drag down for hold
            </p>
```

Keep the **Create mode** `ToolRow` immediately below unchanged.

- [ ] **Step 4: Type-check**

Run: `cd apps/web && npx tsc --noEmit`  
Expected: PASS (may still reference `activeNoteType` in store/PianoRoll — fixed in later tasks)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "refactor(editor): replace Create type toggle with placement hint"
```

---

## Task 2: Remove `activeNoteType` from store

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`

- [ ] **Step 1: Remove from interface and implementation**

Delete these lines from `EditorStore` interface:

```tsx
  activeNoteType:     NoteType
  setActiveNoteType:   (type: NoteType) => void
```

Delete from store initial state:

```tsx
  activeNoteType:   'HOLD',
```

Delete setter:

```tsx
  setActiveNoteType:   (activeNoteType) => set({ activeNoteType }),
```

Remove unused `NoteType` import if it is no longer referenced in this file:

```tsx
import type { SnapMode, SuggestNotesRequest } from '@ama-midi/shared'
```

- [ ] **Step 2: Verify no remaining references**

Run: `rg 'activeNoteType|setActiveNoteType' apps/web`  
Expected: matches only in `PianoRoll.tsx` (fixed in Task 4)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/editor.store.ts
git commit -m "refactor(editor): remove unused activeNoteType store field"
```

---

## Task 3: Ghost stem affordance

**Files:**
- Modify: `apps/web/src/features/editor/components/GhostCircle.tsx`

- [ ] **Step 1: Replace component body**

Replace the entire `GhostCircle` return with:

```tsx
export function GhostCircle({ track, time, gridWidth, pxPerSecond }: GhostCircleProps) {
  const x  = trackToX(track, gridWidth)
  const y  = timeToY(time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const color = trackColor(track)
  const stemWidth = Math.max(4, tw / 6)

  return (
    <>
      <div
        className="absolute w-4 h-4 rounded-full border-2 pointer-events-none"
        style={{
          left: x + tw / 2 - 8,
          top: y - 8,
          backgroundColor: `${color}33`,
          borderColor: color,
        }}
      />
      <div
        className="absolute rounded-sm pointer-events-none"
        style={{
          left: x + tw / 2 - stemWidth / 2,
          top: y + 6,
          width: stemWidth,
          height: 12,
          backgroundColor: `${color}40`,
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/GhostCircle.tsx
git commit -m "feat(editor): add hold stem affordance to placement ghost"
```

---

## Task 4: PianoRoll interaction + canvas polish

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Add `trackColor` import**

Add to existing `@ama-midi/shared` import:

```tsx
import { HOLD_DRAG_THRESHOLD_PX, trackColor } from '@ama-midi/shared'
```

- [ ] **Step 2: Change grid cursor**

In the `containerRef` div `className` (around line 425), replace `cursor-crosshair` with `cursor-ns-resize`:

```tsx
className={`overflow-y-auto overflow-x-auto w-full h-full select-none [scrollbar-gutter:stable] ${effectiveCanEdit ? 'cursor-ns-resize' : 'cursor-not-allowed'}`}
```

- [ ] **Step 3: Update `handleMouseDown` — fast mode only**

Replace the `activeNoteType` guard (line ~215):

```tsx
    if (useEditorStore.getState().activeNoteType !== 'HOLD') return
```

With:

```tsx
    if (useEditorStore.getState().createMode !== 'fast') return
```

- [ ] **Step 4: Replace `handleGridClick` — popup mode only**

Replace the entire `handleGridClick` callback with:

```tsx
  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.shiftKey) return
    if (!effectiveCanEdit || !ghost) {
      if (!effectiveCanEdit) notifyReadOnly()
      return
    }
    if (createMode !== 'popup') return
    setPopup({ type: 'create', track: ghost.track, time: ghost.time, pos: { x: e.clientX, y: e.clientY } })
    setGhost(null)
  }, [effectiveCanEdit, ghost, createMode, readOnlyMessage])
```

- [ ] **Step 5: Track-colored drag preview**

In the `{drag && (() => { ... })()}` block (around line 514), add color and replace class-based fill:

```tsx
            {drag && (() => {
              const startY = timeToY(drag.start.time, pxPerSecond)
              const px     = Math.max(HOLD_DRAG_THRESHOLD_PX, drag.currentY - drag.start.y)
              const x      = trackToX(drag.start.track, layoutGridWidth)
              const tw     = trackWidth(layoutGridWidth)
              const color  = trackColor(drag.start.track)
              return (
                <div
                  className="absolute rounded-sm pointer-events-none"
                  style={{
                    left:   x + tw / 3,
                    top:    startY,
                    width:  tw / 3,
                    height: px,
                    backgroundColor: `${color}66`,
                  }}
                />
              )
            })()}
```

Add `trackWidth` to the engine import if not already present:

```tsx
import { xToTrack, yToTime, timeToY, trackToX, trackWidth, getVisibleTimeGridLines, resolveLayoutGridWidth, MIN_GRID_WIDTH } from '../engine'
```

- [ ] **Step 6: Update empty-state copy**

Replace:

```tsx
<p className="text-sm text-canvas-muted">Click anywhere to place your first note</p>
```

With:

```tsx
<p className="text-sm text-canvas-muted">Click for tap · drag down for hold</p>
```

- [ ] **Step 7: Verify no stale `activeNoteType` references**

Run: `rg 'activeNoteType|setActiveNoteType' apps/web`  
Expected: no matches

- [ ] **Step 8: Type-check and test**

Run: `cd apps/web && npx tsc --noEmit`  
Expected: PASS

Run: `cd apps/web && pnpm test`  
Expected: existing tests PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "feat(editor): hold-default placement with popup/fast mode split"
```

---

## Manual verification checklist

After all tasks:

- [ ] **Create type** row gone; hint reads *"Place notes: click for tap · drag down for hold"*
- [ ] Hover ghost shows circle + faint stem below
- [ ] **Fast mode:** click empty grid → Tap note created
- [ ] **Fast mode:** drag down ≥4px → Hold note with correct duration
- [ ] **Fast mode:** preview bar visible immediately on mousedown (min 4px height)
- [ ] Grid cursor is vertical resize (`ns-resize`) when editable
- [ ] **Popup mode:** click opens create popup (Hold pre-filled in `NotePopup`)
- [ ] **Popup mode:** mousedown+drag does NOT create notes
- [ ] **Selection → Type** toggle still converts selected note(s)
- [ ] Read-only chart: no broken placement UI

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Remove Create type toggle | Task 1 |
| Static placement hint | Task 1 |
| Click = Tap, drag = Hold (4px threshold) | Task 4 (existing drag effect unchanged) |
| Ghost vertical stem | Task 3 |
| Mousedown preview (min 4px) | Task 4 (existing `Math.max(HOLD_DRAG_THRESHOLD_PX, ...)`) |
| Track-colored drag preview | Task 4 Step 5 |
| `ns-resize` cursor | Task 4 Step 2 |
| Empty state copy | Task 4 Step 6 |
| Popup mode click → popup | Task 4 Step 4 |
| Popup mode no drag placement | Task 4 Step 3 |
| Remove `activeNoteType` store | Task 2 |
| Selection Type toggle preserved | Task 1 Step 2 |

No placeholders. All spec items mapped.
