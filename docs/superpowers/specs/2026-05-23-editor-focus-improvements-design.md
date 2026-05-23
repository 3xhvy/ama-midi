# Editor Focus Improvements — Implementation Plan

**Date:** 2026-05-23  
**Status:** In progress  
**Goal:** Reduce visual noise in the piano roll and establish clear focal hierarchy — canvas first, sidebars second.

---

## Success criteria (ship when all pass)

| Area | User-visible outcome |
|------|----------------------|
| Track identity | Any note is identifiable by track color without reading labels |
| Grid | Bar lines > beat lines > sub-beat lines at a glance |
| Selection | Selected notes have visible canvas ring + useful detail in right panel |
| Hierarchy | Sidebars recede; active track row is the brightest element in the left panel |

Manual smoke test: open seed song (10k notes), toggle QA view, select single + multi notes, hover placement ghost, collapse panels.

---

## Locked product decisions

1. **No per-note color.** Color is derived from track only via `TRACK_COLORS` / `trackColor(track)`. The `notes.color` column is removed; no color pickers on notes.
2. **Section markers keep their own colors** — unrelated to track colors.
3. **QA view rings take precedence** over selection styling on `TapNote` (boundary/neighbor warnings must remain visible).

---

## Progress

| Phase | Scope | Status |
|-------|--------|--------|
| **0** | Remove `Note.color` (API, types, pickers) | ✅ Done |
| **1a** | Render notes/ghosts/AI with `trackColor()` | ✅ Done |
| **1b** | Track CSS vars, `TrackHeader` dots + density bar | ⬜ Todo |
| **2a** | Multi-select on canvas (`selectedNoteIds`) | ⬜ Prerequisite |
| **2b** | Selection rings + panel detail components | ⬜ Todo |
| **3** | Grid tokens, `GridLines`, vignette | ⬜ Todo |
| **4** | Sidebar surface, `activeTrack`, separators | ⬜ Todo |
| **5** | Canvas track header dots, hold-drag preview color | ⬜ Optional polish |

---

## Prerequisites

### P0 — DB migration (if not applied)

```bash
cd apps/api && npx prisma migrate dev
```

Required after Phase 0 schema change (`DROP COLUMN notes.color`).

### P1 — Canvas multi-select (blocks Phase 2b multi-note UI)

**Problem:** `EditorPage` / store already support `selectedNoteIds`, but `PianoRoll` uses local `selectedNote` and only highlights one note on canvas.

**Required changes** (`PianoRoll.tsx`):

- Remove local `[selectedNote, setSelectedNote]`; read `selectedNoteIds`, `selectNote`, `toggleNoteSelection`, `clearSelection` from store.
- `handleNoteClick`: `shiftKey` → `toggleNoteSelection(note.id)`; else → `selectNote(note.id)` + open edit popup.
- `isSelected={selectedNoteIds.has(note.id)}` on `NoteCircle`.
- Keyboard: `Escape` → `clearSelection()`; `Delete` → delete all in `selectedNoteIds`.

Reference: `docs/superpowers/plans/2026-05-23-phase3-wave2-composition.md` Task 6.

---

## Phase 1 — Track identity

### 1a — Canvas rendering ✅ Done

| File | Change |
|------|--------|
| `packages/shared/src/colors.ts` | `TRACK_COLORS`, `trackColor()` |
| `packages/shared/src/types.ts` | No `color` on `Note`, `PatternNote`, `NoteSuggestion` |
| API + migration | Column dropped; DTOs cleaned |
| `TapNote`, `HoldNote`, `SwipeNote` | `trackColor(note.track)` |
| `GhostCircle`, `AiSuggestions`, `LiveContextStrip` | `trackColor(track)` |
| `NotePopup`, `EditorPage` ToolsTab | Color pickers removed |

### 1b — Left panel + tokens ⬜ Todo

**`apps/web/src/styles/globals.css`** — add to `:root`:

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

Optional: alias `--canvas-track-N: var(--color-track-N)` if canvas chrome should use CSS vars instead of TS.

**`TrackHeader.tsx`**

- 8px circle dot before label, `backgroundColor: trackColor(track)`.
- Density bar fill: `trackColor(track)` instead of `bg-primary/60`.
- Track label default: `text-shell-muted` (brightens when active — Phase 4).

**Verify:** T1 dot color matches T1 notes on canvas.

---

## Phase 2 — Selection clarity

Depends on **P1 multi-select** for multi-note paths.

### 2a — Canvas selection rings

**`TapNote.tsx`**

- Composer/Dev/Preview selected: `boxShadow: '0 0 0 2px rgba(255,255,255,0.90)'` (not `ring-2 ring-white`).
- QA mode: keep orange/yellow `ringClass`; add white `boxShadow` only when selected **and** no QA ring active.

**`HoldNote.tsx`**

- Selected outer wrapper: `outline: '2px solid rgba(255,255,255,0.90)'`, `outlineOffset: '2px'`.

**`SwipeNote.tsx`** (currently missing from original spec)

- Same `boxShadow` treatment as `TapNote`.

Wire `isSelected` from `selectedNoteIds.has(note.id)` after P1.

### 2b — Right panel detail

**`EditorPage.tsx` ToolsTab** — add above Type controls when `selectedCount > 0`:

**`SingleNoteDetail`** (1 note):

- Track dot (8px) + "Track N"
- Type label (Tap / Hold / Swipe)
- `{time}s` · `{duration}s hold` when Hold
- `text-[11px] text-shell-muted`

**`MultiNoteDetail`** (2+ notes):

- "{N} notes"
- Unique track dots (6px, clustered)
- Time span: `{minTime}s – {maxTime}s`

Update empty-state copy — remove "Single-note details stay in the note popup" (panel now owns summary).

**Verify:** Select 1 note → detail row + white ring. Shift-select 3 notes → multi summary + 3 rings on canvas.

---

## Phase 3 — Calm the grid

### CSS (`globals.css`)

```css
--color-grid-line:      rgba(255, 255, 255, 0.05);   /* sub-beat */
--color-grid-line-bold: rgba(255, 255, 255, 0.10);   /* beat */
--color-grid-line-bar:  rgba(255, 255, 255, 0.18);   /* bar/measure */
--canvas-grid-bar: var(--color-grid-line-bar);
```

### `GridLines.tsx`

| Line source | Token |
|-------------|-------|
| `virtualItems`, `index % 10 !== 0` | `var(--canvas-grid)` |
| `virtualItems`, `index % 10 === 0` | `var(--canvas-grid-bold)` |
| `beatLines`, not measure | `var(--canvas-grid-bold)` |
| `beatLines`, `weight === 'measure'` | `var(--canvas-grid-bar)` |
| Vertical track dividers | `var(--canvas-grid)` (unchanged) |

### Vignette (`PianoRoll.tsx`)

Insert after `GridLines`, before notes/overlay content:

```tsx
<div
  className="absolute inset-0 pointer-events-none"
  style={{
    background: 'linear-gradient(180deg, rgba(19,17,30,0.30) 0%, transparent 6%, transparent 94%, rgba(19,17,30,0.30) 100%)',
    zIndex: 1,
  }}
/>
```

DOM order handles stacking — notes render above without needing `z-index: 5`.

**Verify:** At 120 BPM / 4/4, bar lines visibly strongest; sub-beat lines fade into background.

---

## Phase 4 — Sidebar hierarchy

### Surface tokens (`globals.css`)

```css
/* :root */
--color-editor-surface: #181628;   /* was #1E1B2E */

/* .dark */
--shell-surface: #181628;
```

Canvas bg stays `#13111E` — panels sit slightly above bg, below note contrast.

### Active track (`editor.store.ts`)

```typescript
activeTrack: number | null   // default null
setActiveTrack(track: number | null)
```

**Sources** (both, last wins on leave):

| Event | Set |
|-------|-----|
| Ghost hover (`PianoRoll` mousemove) | `ghost.track` |
| Note selected (single) | `note.track` |
| Canvas mouse leave / deselect all | `null` |

**`TrackHeader`**: `isActive?: boolean`

- Active: `bg-white/[0.04]`, `rounded-[var(--radius-sm)]`, label `text-shell-text`
- Active dot: `boxShadow: '0 0 0 3px color-mix(in srgb, ${trackColor(track)} 30%, transparent)'`
- Inactive label: `text-shell-muted`

**`EditorPage`**: `isActive={activeTrack === track}` on each `TrackHeader`.

### Canvas separators (`EditorShell.tsx`)

2px gradient divider between left panel / main / right panel:

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

- Render only on **desktop** layout (`!isMobile && !isTablet`).
- Render only when adjacent panel is **not collapsed**.

**Verify:** Left panel looks dimmer than canvas; hovering T3 highlights T3 row; separators hidden on mobile drawers.

---

## Phase 5 — Consistency polish (optional, same PR or follow-up)

| Item | File | Change |
|------|------|--------|
| Canvas T1–T8 header row | `PianoRoll.tsx` | 6px track dot beside label (matches left panel) |
| Hold drag preview | `PianoRoll.tsx` | `trackColor(drag.start.track)` instead of `bg-primary/40` |
| Bottom bar selection | `EditorPage.tsx` | Already shows count — no change needed |

---

## Implementation order

```
Phase 0 + 1a  ✅ (shipped)
     ↓
Phase 1b      ← quick win, unblocks visual QA of track colors
     ↓
P1 multi-select
     ↓
Phase 2       ← selection rings + panel detail
     ↓
Phase 3       ← grid (needs track colors in place to judge contrast)
     ↓
Phase 4       ← sidebar polish
     ↓
Phase 5       ← optional
```

Do **not** implement Phase 2b multi-note UI before P1 — `MultiNoteDetail` is unreachable from canvas otherwise.

---

## Verification commands

```bash
# After any phase
pnpm --filter @ama-midi/shared build
cd apps/web && npx tsc --noEmit
cd apps/api && pnpm test
```

Visual checklist:

- [ ] All 8 tracks visually distinct on canvas
- [ ] Left panel track dot matches canvas note color per track
- [ ] QA view: boundary/neighbor rings still visible; selection adds white ring when no QA ring
- [ ] Shift-click multi-select highlights all selected notes
- [ ] Grid hierarchy readable at 1x and 4x zoom
- [ ] Sidebars darker than canvas bg; active track row pops on hover/select
- [ ] Mobile: no broken layout from separators

---

## Out of scope

- Section marker colors (unchanged)
- Difficulty heatmap styling
- Collaborator cursor colors
- `NOTE_PRESET_COLORS` on song list cards
- Rewriting historical `NoteEvent` JSON that may still contain `color` in old snapshots

---

## Design tokens reference

```
--color-editor-bg:      #13111E   (canvas — unchanged)
--color-editor-surface: #181628   (after Phase 4; was #1E1B2E)
--color-editor-border:  #2D2847
--color-grid-line:      rgba(255,255,255,0.05)   (after Phase 3)
--color-grid-line-bold: rgba(255,255,255,0.10)
--color-grid-line-bar:  rgba(255,255,255,0.18)
```

Track palette: see `TRACK_COLORS` in `packages/shared/src/colors.ts`.
