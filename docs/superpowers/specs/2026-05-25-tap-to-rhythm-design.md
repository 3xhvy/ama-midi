# Tap-to-Rhythm Feature Design

**Date:** 2026-05-25  
**Status:** Approved  
**Approach:** Hook-based tap session with draft → apply → conflict pipeline

---

## Overview

Composer sets a loop range on the timeline, enters tap mode, and taps keys 1–8 (one per track) in real time while the song loops. Notes accumulate as a local draft. When done, composer applies the draft to the chart at the exact recorded time or a new anchor time. Conflicts with existing notes are resolved via the existing `ConflictReviewModal`.

---

## 1. Loop Range

### State (editor.store)
```ts
loopRange: { start: number; end: number } | null
setLoopRange: (range: { start: number; end: number } | null) => void
```

### Playback (usePlayback)
- Tick function: if `loopRange` is set and `next >= loopRange.end` → reset `playheadTime` to `loopRange.start` (loop) instead of advancing.
- If no loop range: behavior unchanged.

### UI
- Drag handles on `TimeAxis` to set loop start/end.
- Visual highlight band between handles on the time axis.

---

## 2. Tap Session State

```ts
interface DraftTapNote {
  track: number          // 1–8
  time: number           // snapped start time (seconds)
  duration?: number      // set for HOLD notes only
}

interface TapModeState {
  active: boolean
  loopRange: { start: number; end: number }  // locked at session start
  draftNotes: DraftTapNote[]
}
```

Added to `editor.store`:
```ts
tapMode: TapModeState | null
setTapMode: (state: TapModeState | null) => void
addTapDraftNote: (note: DraftTapNote) => void
```

`inFlight` key tracking (`Map<track, { startTime: number }>`) lives in `useRef` inside `useTapInput` — not store state, no re-renders on keydown.

### Activation Flow
1. User sets loop range on TimeAxis.
2. Clicks "Tap Mode" in Toolbar → `tapMode` initialized with locked loop range.
3. Playback starts (auto or manual).
4. Keys 1–8 → notes accumulate in `draftNotes`.
5. "Done" button or `Escape` → session ends → apply modal opens.

---

## 3. Key Input & Note Creation

`useTapInput` hook — attaches `keydown`/`keyup` to `window` only when `tapMode.active && isPlaying`.

**keydown:**
```
track = parseInt(e.key)      // 1–8 only; else skip
if e.repeat → skip           // browser key-repeat
if inFlight.has(track) → skip
startTime = snapTime(playheadTime, snapMode, bpm)
inFlight.set(track, { startTime })
→ emit: track lane flash + start growing ghost note
```

**keyup:**
```
track = parseInt(e.key)
entry = inFlight.get(track)  // if missing, skip
endTime = snapTime(playheadTime, snapMode, bpm)
duration = endTime - entry.startTime
noteType = duration < 0.15s ? 'TAP' : 'HOLD'
addTapDraftNote({ track, time: entry.startTime, duration: noteType === 'HOLD' ? duration : undefined })
inFlight.delete(track)
→ emit: ghost note finalizes
```

**No server calls during tapping.** All notes stay local until apply.

**Loop boundary edge case:** when playhead resets to `loopRange.start`, all in-flight keys are force-closed at `loopRange.end`.

---

## 4. Visual Feedback

| Element | Behavior |
|---|---|
| Track lane flash | `keydown` → brief pulse animation on track lane column (~150ms, local component state) |
| Growing ghost note | While key held: renders at `(track, startTime)`, height = `(playheadTime - startTime) * pxPerSecond`. Same layer as AI suggestions. |
| Draft notes | Finalized (not yet applied): semi-transparent, ~50% opacity, dashed border. Distinct from AI ghost notes. |
| TAP badge | `TransportBar` shows pulsing red "TAP" badge when `tapMode.active`. Click or `Escape` to end session. |

---

## 5. Apply Modal & Conflict Resolution

Opens after session ends.

### Placement Options

**Exact time** — draft note timestamps used as-is. No offset.

**Other time** — user picks new anchor (input field or click on TimeAxis).  
`offset = newAnchor - tapSession.loopRange.start`  
All draft note times shift by `offset`. Notes beyond `TIME_MAX` are clipped + warned.

### Conflict Detection
Runs before any server call:
```ts
conflicts = draftNotes.filter(draft =>
  existingNotes.some(n =>
    n.track === draft.track &&
    n.time === snapTime(draft.time + offset, snapMode, bpm)
  )
)
```

- No conflicts → batch POST immediately.
- Conflicts exist → open `ConflictReviewModal` (reuse existing component).
  - Per conflict: keep existing / overwrite with tap / skip tap note.

### Batch POST
After conflict resolution: call existing `createNote` mutation per confirmed note.  
Ledger writes happen automatically. WebSocket broadcasts to collaborators.

**Success:** `tapMode` cleared, toast "X notes applied".

---

## 6. Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Playback stops mid-session | In-flight keys force-closed at current time. Draft preserved. Apply modal opens. |
| No notes tapped | Skip apply modal. Toast "No notes recorded". Clear tap mode. |
| 409 on batch POST (race with collaborator) | Skip that note, continue batch. Toast "X applied, Y skipped (conflict)". |
| "Other time" offset exceeds `TIME_MAX` | Clip notes, warn "N notes truncated — exceeded song length". |
| Chart changed mid-session | Force-end session, discard draft, toast "Tap session cancelled — chart changed". |
| Undo | Each applied note has its own `NoteEvent` in ledger. Undo works per-note via existing undo system. No special batch-undo. |

---

## 7. New Files

| File | Purpose |
|---|---|
| `features/editor/hooks/useTapInput.ts` | keydown/keyup listener, in-flight tracking, draft note creation |
| `features/editor/components/TapModeOverlay.tsx` | Growing ghost notes + finalized draft note rendering |
| `features/editor/components/TapApplyModal.tsx` | Placement picker (exact / other time) + offset input |

## 8. Modified Files

| File | Change |
|---|---|
| `store/editor.store.ts` | Add `tapMode`, `loopRange` state + actions |
| `features/editor/hooks/usePlayback.ts` | Loop range support in tick function |
| `features/editor/components/TimeAxis.tsx` | Loop range drag handles + highlight band |
| `features/editor/components/TransportBar.tsx` | TAP badge, Tap Mode button |
| `features/editor/components/Toolbar.tsx` | Tap Mode activation button |
| `features/editor/components/PianoRoll.tsx` | Mount `TapModeOverlay` |

---

## 9. What Is NOT Changing

- Note creation API, ledger, WebSocket broadcast — untouched.
- `ConflictReviewModal` — reused as-is.
- `snapTime` — reused as-is.
- Duplicate guard (P2002 → 409) — still the source of truth.
- Undo system — no changes needed.
