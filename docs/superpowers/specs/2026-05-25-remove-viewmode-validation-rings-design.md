# Remove ViewMode + Validation Rings Design Spec

**Date:** 2026-05-25
**Status:** Approved

---

## Problem

The View mode toggle (Composer / Dev / QA / Preview) adds UI complexity without real workflow value. QA rings used heuristics (near boundary, close neighbor) rather than real validation data. The validation tab is visually weak — hard to scan, no severity hierarchy.

---

## Solution

1. **Remove `viewMode` entirely** from store, UI, and all note renderers
2. **Replace QA heuristic rings** with semantic validation rings driven by real `useValidation` data, controlled by a toggle button
3. **Redesign ValidationPanel** with colored left-border issue cards and a sticky severity header

---

## Part 1: ViewMode Removal

### Store (`store/editor.store.ts`)

Remove:
- `type ViewMode`
- `viewMode: ViewMode` field
- `setViewMode: (mode: ViewMode) => void` action
- `viewMode: 'composer'` initial value
- `setViewMode: (viewMode) => set({ viewMode })` implementation

Add:
- `validationRingsEnabled: boolean` (default `false`)
- `setValidationRingsEnabled: (v: boolean) => void`

### `pages/EditorPage.tsx`

Remove:
- `viewMode` from `useEditorStore()` destructure
- `VIEW_MODES` constant
- `ToolRow label="View"` block (entire ToggleGroup row)
- `setViewMode` from `ToolsTab` props and interface
- `{viewMode !== 'composer' && <div>…{viewMode} view</div>}` badge

Replace `ToolRow label="View"` with a `Validation rings` toggle button (same style as existing `Difficulty heatmap` button):

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

Pass `validationIssues` to `PianoRoll`:

```tsx
const { issues: validationIssues } = useValidation(songId)
// ...
<PianoRoll validationIssues={validationIssues} ... />
```

### `NoteVariantProps` (`components/TapNote.tsx`)

Remove `viewMode?: 'composer' | 'developer' | 'qa' | 'preview'`

Add `validationRing?: 'error' | 'warning' | null`

### `components/TapNote.tsx`

Remove:
- `viewMode` param (default `'composer'`)
- `isNearBoundary`, `hasCloseNeighbor` logic
- `qaRingClass`, `hasQaRing`
- `displayTime` conditional (always use `Math.round(note.time * 10) / 10`)
- Developer ID overlay `{viewMode === 'developer' && …}`

Add ring from `validationRing` prop:
```tsx
const ringClass =
  validationRing === 'error'   ? 'ring-2 ring-red-400' :
  validationRing === 'warning' ? 'ring-2 ring-yellow-400' : ''
```

Always show tooltip on hover (remove viewMode condition).

### `components/HoldNote.tsx`

Remove `viewMode` param.

Change tooltip condition: always show on hover (remove `viewMode === 'composer' || viewMode === 'developer'` guard).

Add `validationRing?: 'error' | 'warning' | null` prop. Apply same `ringClass` via `outline` style:
```tsx
outline: validationRing === 'error'   ? '2px solid rgb(248 113 113)' :
         validationRing === 'warning' ? '2px solid rgb(251 191 36)'  :
         isSelected                   ? '2px solid rgba(255,255,255,0.90)' : undefined
```

### `components/PianoRoll.tsx`

Remove:
- `viewMode` from store destructure
- `const isPreview = viewMode === 'preview'`
- `const effectiveCanEdit = canEdit && !isPreview` → `const effectiveCanEdit = canEdit`
- `viewMode={viewMode}` prop on note renderers
- `{isPreview && <HitZone … />}` block
- Empty-state condition `viewMode === 'composer'` → always show empty state when `effectiveCanEdit && visibleNotes.length === 0`

Add:
- `validationIssues: ValidationIssue[]` prop
- `validationRingsEnabled` from `useEditorStore()`
- `noteRing` helper:

```ts
function noteRing(
  note: Note,
  issues: ValidationIssue[],
  enabled: boolean,
): 'error' | 'warning' | null {
  if (!enabled || issues.length === 0) return null
  const match = issues.find(
    (i) =>
      Math.abs(i.time - note.time) < 0.15 &&
      (i.track == null || i.track === note.track),
  )
  if (!match) return null
  return match.severity === 'error' ? 'error' : 'warning'
}
```

Pass to each note renderer:
```tsx
validationRing={noteRing(note, validationIssues, validationRingsEnabled)}
```

---

## Part 2: ValidationPanel Redesign

### Visual structure

**Header (sticky):**
- Left: `● N errors` in `text-red-400`, `▲ N warnings` in `text-yellow-400` — only shown when count > 0
- Right: `↻` refresh button
- `border-b border-shell-border`

**Issue cards:**
- Full-width clickable row
- `4px` left border: `border-l-4 border-red-400` (error) or `border-l-4 border-yellow-400` (warning)
- Icon: `●` (error, red) or `▲` (warning, amber)
- Message: `text-shell-text text-xs`
- Jump line: `text-shell-muted text-[10px]` — only when `issue.time` present
- Hover: `bg-shell-bg/60`
- Separated by `border-b border-shell-border/50`

**Empty state:**
```
✓  All clear
No validation issues found
```
Centered, `text-green-400` checkmark, `text-shell-muted` subtitle.

**Loading state:** 3 skeleton rows (existing pulse animation — keep as-is).

### Component signature (unchanged externally)

```tsx
interface Props {
  songId: string
  onJumpTo?: (time: number, track?: number) => void
}
```

---

## Data Types

`ValidationIssue` from `useValidation` — confirm shape:
```ts
interface ValidationIssue {
  severity: 'error' | 'warning'
  message: string
  time?: number
  track?: number
}
```

Check `apps/web/src/features/validation/useValidation.ts` — use whatever type it already exports. Do NOT redefine.

---

## Out of Scope

- Hover-linking between panel row and canvas note
- Keyboard navigation of issue list
- Filtering issues by severity in the panel (tab filters already removed)
- Removing `HitZone` component file itself (leave the file, just stop rendering it)

---

## Success Criteria

1. No `viewMode` reference anywhere in `src/` (grep clean)
2. `setViewMode` removed from store — TypeScript catches any missed callsite
3. Notes show red/amber ring when `validationRingsEnabled` and a matching issue exists
4. Rings disappear when toggle is Off
5. ValidationPanel renders colored left-border cards with correct severity
6. Empty state renders when no issues
7. All existing tests pass
