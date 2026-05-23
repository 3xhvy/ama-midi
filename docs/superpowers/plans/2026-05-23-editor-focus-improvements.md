# Editor Focus Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add track color-coding, calm grid hierarchy, explicit selection state, and receded sidebars to the piano roll editor.

**Architecture:** Four visual layers built bottom-up — shared color constants → CSS tokens → component rendering → layout chrome. Each phase is independently shippable. Multi-select canvas wiring (P1) is a prerequisite for Phase 2 selection detail UI.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand, `@ama-midi/shared` (zero-dep shared types/colors)

**Spec:** `docs/superpowers/specs/2026-05-23-editor-focus-improvements-design.md`

---

## File Map

| File | Role in this plan |
|------|-------------------|
| `packages/shared/src/colors.ts` | Add `TRACK_COLORS`, `trackColor()` if absent |
| `apps/web/src/styles/globals.css` | Add CSS track vars, update grid vars, darken surface |
| `apps/web/src/features/editor/components/TrackHeader.tsx` | Color dot, density bar, `isActive` prop |
| `apps/web/src/features/editor/components/PianoRoll.tsx` | Multi-select wiring, `setActiveTrack`, vignette |
| `apps/web/src/features/editor/components/TapNote.tsx` | Selection ring style |
| `apps/web/src/features/editor/components/HoldNote.tsx` | Selection outline style |
| `apps/web/src/features/editor/components/SwipeNote.tsx` | Selection ring style |
| `apps/web/src/features/editor/components/GridLines.tsx` | CSS var refs for beat/bar lines |
| `apps/web/src/store/editor.store.ts` | `activeTrack` + `setActiveTrack` |
| `apps/web/src/pages/EditorPage.tsx` | `SingleNoteDetail`, `MultiNoteDetail`, pass `isActive` |
| `apps/web/src/components/layout/EditorShell.tsx` | Canvas separator divs |

---

## Task 1: Shared package — trackColor()

**Phase 1b prerequisite.** If `trackColor` already exists in `packages/shared/src/colors.ts`, skip this task.

**Files:**
- Modify: `packages/shared/src/colors.ts`

- [ ] **Step 1: Check if trackColor already exists**

```bash
grep -n "trackColor\|TRACK_COLORS" packages/shared/src/colors.ts
```

Expected: if output is empty, proceed. If `trackColor` is already defined, skip to Task 2.

- [ ] **Step 2: Add TRACK_COLORS and trackColor() to colors.ts**

Append to the end of `packages/shared/src/colors.ts`:

```typescript
export const TRACK_COLORS: Record<number, string> = {
  1: '#FF7B7B',   // red
  2: '#FFB347',   // amber
  3: '#7ED56F',   // green
  4: '#40E0D0',   // teal
  5: '#5B9BFF',   // blue
  6: '#9B7FFF',   // violet
  7: '#FF78BE',   // pink
  8: '#FF9F6B',   // orange
}

export function trackColor(track: number): string {
  return TRACK_COLORS[track] ?? '#6C63FF'
}
```

- [ ] **Step 3: Build shared package**

```bash
pnpm --filter @ama-midi/shared build
```

Expected: exits 0, no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/colors.ts
git commit -m "feat(shared): add TRACK_COLORS and trackColor() helper"
```

---

## Task 2: CSS track color tokens

**Files:**
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: Add track color CSS vars to :root**

Inside the `:root { ... }` block, after the existing `--color-editor-*` lines, add:

```css
/* Track identity colors */
--color-track-1: #FF7B7B;
--color-track-2: #FFB347;
--color-track-3: #7ED56F;
--color-track-4: #40E0D0;
--color-track-5: #5B9BFF;
--color-track-6: #9B7FFF;
--color-track-7: #FF78BE;
--color-track-8: #FF9F6B;
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/styles/globals.css
git commit -m "feat(css): add --color-track-1..8 design tokens"
```

---

## Task 3: TrackHeader — color dot, density bar, isActive prop

**Files:**
- Modify: `apps/web/src/features/editor/components/TrackHeader.tsx`

- [ ] **Step 1: Rewrite TrackHeader**

Replace the entire contents of `TrackHeader.tsx` with:

```tsx
import { cn } from '../../../lib/utils'
import { trackColor } from '@ama-midi/shared'

export interface TrackHeaderProps {
  track:        number
  isMuted:      boolean
  noteCount:    number
  maxCount:     number
  isActive?:    boolean
  onToggleMute: () => void
}

export function TrackHeader({
  track, isMuted, noteCount, maxCount, isActive = false, onToggleMute,
}: TrackHeaderProps) {
  const density = maxCount > 0 ? noteCount / maxCount : 0
  const color = trackColor(track)

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors hover:bg-shell-bg select-none',
        isActive && 'bg-white/[0.04] rounded-[var(--radius-sm)]',
        isMuted && 'opacity-30',
      )}
      onClick={onToggleMute}
      title={isMuted ? `Track ${track} (muted — click to unmute)` : `Track ${track} — click to mute`}
    >
      <div
        className="w-2 h-2 rounded-full shrink-0 transition-shadow"
        style={{
          backgroundColor: color,
          boxShadow: isActive
            ? `0 0 0 3px color-mix(in srgb, ${color} 30%, transparent)`
            : undefined,
        }}
      />

      <span className={cn('text-xs w-4 shrink-0', isActive ? 'text-shell-text font-medium' : 'text-shell-muted')}>
        T{track}
      </span>

      <div className="flex-1 h-1.5 rounded-full bg-shell-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${density * 100}%`, backgroundColor: color }}
        />
      </div>

      <span className="text-[9px] text-shell-muted w-3 text-right shrink-0">
        {isMuted ? 'M' : ''}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0. If `color-mix` triggers a lint warning, that is fine — it's a CSS expression inside a JS string, not CSS lint.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/TrackHeader.tsx
git commit -m "feat(editor): TrackHeader — track color dot, density bar, isActive prop"
```

---

## Task 4: Multi-select canvas wiring (Prerequisite P1)

`PianoRoll` currently stores `selectedNote` locally and only highlights one note. The store already has `selectedNoteIds`, `selectNote`, `toggleNoteSelection`, `clearSelection` — wire them up.

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Verify store actions exist**

```bash
grep -n "toggleNoteSelection\|clearSelection\|selectedNoteIds" apps/web/src/store/editor.store.ts
```

Expected: all three appear. If any are missing, add them to the store before continuing.

- [ ] **Step 2: Remove local selectedNote state, add store reads**

In `PianoRoll.tsx`:

Remove this line near the top of the component:
```tsx
const [selectedNote, setSelectedNote] = useState<Note | null>(null)
```

Add to the destructure of `useEditorStore(...)` (the line that already destructures `pxPerSecond`, `viewMode`, etc.):
```tsx
const { pxPerSecond, viewMode, playheadTime, snapMode, heatmapEnabled, isPlaying, zoom, setZoom, createMode,
        selectedNoteIds, selectNote, toggleNoteSelection, clearSelection } = useEditorStore()
```

- [ ] **Step 3: Update handleNoteClick**

Replace the existing `handleNoteClick`:

```tsx
const handleNoteClick = useCallback((note: Note, e: React.MouseEvent) => {
  e.stopPropagation()
  if (e.shiftKey) {
    toggleNoteSelection(note.id)
  } else {
    selectNote(note.id)
    setPopup({ type: 'edit', note, pos: { x: e.clientX, y: e.clientY } })
  }
  onNoteSelected?.(note)
}, [onNoteSelected, selectNote, toggleNoteSelection])
```

- [ ] **Step 4: Update NoteCircle isSelected prop**

Find this line in the JSX:
```tsx
isSelected={selectedNote?.id === note.id}
```

Replace with:
```tsx
isSelected={selectedNoteIds.has(note.id)}
```

- [ ] **Step 5: Update keyboard handler**

Replace the `useEffect` keyboard handler with:

```tsx
useEffect(() => {
  function handler(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if ((e.key === 'e' || e.key === 'E') && selectedNoteIds.size === 1 && effectiveCanEdit && !popup) {
      const note = notes.find(n => selectedNoteIds.has(n.id))
      if (note) setPopup({ type: 'edit', note, pos: { x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 - 230 } })
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteIds.size > 0 && effectiveCanEdit && !popup) {
      notes.filter(n => selectedNoteIds.has(n.id)).forEach(n => deleteNote.mutate(n.id))
      clearSelection()
      onNoteSelected?.(null)
    }
    if (e.key === 'Escape' && !popup) {
      clearSelection()
      onNoteSelected?.(null)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [selectedNoteIds, effectiveCanEdit, deleteNote, popup, onNoteSelected, notes, clearSelection])
```

- [ ] **Step 6: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0. Fix any remaining references to `selectedNote` (should be none after steps 2–5).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "feat(editor): wire multi-select canvas — selectedNoteIds from store"
```

---

## Task 5: Selection rings — TapNote, HoldNote, SwipeNote

**Files:**
- Modify: `apps/web/src/features/editor/components/TapNote.tsx`
- Modify: `apps/web/src/features/editor/components/HoldNote.tsx`
- Modify: `apps/web/src/features/editor/components/SwipeNote.tsx`

### TapNote

- [ ] **Step 1: Update TapNote ring logic**

In `TapNote.tsx`, replace the `ringClass` block and div style:

```tsx
// Replace the ringClass const and its usage:
const qaRingClass =
  viewMode === 'qa'
    ? isNearBoundary
      ? 'ring-2 ring-orange-400'
      : hasCloseNeighbor
        ? 'ring-2 ring-yellow-400'
        : ''
    : ''

const hasQaRing = viewMode === 'qa' && (isNearBoundary || hasCloseNeighbor)
const selectionShadow = isSelected && !hasQaRing
  ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.90)' }
  : undefined
```

Update the main div (replace `ringClass` reference with `qaRingClass`, add `selectionShadow`):

```tsx
<div
  data-note={note.id}
  className={cn(
    'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear group',
    qaRingClass,
  )}
  style={{ left: cx - 8, top: cy - 8, backgroundColor: trackColor(note.track), ...selectionShadow }}
  title={`${note.title} | Track ${note.track} | ${displayTime}s`}
  onClick={(e) => onClick(note, e)}
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
>
```

Add import at the top if `trackColor` is not yet imported:
```tsx
import { trackColor } from '@ama-midi/shared'
```

### HoldNote

- [ ] **Step 2: Update HoldNote ring → outline**

In `HoldNote.tsx`, replace the `ringClass` const and the outer wrapper div:

```tsx
// Replace:
// const ringClass = isSelected ? 'ring-2 ring-white' : ''

// With no ringClass. Add selection outline directly to the outer wrapper style:
```

Updated outer wrapper (remove `ringClass` from className, add inline style):

```tsx
<div
  data-note={note.id}
  className="absolute pointer-events-none"
  style={{
    left:          cx - tw / 6,
    top:           y - 8,
    width:         tw / 3,
    height:        bodyHeight + 16,
    outline:       isSelected ? '2px solid rgba(255,255,255,0.90)' : undefined,
    outlineOffset: isSelected ? '2px' : undefined,
  }}
>
```

Update the head circle and body bar to use `trackColor(note.track)`:

```tsx
// Head circle — backgroundColor:
style={{ top: 0, backgroundColor: trackColor(note.track) }}

// Body bar — backgroundColor:
style={{ top: 8, height: bodyHeight, backgroundColor: trackColor(note.track) }}

// Tail dot — backgroundColor:
style={{ top: bodyHeight + 8 - 4, backgroundColor: trackColor(note.track) }}
```

Add import at top:
```tsx
import { trackColor } from '@ama-midi/shared'
```

### SwipeNote

- [ ] **Step 3: Update SwipeNote selection + track color**

In `SwipeNote.tsx`, find the two `note.color` references and replace both with `trackColor(note.track)`. Also add selection shadow (same treatment as TapNote):

The main circle div style should become:
```tsx
style={{ left: cx - 8, top: y - 8, backgroundColor: trackColor(note.track), boxShadow: isSelected ? '0 0 0 2px rgba(255,255,255,0.90)' : undefined }}
```

The tail border:
```tsx
borderLeft: `6px solid ${trackColor(note.track)}`,
```

Add import:
```tsx
import { trackColor } from '@ama-midi/shared'
```

- [ ] **Step 4: Verify SwipeNote has isSelected prop**

```bash
grep -n "isSelected" apps/web/src/features/editor/components/SwipeNote.tsx
```

Expected: `isSelected` appears in props and is used. If the prop is missing, add it to the props interface:
```tsx
isSelected?: boolean
```

- [ ] **Step 5: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/TapNote.tsx \
        apps/web/src/features/editor/components/HoldNote.tsx \
        apps/web/src/features/editor/components/SwipeNote.tsx
git commit -m "feat(editor): selection rings — boxShadow on tap, outline on hold"
```

---

## Task 6: Right panel — SingleNoteDetail and MultiNoteDetail

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Add SingleNoteDetail component**

In `EditorPage.tsx`, add this local function before `ToolsTab`:

```tsx
function SingleNoteDetail({ note }: { note: Note }) {
  const color = trackColor(note.track)
  const typeLabel = note.noteType === 'HOLD' ? 'Hold' : note.noteType === 'SWIPE' ? 'Swipe' : 'Tap'
  return (
    <div className="flex flex-col gap-0.5 text-[11px] text-shell-muted">
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span>Track {note.track} · {typeLabel}</span>
      </div>
      <span>{note.time}s{note.noteType === 'HOLD' && note.duration ? ` · ${note.duration}s hold` : ''}</span>
    </div>
  )
}
```

Add `trackColor` to the existing `@ama-midi/shared` import at the top (do not remove other imports already there).

- [ ] **Step 2: Add MultiNoteDetail component**

Add after `SingleNoteDetail`:

```tsx
function MultiNoteDetail({ notes }: { notes: Note[] }) {
  const uniqueTracks = [...new Set(notes.map(n => n.track))].sort((a, b) => a - b)
  const minTime = Math.min(...notes.map(n => n.time))
  const maxTime = Math.max(...notes.map(n => n.time + (n.duration ?? 0)))
  return (
    <div className="flex flex-col gap-0.5 text-[11px] text-shell-muted">
      <div className="flex items-center gap-1">
        <span>{notes.length} notes</span>
        <div className="flex items-center gap-0.5 ml-1">
          {uniqueTracks.map(t => (
            <div
              key={t}
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: trackColor(t) }}
            />
          ))}
        </div>
      </div>
      <span>{Math.round(minTime * 10) / 10}s – {Math.round(maxTime * 10) / 10}s</span>
    </div>
  )
}
```

- [ ] **Step 3: Insert detail components into ToolsTab selection section**

In `ToolsTab`, find the selection section's non-empty branch (the `<>` inside `selectedCount !== 0`). Add the detail component at the very top, before the `canEdit` block:

```tsx
{selectedCount === 0 ? (
  <p className="text-xs text-shell-muted leading-relaxed">
    Select notes on the canvas to edit groups here.
  </p>
) : (
  <>
    {selectedCount === 1
      ? <SingleNoteDetail note={selectedNotes[0]} />
      : <MultiNoteDetail notes={selectedNotes} />
    }

    {canEdit && (
      <>
        <ToolRow label="Type">
          ...existing...
        </ToolRow>
        ...rest of existing controls...
      </>
    )}
    ...existing buttons...
  </>
)}
```

The existing controls remain unchanged — the detail row is inserted above them.

- [ ] **Step 4: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): SingleNoteDetail + MultiNoteDetail in right panel selection"
```

---

## Task 7: Grid — CSS tokens + GridLines token references

**Files:**
- Modify: `apps/web/src/styles/globals.css`
- Modify: `apps/web/src/features/editor/components/GridLines.tsx`

- [ ] **Step 1: Update grid CSS vars in globals.css**

In `:root`, update the two existing grid vars and add the bar var:

```css
--color-grid-line:      rgba(255, 255, 255, 0.05);   /* sub-beat — was 0.06 */
--color-grid-line-bold: rgba(255, 255, 255, 0.10);   /* beat     — was 0.12 */
--color-grid-line-bar:  rgba(255, 255, 255, 0.18);   /* bar/measure (new) */
```

Add canvas alias alongside the existing `--canvas-grid` and `--canvas-grid-bold` lines:

```css
--canvas-grid-bar: var(--color-grid-line-bar);
```

- [ ] **Step 2: Update GridLines beatLines rendering**

In `GridLines.tsx`, find the `beatLines.map(...)` block. Replace the hardcoded `background` values:

```tsx
{beatLines.map((line, i) => (
  <div
    key={`b${i}`}
    className="absolute left-0 right-0 pointer-events-none"
    style={{
      top:        line.y,
      height:     1,
      background: line.weight === 'measure'
        ? 'var(--canvas-grid-bar)'
        : 'var(--canvas-grid-bold)',
    }}
  />
))}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/styles/globals.css \
        apps/web/src/features/editor/components/GridLines.tsx
git commit -m "feat(editor): grid hierarchy tokens — sub-beat/beat/bar opacity levels"
```

---

## Task 8: Vignette overlay in PianoRoll

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Add vignette div after GridLines**

In `PianoRoll.tsx`, inside the `<div className="relative" style={{ height: totalHeight }}>` wrapper, add the vignette div immediately after `<GridLines ... />`:

```tsx
<GridLines
  virtualItems={rowVirtualizer.getVirtualItems()}
  gridWidth={gridWidth}
  beatLines={beatLines}
/>

{/* Vignette — soft top/bottom fade to reduce edge harshness */}
<div
  className="absolute inset-0 pointer-events-none"
  style={{
    background: 'linear-gradient(180deg, rgba(19,17,30,0.30) 0%, transparent 6%, transparent 94%, rgba(19,17,30,0.30) 100%)',
    zIndex: 1,
  }}
/>
```

Notes always render at z-index 5+ via Tailwind `z-*` or inline styles, so they remain above the vignette.

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "feat(editor): vignette overlay — soft top/bottom canvas fade"
```

---

## Task 9: Sidebar surface tokens + activeTrack store

**Files:**
- Modify: `apps/web/src/styles/globals.css`
- Modify: `apps/web/src/store/editor.store.ts`

### CSS surface tokens

- [ ] **Step 1: Update surface vars in globals.css**

In `:root`, update:
```css
--color-editor-surface: #181628;   /* was #1E1B2E */
```

In `.dark {}` block, update:
```css
--shell-surface: #181628;   /* was #1E1B2E */
```

### activeTrack store

- [ ] **Step 2: Add activeTrack to EditorStore interface**

In `editor.store.ts`, add to the `EditorStore` interface:
```typescript
activeTrack:    number | null
setActiveTrack: (track: number | null) => void
```

- [ ] **Step 3: Add activeTrack initial state and action**

In the `create<EditorStore>((set) => ({ ... }))` block, add:
```typescript
activeTrack:    null,
setActiveTrack: (activeTrack) => set({ activeTrack }),
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles/globals.css \
        apps/web/src/store/editor.store.ts
git commit -m "feat(editor): darken sidebar surface, add activeTrack store"
```

---

## Task 10: TrackHeader active state wiring

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`

### PianoRoll — call setActiveTrack

- [ ] **Step 1: Destructure setActiveTrack from store in PianoRoll**

Add `setActiveTrack` to the `useEditorStore` destructure in `PianoRoll.tsx`:
```tsx
const { ..., setActiveTrack } = useEditorStore()
```

- [ ] **Step 2: Call setActiveTrack on every mouse move**

In `handleMouseMove`, add `setActiveTrack(track)` **before** the `if (!effectiveCanEdit) return` guard — active track should highlight on hover even in read-only/preview mode:

```tsx
const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  if (!containerRef.current) return
  const rect  = containerRef.current.getBoundingClientRect()
  const x     = e.clientX - rect.left
  const y     = e.clientY - rect.top + scrollTop
  const track = xToTrack(x, gridWidth)
  const time  = yToTime(y, pxPerSecond, snapMode, bpm)
  throttledCursorEmit(track, time)
  setActiveTrack(track)           // ← always, before edit guard
  if (!effectiveCanEdit) return
  setGhost({ track, time })
}, [effectiveCanEdit, gridWidth, pxPerSecond, scrollTop, snapMode, bpm, throttledCursorEmit, setActiveTrack])
```

- [ ] **Step 3: Call setActiveTrack(null) on mouse leave**

Find the `onMouseLeave` handler on the scroll container:
```tsx
onMouseLeave={() => effectiveCanEdit && setGhost(null)}
```

Update to also clear active track:
```tsx
onMouseLeave={() => {
  if (effectiveCanEdit) setGhost(null)
  setActiveTrack(null)
}}
```

### EditorPage — pass isActive to TrackHeader

- [ ] **Step 4: Read activeTrack from store in EditorPage**

In `EditorPage`, add `activeTrack` to the destructure from `useEditorStore()`:
```tsx
const {
  viewMode,
  rightPanelTab, setRightPanelTab,
  leftCollapsed, rightCollapsed,
  toggleLeftPanel, toggleRightPanel,
  setLeftCollapsed, setRightCollapsed,
  playheadTime, selectNote, triggerAiSuggest,
  selectedNoteIds, clearSelection,
  activeTrack,
} = useEditorStore()
```

- [ ] **Step 5: Pass isActive to TrackHeader**

In the `leftPanel` JSX, update the `TrackHeader` render:
```tsx
<TrackHeader
  key={track}
  track={track}
  isMuted={mutedTracks.has(track)}
  noteCount={allNotes.filter(n => n.track === track).length}
  maxCount={maxNoteCount}
  isActive={activeTrack === track}
  onToggleMute={() => toggleMute(track, false)}
/>
```

- [ ] **Step 6: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx \
        apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): activeTrack — highlight left panel row on ghost hover"
```

---

## Task 11: Canvas separators in EditorShell

**Files:**
- Modify: `apps/web/src/components/layout/EditorShell.tsx`

- [ ] **Step 1: Add separator between left panel and main**

In `EditorShell.tsx`, in the desktop layout section (`{!isMobile && ( <aside ...leftPanel... /> )}`), add the separator immediately after the left panel `<aside>` closing tag:

```tsx
{/* Left separator */}
{!isMobile && !leftCollapsed && (
  <div
    className="shrink-0 self-stretch"
    style={{
      width: 2,
      background: 'linear-gradient(180deg, transparent, var(--color-primary) 30%, var(--color-primary) 70%, transparent)',
      opacity: 0.20,
    }}
  />
)}
```

- [ ] **Step 2: Add separator between main and right panel**

Add a matching separator before the right panel `<aside>` (desktop only):

```tsx
{/* Right separator */}
{!isMobile && !isTablet && !rightCollapsed && (
  <div
    className="shrink-0 self-stretch"
    style={{
      width: 2,
      background: 'linear-gradient(180deg, transparent, var(--color-primary) 30%, var(--color-primary) 70%, transparent)',
      opacity: 0.20,
    }}
  />
)}
```

The tablet right panel is an overlay drawer — no separator needed there.

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/EditorShell.tsx
git commit -m "feat(editor): canvas separator divs between panels and main area"
```

---

## Final verification

- [ ] **Run type-check across all packages**

```bash
pnpm --filter @ama-midi/shared build && cd apps/web && npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Visual smoke test**

Open the editor with a song. Check:

- [ ] T1 notes red, T2 amber, T3 green, T4 teal, T5 blue, T6 violet, T7 pink, T8 orange
- [ ] Left panel track dots match canvas note colors
- [ ] Bar lines visibly brighter than beat lines; beat lines brighter than sub-beat lines
- [ ] Click one note → white ring/shadow appears + `SingleNoteDetail` row in right panel
- [ ] Shift-click additional notes → all get rings + `MultiNoteDetail` shows count + time span
- [ ] Hover placement ghost → that track row highlights in left panel
- [ ] Sidebars appear darker than canvas background
- [ ] Canvas separators visible on desktop, absent on mobile
- [ ] QA view: boundary/neighbor rings still show; no regression on orange/yellow rings
- [ ] Collapse left panel → left separator disappears
- [ ] Collapse right panel → right separator disappears

---

## Out of scope

- Section marker colors
- Difficulty heatmap styling
- Collaborator cursor colors
- Phase 5 optional polish (canvas T-header dots, hold-drag preview color)
