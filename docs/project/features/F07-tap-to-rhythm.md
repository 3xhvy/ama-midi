# F07 — Tap to Rhythm

← [README](../../../README.md) · [Feature List](../03-features.md)

*Spec:* [`2026-05-25-tap-to-rhythm-design.md`](../../superpowers/specs/2026-05-25-tap-to-rhythm-design.md) · *Plan:* [`2026-05-25-tap-to-rhythm.md`](../../superpowers/plans/2026-05-25-tap-to-rhythm.md)

---

## What This Feature Does

Composers record notes in real time while a looped section plays. Keys on the home row (`A S D F · J K L ;`) map to tracks 1–8. Short presses create TAP notes; holds ≥0.15s create HOLD notes. Notes accumulate as a local draft — nothing hits the server until the session ends.

After recording, the composer can:

- **Apply to chart** at exact recorded times or offset to a new anchor (with batch conflict review)
- **Save as pattern** for later paste from the Patterns panel
- **Discard** the session

---

## User Flow

1. **Tools panel → Tap to Rhythm** (or **?** for help)
2. **Setup modal** — loop start/end (number inputs or Shift+drag on time axis), then **Start fresh** or **Include existing notes in range**
3. **Playback loops** within the range; tap keys while playing
4. **End session** — red **TAP** badge or **Escape**
5. **Apply modal** — exact/offset placement, **Save as pattern**, or **Apply to chart**

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Home-row keymap (not 1–8)** | Digit keys `1/2/4` are zoom shortcuts |
| **Draft stays local until apply** | Same integrity model as AI ghosts — no partial writes mid-session |
| **Hide chart notes inside loop during session** | Start fresh = clean canvas; include existing = draft overlay only (no double render) |
| **Pattern save uses relative offsets** | Same `PatternNote` format as selection → Save pattern; paste via Patterns panel |
| **Full-chart conflict check on apply** | Not viewport-scoped — avoids missed 409s on off-screen notes |
| **`ConflictReviewModal` reuse** | Tap apply is another batch incoming-notes consumer |

---

## Architecture (Client-Only Session)

```
TapSetupModal → tapMode { loopRange, draftNotes } + loopRange in store
       │
       ▼
useTapInput (keydown/keyup) → addTapDraftNote (Zustand)
usePlayback (loop at loopRange.end)
TapModeOverlay (grid-locked preview, same layer as AiSuggestions)
       │
       ▼ session end
TapApplyModal → buildTapPlacementPreview → ConflictReviewModal? → createNote batch
              └→ SavePatternModal (draftTapNotesToPatternNotes)
```

No new API endpoints. Pattern save uses existing `POST /patterns`. Note apply uses existing `POST /charts/:id/notes`.

---

## File Map

| Path | Role |
|---|---|
| `features/editor/tap-keymap.ts` | `A S D F · J K L ;` → tracks 1–8 |
| `features/editor/tap-session.ts` | Default loop range, seed draft, pattern conversion |
| `features/editor/hooks/useTapInput.ts` | Key listeners, TAP/HOLD threshold, loop flush |
| `features/editor/components/TapSetupModal.tsx` | Range + seed mode before session |
| `features/editor/components/TapModeOverlay.tsx` | Draft + in-flight ghost notes |
| `features/editor/components/TapApplyModal.tsx` | Placement, save pattern, apply |
| `features/editor/components/TapModeHelpModal.tsx` | Instructions (? button) |
| `features/editor/engine/tap-placement-preview.ts` | Pure conflict preview builder |
| `store/editor.store.ts` | `loopRange`, `tapMode`, `addTapDraftNote` |

Agent skill: `.cursor/skills/braii/SKILL.md` (invoke `/braii` for maintenance context).

---

## Invariants

- Every applied note goes through normal note create + ledger + WebSocket broadcast
- Chart change mid-session cancels tap mode with toast
- Seeded “existing” draft notes may conflict on apply — resolved per slot like pattern paste

---

*→ See also: [Pattern library](../03-features.md#wave-2--composition-tools) (Phase 3 Wave 2), [Conflict Resolution](../03-features.md#conflict-resolution-cross-cutting)*
