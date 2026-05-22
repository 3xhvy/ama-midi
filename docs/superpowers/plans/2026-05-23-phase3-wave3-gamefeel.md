# Phase 3 — Wave 3: Game-feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Difficulty heatmap overlay, Combo + Difficulty stats in BottomBar, and Game Preview view mode (visual-only — notes fall, viewport auto-scrolls, no key input).

**Architecture:** New engine module `difficulty-calculator` (pure functions: `computeNpsOverTime`, `npsToColor`, `maxCombo`, `difficultyRating`). Three new components: `DifficultyOverlay` (absolute-positioned colored bands inside PianoRoll scroll container), `HitZone` (fixed bottom 10% of viewport), `BottomBarStats` (computed-once-per-notes-change). Toolbar gains heatmap toggle and 4th view mode `preview`. `PianoRoll` learns to suppress editing + auto-scroll when `viewMode === 'preview' && isPlaying`.

**Tech Stack:** React 18, `useMemo`, `useEffect` (rAF integration), Zustand.

**Spec:** `docs/superpowers/specs/2026-05-22-phase3-music-game-features-design.md`

**Prerequisite:** Waves 1 + 2 merged (note types must render; playback loop from Phase 1 must exist).

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `apps/web/src/features/editor/engine/difficulty-calculator.ts` | NPS, color, combo, rating |
| Modify | `apps/web/src/features/editor/engine/index.ts` | Re-export new module |
| Modify | `apps/web/src/store/editor.store.ts` | heatmapEnabled, 'preview' view mode |
| Create | `apps/web/src/features/editor/components/DifficultyOverlay.tsx` | Heatmap bands |
| Create | `apps/web/src/features/editor/components/HitZone.tsx` | Bottom hit area |
| Create | `apps/web/src/features/editor/components/BottomBarStats.tsx` | Difficulty + combo |
| Modify | `apps/web/src/features/editor/components/Toolbar.tsx` | Heatmap toggle, 4th view mode button |
| Modify | `apps/web/src/features/editor/components/PianoRoll.tsx` | Render overlay + HitZone; preview-mode wiring |
| Modify | `apps/web/src/pages/EditorPage.tsx` | bottomBar uses BottomBarStats |

---

## Task 1: Engine — difficulty-calculator.ts

**Files:**
- Create: `apps/web/src/features/editor/engine/difficulty-calculator.ts`
- Create: `apps/web/src/features/editor/engine/__tests__/difficulty-calculator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/src/features/editor/engine/__tests__/difficulty-calculator.test.ts
import {
  computeNpsOverTime, npsToColor, maxCombo, difficultyRating,
} from '../difficulty-calculator'
import type { Note } from '@ama-midi/shared'

const mkNote = (id: string, time: number): Note => ({
  id, time, track: 1, songId: 's', title: 't', description: '', color: '#fff',
  createdBy: 'u', creatorName: 'n', createdAt: '', updatedAt: '',
  noteType: 'TAP',
} as Note)

describe('difficulty-calculator', () => {
  it('npsToColor: <3 → green, <6 → yellow, >=6 → red', () => {
    expect(npsToColor(0)).toContain('16, 185, 129')
    expect(npsToColor(4)).toContain('245, 158, 11')
    expect(npsToColor(8)).toContain('239, 68, 68')
  })

  it('maxCombo: 3 notes within 2s window = streak 3', () => {
    const notes = [mkNote('a', 0), mkNote('b', 1), mkNote('c', 2)]
    expect(maxCombo(notes)).toBe(3)
  })

  it('maxCombo: gap > 2s breaks streak', () => {
    const notes = [mkNote('a', 0), mkNote('b', 1), mkNote('c', 5)]
    expect(maxCombo(notes)).toBe(2)
  })

  it('maxCombo: empty → 0', () => {
    expect(maxCombo([])).toBe(0)
  })

  it('difficultyRating: empty → Easy', () => {
    expect(difficultyRating([])).toBe('Easy')
  })

  it('difficultyRating: 1500 notes over 300s = avgNps 5 → Hard', () => {
    const notes = Array.from({ length: 1500 }, (_, i) => mkNote(`n${i}`, i * 0.2))
    expect(difficultyRating(notes)).toBe('Hard')
  })

  it('computeNpsOverTime: returns array spanning 0–300s', () => {
    const r = computeNpsOverTime([], 2, 0.5)
    expect(r[0]).toEqual({ time: 0, nps: 0 })
    expect(r[r.length - 1].time).toBe(300)
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
cd apps/web && pnpm test --run difficulty-calculator
```

- [ ] **Step 3: Implement**

```typescript
// apps/web/src/features/editor/engine/difficulty-calculator.ts
import type { Note } from '@ama-midi/shared'

export function computeNpsOverTime(
  notes: Note[], windowSeconds = 2, resolution = 0.5,
): Array<{ time: number; nps: number }> {
  const result: Array<{ time: number; nps: number }> = []
  for (let t = 0; t <= 300; t = +(t + resolution).toFixed(3)) {
    const count = notes.filter(
      n => n.time >= t - windowSeconds / 2 && n.time < t + windowSeconds / 2,
    ).length
    result.push({ time: t, nps: count / windowSeconds })
  }
  return result
}

export function npsToColor(nps: number): string {
  if (nps < 3) return 'rgba(16, 185, 129, 0.15)'
  if (nps < 6) return 'rgba(245, 158, 11, 0.20)'
  return 'rgba(239, 68, 68, 0.25)'
}

export function maxCombo(notes: Note[]): number {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  let max = 0, streak = 0, last = -Infinity
  for (const n of sorted) {
    if (n.time - last <= 2) { streak++; max = Math.max(max, streak) }
    else                     { streak = 1; max = Math.max(max, streak) }
    last = n.time
  }
  return max
}

export type DifficultyRating = 'Easy' | 'Normal' | 'Hard' | 'Expert'

export function difficultyRating(notes: Note[]): DifficultyRating {
  if (notes.length === 0) return 'Easy'
  const avgNps = notes.length / 300
  if (avgNps < 2) return 'Easy'
  if (avgNps < 4) return 'Normal'
  if (avgNps < 7) return 'Hard'
  return 'Expert'
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
cd apps/web && pnpm test --run difficulty-calculator
```

Expected: 7 passed.

- [ ] **Step 5: Update engine barrel**

In `apps/web/src/features/editor/engine/index.ts`, add:

```typescript
export * from './difficulty-calculator'
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/engine/
git commit -m "feat(engine): difficulty-calculator (NPS, combo, rating)"
```

---

## Task 2: Store — heatmapEnabled + 'preview' view mode

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`

- [ ] **Step 1: Extend ViewMode type + add heatmapEnabled**

In `editor.store.ts`:

```typescript
type ViewMode = 'composer' | 'developer' | 'qa' | 'preview'
```

Add to `EditorStore` interface:

```typescript
heatmapEnabled:    boolean
setHeatmapEnabled: (enabled: boolean) => void
```

Initial state + setter:

```typescript
heatmapEnabled:    false,
setHeatmapEnabled: (heatmapEnabled) => set({ heatmapEnabled }),
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors. (4th view mode value not yet referenced.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/editor.store.ts
git commit -m "feat(store): heatmapEnabled + preview view mode"
```

---

## Task 3: DifficultyOverlay component

**Files:**
- Create: `apps/web/src/features/editor/components/DifficultyOverlay.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/web/src/features/editor/components/DifficultyOverlay.tsx
import { useMemo } from 'react'
import { computeNpsOverTime, npsToColor, timeToY } from '../engine'
import type { Note } from '@ama-midi/shared'

interface Props {
  notes:       Note[]
  pxPerSecond: number
  timeFrom:    number
  timeTo:      number
}

export function DifficultyOverlay({ notes, pxPerSecond, timeFrom, timeTo }: Props) {
  const npsData = useMemo(() => computeNpsOverTime(notes), [notes])
  const bandHeight = 0.5 * pxPerSecond

  return (
    <>
      {npsData
        .filter(({ time }) => time >= timeFrom - 1 && time <= timeTo + 1)
        .map(({ time, nps }) => (
          <div
            key={time}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top:             timeToY(time, pxPerSecond),
              height:          bandHeight,
              backgroundColor: npsToColor(nps),
              zIndex:          1,
            }}
          />
        ))}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/DifficultyOverlay.tsx
git commit -m "feat(editor): DifficultyOverlay heatmap bands"
```

---

## Task 4: HitZone component

**Files:**
- Create: `apps/web/src/features/editor/components/HitZone.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/web/src/features/editor/components/HitZone.tsx
export function HitZone() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[10%] border-t-2 border-primary/50 bg-primary/5 pointer-events-none z-10">
      <div className="flex h-full">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 border-r border-primary/20 last:border-r-0"
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/HitZone.tsx
git commit -m "feat(editor): HitZone bottom overlay"
```

---

## Task 5: BottomBarStats component

**Files:**
- Create: `apps/web/src/features/editor/components/BottomBarStats.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/web/src/features/editor/components/BottomBarStats.tsx
import { useMemo } from 'react'
import { difficultyRating, maxCombo } from '../engine'
import type { Note } from '@ama-midi/shared'

interface Props { notes: Note[] }

const DIFF_COLOR: Record<string, string> = {
  Easy:   'text-success',
  Normal: 'text-info',
  Hard:   'text-warning',
  Expert: 'text-error',
}

export function BottomBarStats({ notes }: Props) {
  const rating = useMemo(() => difficultyRating(notes), [notes])
  const combo  = useMemo(() => maxCombo(notes), [notes])
  return (
    <span className="flex items-center gap-3 text-xs">
      <span className={DIFF_COLOR[rating] ?? 'text-shell-muted'}>♦ {rating}</span>
      <span className="text-shell-muted">Combo ×{combo}</span>
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/BottomBarStats.tsx
git commit -m "feat(editor): BottomBarStats difficulty + combo"
```

---

## Task 6: Toolbar — heatmap toggle + preview view mode

**Files:**
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx`

- [ ] **Step 1: Add 4th view mode entry**

Extend `VIEW_MODES`:

```typescript
const VIEW_MODES = [
  { value: 'composer',  label: 'Composer' },
  { value: 'developer', label: 'Dev' },
  { value: 'qa',        label: 'QA' },
  { value: 'preview',   label: 'Preview' },
]
```

- [ ] **Step 2: Add heatmap toggle button**

Destructure additional store values:

```typescript
const { heatmapEnabled, setHeatmapEnabled } = useEditorStore()
```

In the RIGHT zone of the toolbar (near IconButton group), add:

```tsx
<IconButton
  size="sm"
  tooltip={heatmapEnabled ? 'Hide difficulty heatmap' : 'Show difficulty heatmap'}
  onClick={() => setHeatmapEnabled(!heatmapEnabled)}
  className={heatmapEnabled ? 'text-warning' : ''}
>
  {heatmapEnabled ? '🔥' : '⬛'}
</IconButton>
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/Toolbar.tsx
git commit -m "feat(editor): toolbar adds Preview view mode + heatmap toggle"
```

---

## Task 7: PianoRoll — DifficultyOverlay + HitZone + preview mode

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Add imports + read flags**

```typescript
import { DifficultyOverlay } from './DifficultyOverlay'
import { HitZone }           from './HitZone'
```

Inside `PianoRoll`, read flags from store:

```typescript
const { heatmapEnabled, viewMode, isPlaying } = useEditorStore()
const isPreview = viewMode === 'preview'
const effectiveCanEdit = canEdit && !isPreview
```

Replace all reads of `canEdit` (inside handlers) with `effectiveCanEdit`. Or simpler: gate `handleMouseDown`, `handleGridClick`, `handleMouseMove`'s ghost-set branch all by `!isPreview`.

- [ ] **Step 2: Render DifficultyOverlay inside scroll container**

Inside `<div className="relative" style={{ height: totalHeight }}>`, after `<GridLines>` and before `<Playhead>`:

```tsx
{heatmapEnabled && (
  <DifficultyOverlay
    notes={notes}
    pxPerSecond={pxPerSecond}
    timeFrom={timeFrom}
    timeTo={timeTo}
  />
)}
```

- [ ] **Step 3: Render HitZone in Preview mode**

Inside the outer relative container (the one wrapping the scrollable grid div), after the scrollable grid closes:

```tsx
{isPreview && <HitZone />}
```

- [ ] **Step 4: Auto-scroll viewport in Preview while playing**

Add `useEffect`:

```typescript
useEffect(() => {
  if (!isPreview || !isPlaying) return
  let raf: number
  const tick = () => {
    if (!containerRef.current) return
    const target = Math.max(
      0,
      timeToY(useEditorStore.getState().playheadTime, pxPerSecond) - containerRef.current.clientHeight * 0.9,
    )
    containerRef.current.scrollTop = target
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}, [isPreview, isPlaying, pxPerSecond])
```

- [ ] **Step 5: Suppress click + drag in Preview**

Add guards at top of `handleMouseDown` and `handleGridClick`:

```typescript
if (isPreview) return
```

Hide the Fast/Popup toggle when in preview by wrapping it:

```tsx
{effectiveCanEdit && (
  <div className="absolute top-9 left-2 z-30">
    {/* existing toggle */}
  </div>
)}
```

- [ ] **Step 6: Type-check + smoke**

```bash
cd apps/web && npx tsc --noEmit && pnpm dev
```

Switch to Preview mode. Click Play. Viewport scrolls automatically. HitZone visible at bottom. Notes "fall" past hit zone. Clicking grid does nothing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "feat(editor): PianoRoll integrates DifficultyOverlay, HitZone, preview auto-scroll"
```

---

## Task 8: EditorPage — BottomBar uses BottomBarStats

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Import + replace bottomBar JSX**

Add import:

```typescript
import { BottomBarStats } from '../features/editor/components/BottomBarStats'
```

Replace the `bottomBar` const:

```typescript
const bottomBar = (
  <>
    <span className="text-xs font-mono text-shell-muted">{formatTime(playheadTime)}</span>
    <span className="text-shell-muted/40 px-2">│</span>
    <BottomBarStats notes={allNotes} />
    <div className="ml-auto">
      {!validationData ? null : errCount === 0 && warnCount === 0 ? (
        <span className="text-xs text-green-500">✓ Valid</span>
      ) : (
        <span className="flex items-center gap-2 text-xs">
          {errCount > 0 && <span className="text-red-400">{errCount} err</span>}
          {warnCount > 0 && <span className="text-yellow-400">{warnCount} warn</span>}
        </span>
      )}
    </div>
  </>
)
```

- [ ] **Step 2: Type-check + smoke**

```bash
cd apps/web && npx tsc --noEmit && pnpm dev
```

Bottom bar shows difficulty + combo. Add 5 notes within 2s → combo updates to 5.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): BottomBar shows difficulty + combo via BottomBarStats"
```

---

## Task 9: Visual smoke pass for heatmap viewport filter

**Files:**
- (none)

- [ ] **Step 1: Verify performance**

Open a song with many notes (e.g., paste a pattern 5x). Toggle heatmap on. Inspect DOM: the heatmap container should hold ≤ ~30 absolutely-positioned divs at any time (only viewport range, controlled by `timeFrom/timeTo` filter in `DifficultyOverlay`).

- [ ] **Step 2: Scroll and confirm bands recompute**

Scroll up + down. Bands enter/leave viewport. Colors match density: dense areas red, sparse green.

If wrong: open `PianoRoll.tsx` and confirm `timeFrom/timeTo` from `getPrefetchTimeRange` are passed to `<DifficultyOverlay timeFrom={timeFrom} timeTo={timeTo} ...>`.

---

## Task 10: Final verification

**Files:**
- (none)

- [ ] **Step 1: Full type-check**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && npx tsc --noEmit
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && npx tsc --noEmit
```

- [ ] **Step 2: Tests**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && pnpm test
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && pnpm test
```

- [ ] **Step 3: Build**

```bash
cd /Users/hohoanghvy/Projects/ama-midi && pnpm build
```

Expected: all green.

- [ ] **Step 4: Manual smoke (full Wave 3 walkthrough)**

1. Open a song with ~50 notes.
2. Toggle heatmap on → green/yellow/red bands appear under notes.
3. BottomBar shows difficulty rating (e.g., "Normal") + combo count.
4. Add a burst of 10 notes within 2s → BottomBar combo jumps to 10, local section turns red.
5. Switch view mode to Preview → editing disabled, HitZone visible.
6. Press Play → viewport auto-scrolls, notes fall past the hit zone.
7. Switch back to Composer → editing re-enabled.

- [ ] **Step 5: Final commit if any fixups**

```bash
git status
```

---

## Acceptance Criteria (from spec)

- [x] Toolbar Heatmap toggle shows/hides green/yellow/red bands
- [x] BottomBar shows difficulty rating + combo, color-coded
- [x] Both update live as notes change
- [x] Preview view mode added to switcher
- [x] Notes appear to fall as viewport auto-scrolls during play
- [x] HitZone visible at bottom 10%
- [x] No note creation in Preview mode (clicks suppressed)
