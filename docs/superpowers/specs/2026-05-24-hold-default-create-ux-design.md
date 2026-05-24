# Hold-Default Note Creation UX — Design Spec

**Date:** 2026-05-24  
**Status:** Approved (brainstorming)  
**Goal:** Remove the redundant **Create type** toggle, always create notes via the hold-first gesture model, and make the tap-vs-hold interaction discoverable through canvas affordances and copy.

---

## Success criteria

| Area | User-visible outcome |
|------|----------------------|
| Right panel | **Create type** toggle removed; static placement hint shown instead |
| Placement | Click (no drag) → Tap; drag down ≥4px → Hold with computed duration |
| Affordance | Ghost shows vertical stem; hold preview visible from mousedown; grid cursor is `ns-resize` |
| Copy | Empty chart and panel hint both say *"Click for tap · drag down for hold"* |
| Selection | **Selection → Type** toggle still converts selected notes between Tap/Hold |
| Popup mode | Click opens create popup with Hold pre-filled (no accidental tap from short drag) |

Manual smoke test: empty chart hover ghost, click tap, drag hold, popup mode click, convert selected note type, read-only chart.

---

## Locked product decisions

1. **No Create type toggle.** Hold is the only creation mode on the canvas; Tap notes are created by clicking without dragging.
2. **Keep 4px drag threshold** (`HOLD_DRAG_THRESHOLD_PX`) — unchanged from `@ama-midi/shared`.
3. **Keep Create mode** (Fast / Popup) toggle in the right panel.
4. **Fast mode:** mousedown/drag placement only — no grid-click fast-create path.
5. **Popup mode:** click opens `NotePopup` in create mode; mousedown does not start drag placement.
6. **Out of scope:** coach marks, changing default hold duration, bottom-bar hints, keyboard modifiers for Tap.

---

## Panel changes (`EditorPage.tsx`)

### Remove

- **Create type** `ToolRow` and its `ToggleGroup` (`TYPE_MODES` for creation).
- `activeNoteType` / `setActiveNoteType` usage in `ToolsTab` (keep `TYPE_MODES` for **Selection → Type** only).

### Add

Replace removed row with a non-interactive hint (when `canEdit`):

```
Place notes: click for tap · drag down for hold
```

Style: existing `ToolRow` layout, `text-xs text-shell-muted`, no toggle.

### Unchanged

- View, Zoom, Snap toggles
- **Create mode** (Fast / Popup)
- **Selection → Type** toggle for bulk/single note conversion
- Difficulty heatmap toggle

---

## Canvas affordances

### Ghost preview (`GhostCircle.tsx`)

- Keep 16×16 circle at snap position (track-colored border/fill).
- Add **faint vertical stem** (~12px) centered below the circle, same track color at ~25% opacity.
- `pointer-events-none`; no interaction change.

### Mousedown preview (`PianoRoll.tsx`)

- Show hold drag preview bar **immediately on mousedown** (minimum height = `HOLD_DRAG_THRESHOLD_PX`), not only after crossing threshold.
- Preview grows with vertical drag (existing behavior).
- Preview color: prefer `trackColor(track)` over generic `bg-primary/40` for consistency with track identity work.

### Cursor

- Grid area when `canEdit`: `cursor: ns-resize`.
- Notes and chrome: unchanged (pointer on notes).

### Empty state copy (`PianoRoll.tsx`)

Replace *"Click anywhere to place your first note"* with:

> Click for tap · drag down for hold

---

## Interaction model (`PianoRoll.tsx`)

### Fast mode (default `createMode: 'fast'`)

| Gesture | Result |
|---------|--------|
| Mousedown + mouseup, vertical movement < 4px | Create **Tap** at snapped track/time |
| Mousedown + drag down ≥ 4px + mouseup | Create **Hold** with `duration = max(0.1, dragPx / pxPerSecond)` |
| Shift + drag | Box selection (unchanged) |

- `handleMouseDown`: always start drag placement when `createMode === 'fast'` (remove `activeNoteType !== 'HOLD'` guard).
- `handleGridClick`: remove note-creation logic for fast mode (creation is exclusively mousedown/drag). Keep shift-key early return.

### Popup mode (`createMode: 'popup'`)

| Gesture | Result |
|---------|--------|
| Click (grid) | Open `NotePopup` create mode at ghost track/time; `noteType` defaults to Hold in popup |
| Mousedown drag | **Disabled** — do not start drag placement |

- `handleMouseDown`: skip drag start when `createMode === 'popup'`.
- `handleGridClick`: open create popup (remove `activeNoteType === 'HOLD'` early return that currently blocks popup when Hold is selected).

---

## State cleanup (`editor.store.ts`)

- Keep `activeNoteType: 'HOLD'` as default (or remove field entirely if no runtime reads remain).
- Remove `setActiveNoteType` if nothing calls it after UI removal.
- If `activeNoteType` is removed, delete guards in `PianoRoll` that branch on it; creation behavior is driven by `createMode` + gesture only.

**Selection panel** continues to use selected note's `noteType` for the Type toggle — no store field needed for creation.

---

## Files to touch

| File | Change |
|------|--------|
| `apps/web/src/pages/EditorPage.tsx` | Remove Create type; add placement hint |
| `apps/web/src/features/editor/components/GhostCircle.tsx` | Vertical stem affordance |
| `apps/web/src/features/editor/components/PianoRoll.tsx` | Min preview, cursor, copy, interaction split by createMode, remove activeNoteType guards |
| `apps/web/src/store/editor.store.ts` | Optional: remove `activeNoteType` / `setActiveNoteType` |

---

## Verification

```bash
cd apps/web && npx tsc --noEmit
pnpm --filter web test   # if any editor tests exist
```

Checklist:

- [ ] Create type row gone; hint visible when chart is editable
- [ ] Hover ghost shows circle + stem
- [ ] Fast mode: click → Tap; drag → Hold
- [ ] Fast mode: preview bar visible from mousedown
- [ ] Grid cursor is `ns-resize` when editing
- [ ] Popup mode: click opens popup; drag does not create notes
- [ ] Selection Type toggle still converts notes
- [ ] Read-only chart: no placement affordances broken

---

## Out of scope

- First-time onboarding / coach marks
- Changing `HOLD_DRAG_THRESHOLD_PX` or minimum hold duration
- Bottom bar placement hint
- Swipe note creation from canvas (unchanged — not in Create type toggle today)
