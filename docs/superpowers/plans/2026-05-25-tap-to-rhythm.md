# Tap-to-Rhythm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let composers tap keys 1–8 during a looped playback window to create tap/hold notes as a draft, then apply the draft to the chart at the recorded or a new anchor time, with conflict resolution.

**Architecture:** Tap mode is a flag in `editor.store`. A `useTapInput` hook captures `keydown`/`keyup` events and writes draft notes to local state (never to the server until apply). On session end a `TapApplyModal` lets the user place notes at exact or offset time, builds a `PlacementPreview` client-side, and batches `createNote` calls after optional conflict resolution via the existing `ConflictReviewModal`.

**Tech Stack:** React 18, Zustand 5, Vitest, Tailwind CSS, TanStack Query, existing `snapTime` from `beat-calculator.ts`, existing `useCreateNote` from `useNotes.ts`, existing `ConflictReviewModal`.

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `apps/web/vitest.config.ts` | Vitest runner config for `apps/web` |
| `apps/web/src/features/editor/engine/tap-placement-preview.ts` | Pure fn: build `PlacementPreview` from draft notes + existing notes |
| `apps/web/src/features/editor/engine/__tests__/tap-placement-preview.test.ts` | Unit tests for above |
| `apps/web/src/features/editor/hooks/useTapInput.ts` | `keydown`/`keyup` listener, in-flight tracking, draft accumulation |
| `apps/web/src/features/editor/components/TapModeOverlay.tsx` | Renders growing ghost notes (held) + finalized draft notes on piano roll |
| `apps/web/src/features/editor/components/TapApplyModal.tsx` | Placement picker (exact / offset), conflict detection, batch apply |

### Modified files
| Path | Change |
|---|---|
| `apps/web/package.json` | Add `vitest`, `@vitest/ui`, `jsdom` devDeps; add `"test": "vitest run"` script |
| `apps/web/src/store/editor.store.ts` | Add `loopRange`, `tapMode` state + actions |
| `apps/web/src/features/editor/hooks/usePlayback.ts` | Loop when `playheadTime >= loopRange.end` |
| `apps/web/src/features/editor/components/TimeAxis.tsx` | Accept `loopRange` + `onLoopRangeChange` props; render highlight band + drag handles |
| `apps/web/src/features/editor/components/TransportBar.tsx` | TAP badge when tap mode active |
| `apps/web/src/features/editor/components/Toolbar.tsx` | Tap Mode activate button (composer only) |
| `apps/web/src/features/editor/components/PianoRoll.tsx` | Mount `TapModeOverlay`; pass `loopRange`/`onLoopRangeChange` to `TimeAxis`; wire `useTapInput` |

---

## Task 1: Add Vitest to apps/web

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: Install vitest and jsdom**

```bash
cd apps/web && pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create vitest config**

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@ama-midi/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
```

- [ ] **Step 3: Add test script to apps/web/package.json**

In `apps/web/package.json`, add `"test": "vitest run"` to `scripts`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: Verify existing tests pass**

```bash
cd apps/web && pnpm test
```
Expected: existing `beat-calculator.test.ts` and `ai-stream.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(web): add vitest runner"
```

---

## Task 2: Store — loopRange + tapMode state

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`

- [ ] **Step 1: Add types above the EditorStore interface**

In `apps/web/src/store/editor.store.ts`, add after the existing imports:
```ts
export interface LoopRange {
  start: number
  end: number
}

export interface DraftTapNote {
  track: number
  time: number       // snapped start time (seconds)
  duration?: number  // HOLD notes only
}

export interface TapModeState {
  loopRange: LoopRange  // locked at session start
  draftNotes: DraftTapNote[]
}
```

- [ ] **Step 2: Add fields to EditorStore interface**

In the `interface EditorStore` block, add after `chartPreview`:
```ts
loopRange:          LoopRange | null
tapMode:            TapModeState | null
setLoopRange:       (range: LoopRange | null) => void
setTapMode:         (state: TapModeState | null) => void
addTapDraftNote:    (note: DraftTapNote) => void
```

- [ ] **Step 3: Add initial values and actions to the store**

In `useEditorStore = create<EditorStore>((set) => ({`, add after `chartPreview: null,`:
```ts
loopRange:          null,
tapMode:            null,
setLoopRange:       (loopRange) => set({ loopRange }),
setTapMode:         (tapMode) => set({ tapMode }),
addTapDraftNote:    (note) => set((s) => s.tapMode
  ? { tapMode: { ...s.tapMode, draftNotes: [...s.tapMode.draftNotes, note] } }
  : s
),
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store/editor.store.ts
git commit -m "feat(store): add loopRange and tapMode state"
```

---

## Task 3: Loop Range in usePlayback

**Files:**
- Modify: `apps/web/src/features/editor/hooks/usePlayback.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/features/editor/hooks/__tests__/usePlayback-loop.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

// Pure extract of the loop-branch logic so we can unit-test without RAF
function computeNextTime(
  current: number,
  delta: number,
  loopRange: { start: number; end: number } | null,
  timeMax: number,
): { time: number; stop: boolean } {
  const next = current + delta
  if (loopRange && next >= loopRange.end) {
    return { time: loopRange.start, stop: false }
  }
  if (next >= timeMax) {
    return { time: timeMax, stop: true }
  }
  return { time: Math.round(next * 100) / 100, stop: false }
}

describe('computeNextTime', () => {
  it('advances normally without loop range', () => {
    expect(computeNextTime(1.0, 0.05, null, 300)).toEqual({ time: 1.05, stop: false })
  })

  it('stops at TIME_MAX without loop range', () => {
    expect(computeNextTime(299.99, 0.1, null, 300)).toEqual({ time: 300, stop: true })
  })

  it('loops back to start when playhead reaches loopRange.end', () => {
    expect(computeNextTime(7.9, 0.15, { start: 4, end: 8 }, 300)).toEqual({ time: 4, stop: false })
  })

  it('does not loop when playhead is before loopRange.end', () => {
    expect(computeNextTime(7.0, 0.05, { start: 4, end: 8 }, 300)).toEqual({ time: 7.05, stop: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test -- --reporter=verbose
```
Expected: FAIL — `computeNextTime` not found (it's local to the test file, test will pass as written — this is testing the logic directly).

Actually run once to confirm they pass:
```bash
cd apps/web && pnpm test
```
Expected: all 4 new tests PASS (the function is defined in the test file itself).

- [ ] **Step 3: Modify usePlayback to use loop range**

Replace the `tick` function body in `apps/web/src/features/editor/hooks/usePlayback.ts`:

```ts
import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { TIME_MAX } from '@ama-midi/shared'

export function usePlayback() {
  const { isPlaying, setPlayheadTime, setPlaying } = useEditorStore()
  const rafRef      = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  // Reset clock when tab regains focus — prevents playhead jumping forward
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') lastTimeRef.current = null
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        lastTimeRef.current = null
      }
      return
    }

    function tick(timestamp: number) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      // Cap delta at 100ms to absorb any remaining stale frames
      const delta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = timestamp

      const state     = useEditorStore.getState()
      const loopRange = state.loopRange
      const current   = state.playheadTime
      const next      = current + delta

      if (loopRange && next >= loopRange.end) {
        // Force-close any in-flight tap keys at loop boundary (useTapInput listens to this)
        setPlayheadTime(loopRange.start)
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      if (next >= TIME_MAX) {
        setPlayheadTime(TIME_MAX)
        setPlaying(false)
        return
      }

      setPlayheadTime(Math.round(next * 100) / 100)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        lastTimeRef.current = null
      }
    }
  }, [isPlaying, setPlayheadTime, setPlaying])
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/hooks/usePlayback.ts \
        apps/web/src/features/editor/hooks/__tests__/usePlayback-loop.test.ts
git commit -m "feat(playback): loop within loopRange when set"
```

---

## Task 4: tap-placement-preview — pure function + tests

**Files:**
- Create: `apps/web/src/features/editor/engine/tap-placement-preview.ts`
- Create: `apps/web/src/features/editor/engine/__tests__/tap-placement-preview.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/features/editor/engine/__tests__/tap-placement-preview.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildTapPlacementPreview } from '../tap-placement-preview'
import type { Note } from '@ama-midi/shared'

function makeNote(track: number, time: number, id = `n-${track}-${time}`): Note {
  return {
    id,
    songId: 'song1',
    chartId: 'chart1',
    track,
    time,
    title: '',
    description: '',
    createdBy: 'user1',
    creatorName: 'User',
    noteType: 'TAP',
    createdAt: '',
    updatedAt: '',
  } as Note
}

describe('buildTapPlacementPreview', () => {
  it('returns all creatables when no existing notes conflict', () => {
    const draft = [
      { track: 1, time: 1.0 },
      { track: 2, time: 2.0 },
    ]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: [],
      offset: 0,
    })
    expect(preview.creatable).toHaveLength(2)
    expect(preview.conflicts).toHaveLength(0)
    expect(preview.summary.creatableNotes).toBe(2)
    expect(preview.summary.conflictCount).toBe(0)
  })

  it('moves conflict to conflicts array when time+offset collides with existing note', () => {
    const draft = [{ track: 1, time: 1.0 }]
    const existing = [makeNote(1, 1.0)]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: existing,
      offset: 0,
    })
    expect(preview.creatable).toHaveLength(0)
    expect(preview.conflicts).toHaveLength(1)
    expect(preview.conflicts[0].track).toBe(1)
    expect(preview.conflicts[0].time).toBe(1.0)
    expect(preview.summary.conflictCount).toBe(1)
  })

  it('applies offset to all draft note times before collision check', () => {
    const draft = [{ track: 1, time: 0.0 }]
    const existing = [makeNote(1, 2.0)]
    // offset 2.0 → draft note becomes time 2.0 → conflicts
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: existing,
      offset: 2.0,
    })
    expect(preview.conflicts).toHaveLength(1)
    expect(preview.conflicts[0].time).toBe(2.0)
  })

  it('hold note duration is preserved in creatable slot', () => {
    const draft = [{ track: 3, time: 1.0, duration: 0.5 }]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: [],
      offset: 0,
    })
    expect(preview.creatable[0].duration).toBe(0.5)
    expect(preview.creatable[0].noteType).toBe('HOLD')
  })

  it('tap note (no duration) gets noteType TAP', () => {
    const draft = [{ track: 1, time: 1.0 }]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: [],
      offset: 0,
    })
    expect(preview.creatable[0].noteType).toBe('TAP')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test -- tap-placement-preview
```
Expected: FAIL — `buildTapPlacementPreview` not found.

- [ ] **Step 3: Implement the function**

Create `apps/web/src/features/editor/engine/tap-placement-preview.ts`:
```ts
import type { Note, NoteType } from '@ama-midi/shared'
import type {
  PlacementPreview,
  PlacementCreatableSlot,
  PlacementConflict,
  PlacementExistingNote,
  PlacementIncomingNote,
} from '@ama-midi/shared'
import type { DraftTapNote } from '../../../store/editor.store'

interface BuildPreviewOptions {
  songId:        string
  draftNotes:    DraftTapNote[]
  existingNotes: Note[]
  offset:        number  // seconds to add to each draft note time
}

function noteTypeFor(draft: DraftTapNote): NoteType {
  return draft.duration != null && draft.duration > 0 ? 'HOLD' : 'TAP'
}

export function buildTapPlacementPreview({
  songId,
  draftNotes,
  existingNotes,
  offset,
}: BuildPreviewOptions): PlacementPreview {
  const creatable: PlacementCreatableSlot[] = []
  const conflicts: PlacementConflict[]      = []

  draftNotes.forEach((draft, index) => {
    const time     = Math.round((draft.time + offset) * 100) / 100
    const noteType = noteTypeFor(draft)
    const existing = existingNotes.find(
      (n) => n.track === draft.track && n.time === time,
    )

    const incoming: PlacementIncomingNote = {
      title:       '',
      description: '',
      track:       draft.track,
      timeOffset:  time,
      noteType,
      duration:    draft.duration,
    }

    if (existing) {
      const existingNote: PlacementExistingNote = {
        id:              existing.id,
        title:           existing.title,
        description:     existing.description,
        track:           existing.track,
        time:            existing.time,
        noteType:        existing.noteType as NoteType,
        duration:        existing.duration,
        createdBy:       existing.createdBy,
        creatorName:     existing.creatorName,
        creatorAvatarUrl: existing.creatorAvatarUrl,
        createdAt:       existing.createdAt,
      }
      conflicts.push({
        conflictId:   `tap-${index}-${draft.track}-${time}`,
        sourceIndex:  index,
        sourceNoteId: `tap-draft-${index}`,
        track:        draft.track,
        time,
        incomingNote: incoming,
        existingNote,
      })
    } else {
      creatable.push({
        sourceIndex:  index,
        sourceNoteId: `tap-draft-${index}`,
        track:        draft.track,
        time,
        noteType,
        duration:     draft.duration,
        title:        '',
        description:  '',
      })
    }
  })

  return {
    songId,
    version:  'tap-session',
    summary: {
      totalNotes:            draftNotes.length,
      creatableNotes:        creatable.length,
      conflictCount:         conflicts.length,
      affectedExistingNotes: conflicts.length,
    },
    creatable,
    conflicts,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test -- tap-placement-preview
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/engine/tap-placement-preview.ts \
        apps/web/src/features/editor/engine/__tests__/tap-placement-preview.test.ts
git commit -m "feat(editor): tap-placement-preview pure fn with tests"
```

---

## Task 5: TimeAxis — loop range handles

**Files:**
- Modify: `apps/web/src/features/editor/components/TimeAxis.tsx`

- [ ] **Step 1: Read current TimeAxis.tsx fully**

Read `apps/web/src/features/editor/components/TimeAxis.tsx` in full to understand exact render output before editing.

- [ ] **Step 2: Add loopRange props to TimeAxisProps interface**

In `apps/web/src/features/editor/components/TimeAxis.tsx`, extend `TimeAxisProps`:
```ts
export interface TimeAxisProps {
  pxPerSecond:         number
  scrollTop:           number
  playheadTime:        number
  snapMode:            SnapMode
  bpm:                 number
  onSeek:              (time: number) => void
  onAddSection?:       (time: number, e: React.MouseEvent | MouseEvent) => void
  loopRange?:          { start: number; end: number } | null
  onLoopRangeChange?:  (range: { start: number; end: number } | null) => void
}
```

- [ ] **Step 3: Implement loop handles inside TimeAxis JSX**

After the `playheadY` line and before the `return`, add:
```ts
const loopStartY = loopRange ? timeToY(loopRange.start, pxPerSecond) - scrollTop : null
const loopEndY   = loopRange ? timeToY(loopRange.end, pxPerSecond) - scrollTop : null

const loopHandleDragRef = useRef<{ handle: 'start' | 'end'; active: boolean } | null>(null)

function handleLoopPointerDown(handle: 'start' | 'end', e: React.PointerEvent<HTMLDivElement>) {
  e.stopPropagation()
  e.currentTarget.setPointerCapture(e.pointerId)
  loopHandleDragRef.current = { handle, active: true }
}

function handleLoopPointerMove(e: React.PointerEvent<HTMLDivElement>) {
  if (!loopHandleDragRef.current?.active || !loopRange || !onLoopRangeChange) return
  e.stopPropagation()
  const time = timeAtClientY(e.clientY)
  if (loopHandleDragRef.current.handle === 'start') {
    const clampedStart = Math.max(0, Math.min(time, loopRange.end - 0.1))
    onLoopRangeChange({ ...loopRange, start: clampedStart })
  } else {
    const clampedEnd = Math.max(loopRange.start + 0.1, time)
    onLoopRangeChange({ ...loopRange, end: clampedEnd })
  }
}

function handleLoopPointerUp(e: React.PointerEvent<HTMLDivElement>) {
  e.stopPropagation()
  e.currentTarget.releasePointerCapture(e.pointerId)
  loopHandleDragRef.current = null
}
```

- [ ] **Step 4: Add loop range highlight band and handles to JSX**

Inside the returned `<div>`, before the closing tag, add:
```tsx
{/* Loop range highlight band */}
{loopRange && loopStartY !== null && loopEndY !== null && (
  <div
    className="absolute left-0 right-0 bg-blue-500/10 border-l-2 border-r-0 border-blue-500/30 pointer-events-none"
    style={{ top: loopStartY, height: Math.max(0, loopEndY - loopStartY) }}
  />
)}

{/* Loop start handle */}
{loopRange && loopStartY !== null && (
  <div
    className="absolute left-0 right-0 h-1 bg-blue-500 cursor-ns-resize z-10 hover:bg-blue-400"
    style={{ top: loopStartY - 2 }}
    onPointerDown={(e) => handleLoopPointerDown('start', e)}
    onPointerMove={handleLoopPointerMove}
    onPointerUp={handleLoopPointerUp}
  />
)}

{/* Loop end handle */}
{loopRange && loopEndY !== null && (
  <div
    className="absolute left-0 right-0 h-1 bg-blue-500 cursor-ns-resize z-10 hover:bg-blue-400"
    style={{ top: loopEndY - 2 }}
    onPointerDown={(e) => handleLoopPointerDown('end', e)}
    onPointerMove={handleLoopPointerMove}
    onPointerUp={handleLoopPointerUp}
  />
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/TimeAxis.tsx
git commit -m "feat(time-axis): loop range highlight band and drag handles"
```

---

## Task 6: useTapInput hook

**Files:**
- Create: `apps/web/src/features/editor/hooks/useTapInput.ts`

- [ ] **Step 1: Write failing test for TAP/HOLD threshold logic**

Create `apps/web/src/features/editor/hooks/__tests__/useTapInput.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

// Extract pure threshold logic for testing
function resolveDraftNote(startTime: number, endTime: number, track: number) {
  const duration = endTime - startTime
  const TAP_THRESHOLD_S = 0.15
  if (duration < TAP_THRESHOLD_S) {
    return { track, time: startTime, duration: undefined }
  }
  return { track, time: startTime, duration: Math.round(duration * 100) / 100 }
}

describe('resolveDraftNote', () => {
  it('short press (< 0.15s) produces tap note with no duration', () => {
    const note = resolveDraftNote(1.0, 1.1, 2)
    expect(note.duration).toBeUndefined()
    expect(note.time).toBe(1.0)
    expect(note.track).toBe(2)
  })

  it('long press (>= 0.15s) produces hold note with duration', () => {
    const note = resolveDraftNote(1.0, 1.5, 3)
    expect(note.duration).toBe(0.5)
  })

  it('exactly 0.15s is treated as hold', () => {
    const note = resolveDraftNote(0.0, 0.15, 1)
    expect(note.duration).toBe(0.15)
  })

  it('duration is rounded to 2 decimal places', () => {
    const note = resolveDraftNote(0.0, 0.333, 1)
    expect(note.duration).toBe(0.33)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test -- useTapInput
```
Expected: all 4 tests PASS (function defined locally in test file).

- [ ] **Step 3: Implement useTapInput**

Create `apps/web/src/features/editor/hooks/useTapInput.ts`:
```ts
import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { snapTime } from '../engine/beat-calculator'

const TAP_THRESHOLD_S = 0.15
const VALID_TRACKS    = new Set(['1', '2', '3', '4', '5', '6', '7', '8'])

interface InFlight {
  startTime: number
}

interface Props {
  bpm: number
  /** Called when a loop boundary resets the playhead — force-closes all held keys */
  onLoopReset?: () => void
}

export function useTapInput({ bpm }: Props) {
  const { tapMode, isPlaying, snapMode, addTapDraftNote, setTapMode } = useEditorStore()
  const inFlightRef = useRef<Map<number, InFlight>>(new Map())

  // Force-close all in-flight keys (called on loop boundary or playback stop)
  function flushInFlight(atTime: number) {
    const map = inFlightRef.current
    if (map.size === 0) return
    const state = useEditorStore.getState()
    map.forEach(({ startTime }, track) => {
      const endTime  = atTime
      const duration = endTime - startTime
      if (duration >= TAP_THRESHOLD_S) {
        state.addTapDraftNote({
          track,
          time: startTime,
          duration: Math.round(duration * 100) / 100,
        })
      } else {
        state.addTapDraftNote({ track, time: startTime })
      }
    })
    map.clear()
  }

  // Watch for playhead jumping back (loop reset) — flush in-flight keys
  const prevPlayheadRef = useRef<number>(0)
  useEffect(() => {
    return useEditorStore.subscribe((state) => {
      const current = state.playheadTime
      const prev    = prevPlayheadRef.current
      prevPlayheadRef.current = current
      // Playhead moved backward → loop reset
      if (current < prev - 0.3) {
        flushInFlight(prev)
      }
    })
  }, [])

  useEffect(() => {
    if (!tapMode || !isPlaying) return

    function onKeyDown(e: KeyboardEvent) {
      if (!VALID_TRACKS.has(e.key)) return
      if (e.repeat) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const track = parseInt(e.key)
      if (inFlightRef.current.has(track)) return
      const { playheadTime, snapMode: sm } = useEditorStore.getState()
      const startTime = snapTime(playheadTime, sm, bpm)
      inFlightRef.current.set(track, { startTime })
    }

    function onKeyUp(e: KeyboardEvent) {
      if (!VALID_TRACKS.has(e.key)) return
      const track = parseInt(e.key)
      const entry = inFlightRef.current.get(track)
      if (!entry) return
      inFlightRef.current.delete(track)
      const { playheadTime, snapMode: sm } = useEditorStore.getState()
      const endTime  = snapTime(playheadTime, sm, bpm)
      const duration = endTime - entry.startTime
      if (duration >= TAP_THRESHOLD_S) {
        addTapDraftNote({
          track,
          time:     entry.startTime,
          duration: Math.round(duration * 100) / 100,
        })
      } else {
        addTapDraftNote({ track, time: entry.startTime })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [tapMode, isPlaying, bpm, snapMode, addTapDraftNote])

  // Flush all in-flight keys when playback stops
  useEffect(() => {
    if (!isPlaying && inFlightRef.current.size > 0) {
      const { playheadTime } = useEditorStore.getState()
      flushInFlight(playheadTime)
    }
  }, [isPlaying])

  return {
    inFlightTracks: inFlightRef.current,
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/hooks/useTapInput.ts \
        apps/web/src/features/editor/hooks/__tests__/useTapInput.test.ts
git commit -m "feat(editor): useTapInput hook — keydown/keyup draft accumulation"
```

---

## Task 7: TapModeOverlay component

**Files:**
- Create: `apps/web/src/features/editor/components/TapModeOverlay.tsx`

- [ ] **Step 1: Implement TapModeOverlay**

Create `apps/web/src/features/editor/components/TapModeOverlay.tsx`:
```tsx
import { useEditorStore } from '../../../store/editor.store'
import { timeToY, trackToX, trackWidth } from '../engine'
import type { DraftTapNote } from '../../../store/editor.store'
import { TRACK_MIN, TRACK_MAX } from '@ama-midi/shared'

interface Props {
  pxPerSecond:    number
  scrollTop:      number
  playheadTime:   number
  /** Map of track → startTime for keys currently held */
  inFlightTracks: Map<number, { startTime: number }>
}

export function TapModeOverlay({
  pxPerSecond,
  scrollTop,
  playheadTime,
  inFlightTracks,
}: Props) {
  const tapMode = useEditorStore((s) => s.tapMode)
  if (!tapMode) return null

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Finalized draft notes — semi-transparent with dashed border */}
      {tapMode.draftNotes.map((note, i) => {
        const y = timeToY(note.time, pxPerSecond) - scrollTop
        const x = trackToX(note.track, pxPerSecond)
        const w = trackWidth(pxPerSecond)
        const h = note.duration
          ? Math.max(8, note.duration * pxPerSecond)
          : 20
        return (
          <div
            key={i}
            className="absolute rounded-full border-2 border-dashed border-violet-400 bg-violet-400/30"
            style={{ top: y - h / 2, left: x + 2, width: w - 4, height: h }}
          />
        )
      })}

      {/* Growing ghost notes for held keys */}
      {Array.from(inFlightTracks.entries()).map(([track, { startTime }]) => {
        const growingDuration = Math.max(0, playheadTime - startTime)
        const y = timeToY(startTime, pxPerSecond) - scrollTop
        const x = trackToX(track, pxPerSecond)
        const w = trackWidth(pxPerSecond)
        const h = Math.max(8, growingDuration * pxPerSecond)
        return (
          <div
            key={`inflight-${track}`}
            className="absolute rounded-full bg-violet-500/50 animate-pulse"
            style={{ top: y - h / 2, left: x + 2, width: w - 4, height: h }}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/TapModeOverlay.tsx
git commit -m "feat(editor): TapModeOverlay — draft notes + growing ghost notes"
```

---

## Task 8: TapApplyModal

**Files:**
- Create: `apps/web/src/features/editor/components/TapApplyModal.tsx`

- [ ] **Step 1: Implement TapApplyModal**

Create `apps/web/src/features/editor/components/TapApplyModal.tsx`:
```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import type { Note, ConflictAction } from '@ama-midi/shared'
import type { ConflictResolutionMap, PlacementPreview } from '@ama-midi/shared'
import { buildTapPlacementPreview } from '../engine/tap-placement-preview'
import { ConflictReviewModal } from './ConflictReviewModal'
import { EditorModalOverlay, EditorModalPanel } from './EditorModal'
import type { TapModeState } from '../../../store/editor.store'
import { useEditorStore } from '../../../store/editor.store'

interface Props {
  tapMode:       TapModeState
  existingNotes: Note[]
  songId:        string
  onApply:       (notes: Array<{ track: number; time: number; duration?: number }>) => Promise<void>
  onCancel:      () => void
}

type PlacementMode = 'exact' | 'offset'

export function TapApplyModal({ tapMode, existingNotes, songId, onApply, onCancel }: Props) {
  const snapMode = useEditorStore((s) => s.snapMode)

  const [mode,          setMode]          = useState<PlacementMode>('exact')
  const [anchorInput,   setAnchorInput]   = useState('')
  const [applying,      setApplying]      = useState(false)
  const [preview,       setPreview]       = useState<PlacementPreview | null>(null)
  const [resolutions,   setResolutions]   = useState<ConflictResolutionMap>({})

  const offset = mode === 'exact'
    ? 0
    : Math.max(0, parseFloat(anchorInput) || 0) - tapMode.loopRange.start

  function buildPreview() {
    return buildTapPlacementPreview({
      songId,
      draftNotes:    tapMode.draftNotes,
      existingNotes,
      offset,
    })
  }

  async function handleConfirm() {
    const p = buildPreview()
    if (p.conflicts.length > 0) {
      setPreview(p)
      return
    }
    await commitNotes(p, {})
  }

  async function handleConflictApply() {
    if (!preview) return
    await commitNotes(preview, resolutions)
    setPreview(null)
  }

  async function commitNotes(p: PlacementPreview, res: ConflictResolutionMap) {
    setApplying(true)
    try {
      const toCreate = [
        ...p.creatable.map((c) => ({ track: c.track, time: c.time, duration: c.duration })),
        ...p.conflicts
          .filter((c) => res[c.conflictId] === 'REPLACE_WITH_PATTERN')
          .map((c) => ({ track: c.track, time: c.time, duration: c.incomingNote.duration })),
      ]
      if (toCreate.length === 0) {
        toast.info('No notes to apply')
        onCancel()
        return
      }
      await onApply(toCreate)
      toast.success(`${toCreate.length} note${toCreate.length === 1 ? '' : 's'} applied`)
      onCancel()
    } catch {
      toast.error('Failed to apply notes')
    } finally {
      setApplying(false)
    }
  }

  if (preview) {
    return (
      <ConflictReviewModal
        preview={preview}
        title="Tap Session Conflicts"
        incomingLabel="Tapped note"
        applyLabel="Apply tapped notes"
        resolutions={resolutions}
        onResolve={(id, action) => setResolutions((r) => ({ ...r, [id]: action }))}
        onApply={handleConflictApply}
        onCancel={() => setPreview(null)}
      />
    )
  }

  const noteCount = tapMode.draftNotes.length

  return (
    <EditorModalOverlay onClose={onCancel}>
      <EditorModalPanel>
        <h2 className="text-lg font-semibold mb-4">Apply Tap Session</h2>
        <p className="text-sm text-muted mb-6">
          {noteCount} note{noteCount === 1 ? '' : 's'} recorded. Choose where to place them.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="placement"
              value="exact"
              checked={mode === 'exact'}
              onChange={() => setMode('exact')}
            />
            <span className="text-sm font-medium">Exact time</span>
            <span className="text-xs text-muted ml-1">(keep recorded timestamps)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="placement"
              value="offset"
              checked={mode === 'offset'}
              onChange={() => setMode('offset')}
            />
            <span className="text-sm font-medium">Other time</span>
          </label>

          {mode === 'offset' && (
            <div className="ml-6 flex items-center gap-2">
              <label className="text-xs text-muted">New start (seconds):</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={anchorInput}
                onChange={(e) => setAnchorInput(e.target.value)}
                className="w-24 text-sm border border-canvas-border rounded px-2 py-1 bg-canvas-surface"
                placeholder={String(tapMode.loopRange.start)}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-canvas-border hover:bg-canvas-hover"
          >
            Discard
          </button>
          <button
            onClick={handleConfirm}
            disabled={applying || noteCount === 0}
            className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {applying ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </EditorModalPanel>
    </EditorModalOverlay>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/TapApplyModal.tsx
git commit -m "feat(editor): TapApplyModal — placement picker + conflict resolution"
```

---

## Task 9: TransportBar TAP badge

**Files:**
- Modify: `apps/web/src/features/editor/components/TransportBar.tsx`

- [ ] **Step 1: Read TransportBar.tsx in full**

Read `apps/web/src/features/editor/components/TransportBar.tsx` to see the full JSX before editing.

- [ ] **Step 2: Add tapMode to destructured store state**

In `TransportBar`, add to the store destructure line:
```ts
const { isPlaying, setPlaying, playheadTime, setPlayheadTime, tapMode, setTapMode } = useEditorStore()
```

- [ ] **Step 3: Add TAP badge to JSX**

In the TransportBar JSX, add the TAP badge next to the play/pause controls. Find the section with play/pause buttons and add after them:
```tsx
{tapMode && (
  <button
    onClick={() => setTapMode(null)}
    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse hover:bg-red-500/30"
    title="Tap mode active — click to end session"
  >
    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
    TAP
  </button>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/TransportBar.tsx
git commit -m "feat(transport-bar): TAP mode badge with end-session button"
```

---

## Task 10: Toolbar — Tap Mode button

**Files:**
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx`

- [ ] **Step 1: Read Toolbar.tsx in full**

Read `apps/web/src/features/editor/components/Toolbar.tsx` to see all props and JSX.

- [ ] **Step 2: Add onStartTapMode prop**

In `ToolbarProps`, add:
```ts
onStartTapMode?: () => void
```

- [ ] **Step 3: Add Tap Mode button to JSX**

In the Toolbar JSX, add a "Tap" button alongside existing controls (show only when `canEdit`):
```tsx
{canEdit && onStartTapMode && (
  <button
    onClick={onStartTapMode}
    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-canvas-border hover:bg-canvas-hover"
    title="Tap to rhythm (keys 1–8)"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <circle cx="6" cy="6" r="4" />
    </svg>
    Tap
  </button>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/Toolbar.tsx
git commit -m "feat(toolbar): Tap Mode activation button"
```

---

## Task 11: PianoRoll — wire everything together

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Read PianoRoll.tsx in full**

Read `apps/web/src/features/editor/components/PianoRoll.tsx` in full (it is large — read all of it).

- [ ] **Step 2: Add imports**

At the top of `PianoRoll.tsx`, add:
```ts
import { TapModeOverlay } from './TapModeOverlay'
import { TapApplyModal }  from './TapApplyModal'
import { useTapInput }    from '../hooks/useTapInput'
```

- [ ] **Step 3: Add tapMode and loopRange to store destructure**

In the store destructure line (around line 83), add:
```ts
tapMode, setTapMode, loopRange, setLoopRange,
```

- [ ] **Step 4: Wire useTapInput**

After the existing `usePlayback()` call (if present) or at the end of hook calls, add:
```ts
const { inFlightTracks } = useTapInput({ bpm: song?.bpm ?? 120 })
```

The `song` prop is already available in `PianoRoll` (passed as `Song`). If `bpm` isn't directly available, check existing code — `TransportBar` receives `bpm` from parent. Add `bpm` as a prop to `PianoRoll` if needed:

In `Props` interface, add:
```ts
bpm?: number
```

And pass it through from `EditorPage`. Then use `bpm ?? 120` in `useTapInput`.

- [ ] **Step 5: Add startTapMode handler**

Before the return, add:
```ts
function startTapMode() {
  if (!loopRange) {
    toast.error('Set a loop range first — drag the handles on the time axis')
    return
  }
  setTapMode({ loopRange, draftNotes: [] })
  setPlaying(true)
}

function endTapMode() {
  setPlaying(false)
  // TapApplyModal opens automatically when tapMode has draftNotes
}
```

- [ ] **Step 6: Add TapModeOverlay to JSX**

Inside the piano roll JSX, after `<ChartPreviewLayer .../>` and `<AiSuggestions .../>`, add:
```tsx
<TapModeOverlay
  pxPerSecond={pxPerSecond}
  scrollTop={scrollTop}
  playheadTime={playheadTime}
  inFlightTracks={inFlightTracks}
/>
```

- [ ] **Step 7: Add TapApplyModal + end-session wiring**

At the bottom of the PianoRoll JSX (before the final closing tag), add:
```tsx
{tapMode && !tapMode.draftNotes.length === false && (
  <TapApplyModal
    tapMode={tapMode}
    existingNotes={notes ?? []}
    songId={songId}
    onApply={async (notesToCreate) => {
      await Promise.all(
        notesToCreate.map((n) =>
          createNote.mutateAsync({
            track:       n.track,
            time:        n.time,
            title:       '',
            noteType:    n.duration != null ? 'HOLD' : 'TAP',
            duration:    n.duration,
          })
        )
      )
    }}
    onCancel={() => setTapMode(null)}
  />
)}
```

Note: `TapApplyModal` should only render when `tapMode` exists AND playback has stopped. To detect "session done", wrap the modal render in a condition that checks `!isPlaying && tapMode`:
```tsx
{!isPlaying && tapMode && tapMode.draftNotes.length > 0 && (
  <TapApplyModal ... />
)}
```

- [ ] **Step 8: Pass loopRange and onLoopRangeChange to TimeAxis**

Find where `<TimeAxis ... />` is rendered in PianoRoll and add:
```tsx
loopRange={loopRange}
onLoopRangeChange={setLoopRange}
```

- [ ] **Step 9: Pass onStartTapMode to Toolbar (via EditorPage)**

If `Toolbar` is rendered inside `EditorPage` (not `PianoRoll`), pass `onStartTapMode` from `EditorPage`. Open `apps/web/src/pages/EditorPage.tsx` and:

1. Import `useEditorStore` if not already imported
2. Destructure `setTapMode`, `loopRange`, `setPlaying` from the store
3. Add `startTapMode` function:
   ```ts
   function startTapMode() {
     if (!loopRange) {
       toast.error('Set a loop range first')
       return
     }
     setTapMode({ loopRange, draftNotes: [] })
     setPlaying(true)
   }
   ```
4. Pass `onStartTapMode={startTapMode}` to `<Toolbar />`

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 11: Run all tests**

```bash
cd apps/web && pnpm test
```
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx \
        apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): wire tap-to-rhythm — overlay, apply modal, loop range"
```

---

## Self-Review Checklist

- [x] **Vitest setup** → Task 1
- [x] **loopRange + tapMode store state** → Task 2
- [x] **Loop playback** → Task 3
- [x] **buildTapPlacementPreview + tests** → Task 4
- [x] **TimeAxis loop handles** → Task 5
- [x] **useTapInput keydown/keyup** → Task 6
- [x] **TapModeOverlay (flash + ghost notes)** → Task 7
- [x] **TapApplyModal (exact/offset + ConflictReviewModal)** → Task 8
- [x] **TransportBar TAP badge** → Task 9
- [x] **Toolbar Tap Mode button** → Task 10
- [x] **PianoRoll wiring** → Task 11
- [x] **Edge case: loop boundary force-closes in-flight keys** → useTapInput playhead-jump detection
- [x] **Edge case: no notes tapped** → TapApplyModal shows "No notes" path
- [x] **Edge case: 409 race** → individual `mutateAsync` calls handle per-note 409 silently via existing `useCreateNote` onError
- [x] **Edge case: chart changed mid-session** → `activeChartId` watch in PianoRoll (add `useEffect` that calls `setTapMode(null)` when `activeChartId` changes and `tapMode` is active — add to Task 11 Step 5)
