---
name: braii
description: >-
  Tap-to-rhythm feature in ama-midi editor — loop range, ASDF/JKL; keymap,
  draft overlay, apply modal, conflict resolution. Use when the user invokes
  /braii, asks about tap mode, tap-to-rhythm, or changes to TapSetupModal,
  useTapInput, TapModeOverlay, or tap session flow.
---

# braii — Tap to Rhythm

## User flow

1. **Tools panel → Tap to Rhythm → ?** for help
2. **Setup modal** — set loop start/end (inputs or Pick on timeline → Shift+drag time axis)
- **Start fresh** — hides chart notes inside the loop window; only new taps appear as draft overlay
- **Include existing** — seeds draft from notes in range (dashed overlay); chart notes in range hidden to avoid duplicates
4. **Start session** — playback loops; tap **A S D F · J K L ;** (tracks 1–8)
5. **End** — TAP badge or Escape → apply modal (exact time or offset anchor)
6. **Conflicts** — `ConflictReviewModal` + batch create via `Promise.allSettled`

## Key map (not 1–8 — conflicts with zoom shortcuts)

| Track | Key |
|-------|-----|
| 1–4   | A S D F |
| 5–8   | J K L ; |

Source: `apps/web/src/features/editor/tap-keymap.ts`

## File map

| File | Role |
|------|------|
| `tap-keymap.ts` | Key → track mapping |
| `tap-session.ts` | Default loop range, `seedDraftFromNotes` |
| `hooks/useTapInput.ts` | keydown/keyup, TAP vs HOLD (≥0.15s), loop flush |
| `components/TapSetupModal.tsx` | Range + seed mode before session |
| `components/TapModeHelpModal.tsx` | Instructions (? button) |
| `components/TapModeOverlay.tsx` | Draft + in-flight preview (grid-locked like `AiSuggestions`) |
| `components/TapApplyModal.tsx` | Placement + conflicts |
| `engine/tap-placement-preview.ts` | Pure conflict preview builder |
| `store/editor.store.ts` | `loopRange`, `tapMode`, `addTapDraftNote` |

## Overlay positioning

Draft/ghost notes live **inside** the scrollable grid `div` (same as `AiSuggestions`, `NoteCircle`):

- Use `timeToY(time, pxPerSecond)` — **no** `scrollTop` subtraction
- TAP = 16×16 circle centered on lane (`cx - 8`, `y - 8`)
- HOLD = narrow bar (`tw/3` width), not full lane

## Invariants

- No server writes until apply
- Conflict check uses **full chart** notes (`useNotes(chartId)`), not viewport bucket
- Chart change mid-session → cancel tap mode + toast
- `j` jump shortcut disabled while tap session is playing (track 5 key)

## Tests

```bash
cd apps/web && pnpm test -- tap
```
