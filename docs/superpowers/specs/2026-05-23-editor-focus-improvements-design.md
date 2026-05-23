# Editor Focus Improvements — Design Spec

**Date:** 2026-05-23  
**Status:** Approved  
**Goal:** Reduce visual noise in the piano roll editor and add clear focal hierarchy via four targeted changes.

---

## Context

Current problems:
- All 8 tracks render in the same purple (`#6C63FF`). Notes are indistinguishable by track without reading the track list.
- Grid lines (sub-beat, beat, bar) share identical visual weight, making the canvas noisy.
- Selected notes show no ring distinction in the right panel's Selection section (it always reads "none" for count).
- Left and right sidebars draw the eye equally with the canvas — no hierarchy.

Existing design tokens used as baseline:
```
--color-editor-bg:      #13111E
--color-editor-surface: #1E1B2E
--color-editor-border:  #2D2847
--color-grid-line:      rgba(255,255,255,0.06)
--color-grid-line-bold: rgba(255,255,255,0.12)
```

Reference mockup: `/Users/hohoanghvy/Downloads/editor_focus_improvements.html`

---

## Change 1 — Color-code each track

**Decision:** Track color always wins. `note.color` is ignored for rendering; track color is always used. The right panel color picker remains for future per-note override support.

### Shared package (`packages/shared/src/colors.ts`)

Add:
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
```

Do not modify `NOTE_PRESET_COLORS` or `LAYER_COLORS`.

### CSS (`apps/web/src/styles/globals.css`)

Add to `:root`:
```css
--color-track-1: #FF7B7B;
--color-track-2: #FFB347;
--color-track-3: #7ED56F;
--color-track-4: #40E0D0;
--color-track-5: #5B9BFF;
--color-track-6: #9B7FFF;
--color-track-7: #FF78BE;
--color-track-8: #FF9F6B;
```

### Note components

`TapNote.tsx`, `HoldNote.tsx`: replace `backgroundColor: note.color` with `backgroundColor: TRACK_COLORS[note.track]`.

`HoldNote` body bar keeps `opacity: 0.70` (slightly softer than head).

`SwipeNote.tsx`: two color references — replace both `note.color` usages:
- Main dot `backgroundColor`
- Swipe tail `borderLeft` color

### TrackHeader (`apps/web/src/features/editor/components/TrackHeader.tsx`)

- Add 8px circle dot before the track label, colored with `TRACK_COLORS[track]`.
- Change density bar fill from `bg-primary/60` to `TRACK_COLORS[track]` via inline style.

---

## Change 2 — Calm the grid

### CSS (`apps/web/src/styles/globals.css`)

Update in `:root`:
```css
--color-grid-line:      rgba(255, 255, 255, 0.05);   /* was 0.06 — sub-beat */
--color-grid-line-bold: rgba(255, 255, 255, 0.10);   /* was 0.12 — beat */
```

Add:
```css
--color-grid-line-bar:  rgba(255, 255, 255, 0.18);   /* new — bar/section */
```

Add canvas alias:
```css
--canvas-grid-bar: var(--color-grid-line-bar);
```

### GridLines (`apps/web/src/features/editor/components/GridLines.tsx`)

Beat lines from `beatLines` array currently hardcoded:
- `line.weight === 'measure'`: `rgba(255,255,255,0.10)` → `var(--canvas-grid-bar)`
- else: `rgba(255,255,255,0.04)` → `var(--canvas-grid-bold)`

### Vignette

In `PianoRoll.tsx`, add inside the canvas scroll area:
```tsx
<div
  className="absolute inset-0 pointer-events-none"
  style={{
    background: 'linear-gradient(180deg, rgba(19,17,30,0.30) 0%, transparent 6%, transparent 94%, rgba(19,17,30,0.30) 100%)',
    zIndex: 1,
  }}
/>
```

Place above `GridLines` but below notes (z-index 1; notes are z-index 5+).

---

## Change 3 — Make selection state explicit

### TapNote (circle notes)

Replace `ring-2 ring-white` class with inline style when selected:
```tsx
boxShadow: isSelected ? '0 0 0 2px rgba(255,255,255,0.90)' : undefined
```

Remove `ringClass` for the selected case; keep QA ring classes.

### HoldNote

Replace `ring-2 ring-white` on outer wrapper with inline style:
```tsx
outline: isSelected ? '2px solid rgba(255,255,255,0.90)' : undefined,
outlineOffset: isSelected ? '2px' : undefined,
```

### Right panel — selection detail

In `ToolsTab` (`apps/web/src/pages/EditorPage.tsx`), add detail display above existing controls in the selection section:

**When 1 note selected** — `SingleNoteDetail`:
- Track color dot (8px) + "Track N" label
- Note type (Tap / Hold / Swipe)
- Timestamp (`{time}s`)
- Duration if Hold (`{duration}s hold`)
- 11px text, `text-shell-muted`

**When 2+ notes selected** — `MultiNoteDetail`:
- "{N} notes selected"
- Unique track dots (colored, 6px each, clustered)
- Time span: `{minTime}s – {maxTime}s`
- 11px text, `text-shell-muted`

Both components live as local functions in `EditorPage.tsx`. No new files needed.

---

## Change 4 — Reduce sidebar visual weight

### CSS (`apps/web/src/styles/globals.css`)

`:root`:
```css
--color-editor-surface: #181628;   /* was #1E1B2E */
```

`.dark` block:
```css
--shell-surface: #181628;   /* was #1E1B2E */
```

### Active track state

`apps/web/src/store/editor.store.ts`: add `activeTrack: number | null` (default `null`) and `setActiveTrack(track: number | null)` action.

`PianoRoll.tsx`: call `setActiveTrack(ghost.track)` when ghost updates, `setActiveTrack(null)` on mouse leave from canvas.

### TrackHeader

Add `isActive?: boolean` prop (default `false`).

Active row: `bg-white/[0.04]` background, `rounded-[var(--radius-sm)]`, track label at full `text-shell-text`.  
Active dot: `boxShadow: '0 0 0 3px color-mix(in srgb, TRACK_COLORS[track] 30%, transparent)'` inline.  
Inactive labels: `text-shell-muted` (already the case for the muted indicator; apply to track name label too).

`EditorPage.tsx`: read `activeTrack` from store, pass `isActive={activeTrack === track}` to each `TrackHeader`.

### Canvas separator

`EditorShell.tsx`: add 2px wide `div` between left `<aside>` and `<main>`, and between `<main>` and right `<aside>`:

```tsx
<div
  className="shrink-0 self-stretch"
  style={{
    width: 2,
    background: 'linear-gradient(180deg, transparent, var(--color-primary) 30%, var(--color-primary) 70%, transparent)',
    opacity: 0.20,
  }}
/>
```

Only render when panel is not collapsed.

---

## Implementation order

1. Change 1 (track colors) — highest visual impact, makes other changes easier to verify
2. Change 3 (selection state) — unblocks QA testing
3. Change 2 (grid calm) — fine-tune after colors in place
4. Change 4 (sidebar weight) — polish pass last

---

## Files modified

| File | Change |
|------|--------|
| `packages/shared/src/colors.ts` | Add `TRACK_COLORS` |
| `apps/web/src/styles/globals.css` | Add track CSS vars, update grid vars, update surface colors |
| `apps/web/src/features/editor/components/TapNote.tsx` | Track color + selection shadow |
| `apps/web/src/features/editor/components/HoldNote.tsx` | Track color + selection outline |
| `apps/web/src/features/editor/components/SwipeNote.tsx` | Track color |
| `apps/web/src/features/editor/components/TrackHeader.tsx` | Color dot, density bar color, active state |
| `apps/web/src/features/editor/components/GridLines.tsx` | CSS vars for beat/bar lines |
| `apps/web/src/features/editor/components/PianoRoll.tsx` | Vignette overlay, setActiveTrack on ghost |
| `apps/web/src/store/editor.store.ts` | `activeTrack` + `setActiveTrack` |
| `apps/web/src/pages/EditorPage.tsx` | `SingleNoteDetail`, `MultiNoteDetail`, pass `isActive` |
| `apps/web/src/components/layout/EditorShell.tsx` | Canvas separator divs |

---

## Acceptance criteria

| Change | Done when… |
|--------|-----------|
| Track colors | T1–T8 each has distinct note color; track dot in left panel matches |
| Grid calm | Bar markers clearly brighter than beat lines; beat lines clearly brighter than sub-beat |
| Selection state | 1 note: white shadow/outline + detail row in panel. 2+ notes: count + time span + track dots |
| Sidebar weight | Sidebars visually recede; active track row is brightest element in left panel |
