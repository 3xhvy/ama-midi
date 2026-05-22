# Phase 3 — Wave 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BPM + beat grid, three note types (TAP/HOLD/SWIPE), and snap-to-beat modes — the data model and engine foundation Waves 2 and 3 depend on.

**Architecture:** Two Prisma migrations + shared type extensions, new engine modules (`beat-calculator`, `beat-grid`), `coordinate-mapper.yToTime` signature change to take `snapMode + bpm`, `NoteCircle` becomes a router to three new components (`TapNote`/`HoldNote`/`SwipeNote`), toolbar gets BPM widget + snap toggle + active-type selector, PianoRoll learns drag-to-create HOLD.

**Tech Stack:** Prisma, NestJS class-validator, Zustand, React 18, TanStack Query (existing).

**Spec:** `docs/superpowers/specs/2026-05-22-phase3-music-game-features-design.md`

**Supersedes:** `docs/superpowers/plans/2026-05-22-phase3-music-game-features.md` (predated locked design decisions).

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `apps/api/prisma/migrations/<auto>_phase3_song_bpm/migration.sql` | Add bpm, timeSignature columns |
| Create | `apps/api/prisma/migrations/<auto>_phase3_note_types/migration.sql` | NoteType enum + noteType/duration columns |
| Modify | `apps/api/prisma/schema.prisma` | Song bpm/timeSignature, NoteType enum, Note noteType/duration |
| Modify | `packages/shared/src/types.ts` | NoteType, Note + Song extensions |
| Modify | `packages/shared/src/constants.ts` | HOLD_DURATION_MIN/MAX, HOLD_DRAG_THRESHOLD_PX |
| Modify | `apps/api/src/modules/songs/songs.service.ts` | UpdateSongDto + service include bpm/timeSignature |
| Modify | `apps/api/src/modules/notes/notes.service.ts` | DTO + HOLD-duration guard |
| Create | `apps/web/src/features/editor/engine/beat-calculator.ts` | beatDuration, timeToBeat, beatToTime, snapTime, SnapMode |
| Create | `apps/web/src/features/editor/engine/beat-grid.ts` | computeBeatLines for grid rendering |
| Modify | `apps/web/src/features/editor/engine/coordinate-mapper.ts` | yToTime accepts snapMode, bpm |
| Modify | `apps/web/src/features/editor/engine/index.ts` | Re-export new engine functions |
| Modify | `apps/web/src/store/editor.store.ts` | snapMode, activeNoteType + setters |
| Create | `apps/web/src/features/editor/components/TapNote.tsx` | Existing 16px circle, extracted |
| Create | `apps/web/src/features/editor/components/HoldNote.tsx` | Cap + pill + tail rendering |
| Create | `apps/web/src/features/editor/components/SwipeNote.tsx` | Circle + right arrow |
| Modify | `apps/web/src/features/editor/components/NoteCircle.tsx` | Router only |
| Modify | `apps/web/src/features/editor/components/GridLines.tsx` | beatLines prop |
| Modify | `apps/web/src/features/editor/components/TimeAxis.tsx` | Dual bar.beat labels |
| Modify | `apps/web/src/features/editor/components/Toolbar.tsx` | BPM widget, snap toggle, type toggle |
| Modify | `apps/web/src/features/editor/components/PianoRoll.tsx` | Drag-to-create HOLD; pass beatLines |
| Modify | `apps/web/src/features/editor/components/NotePopup.tsx` | Type selector + Duration field |

---

## Task 1: DB Migration — Song BPM

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add bpm + timeSignature fields**

In `apps/api/prisma/schema.prisma`, inside `model Song {}` after `creatorId` (or wherever fields end, before relations):

```prisma
bpm           Int    @default(120)
timeSignature String @default("4/4")
```

- [ ] **Step 2: Generate migration**

```bash
cd apps/api && npx prisma migrate dev --name phase3_song_bpm
```

Expected: `✔ Generated Prisma Client`. New folder under `apps/api/prisma/migrations/`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(db): add Song.bpm and Song.timeSignature columns"
```

---

## Task 2: DB Migration — Note Types

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add NoteType enum + Note fields**

In `apps/api/prisma/schema.prisma`, add the enum block (top-level, near other enums):

```prisma
enum NoteType {
  TAP
  HOLD
  SWIPE
}
```

Inside `model Note {}`, after `color`:

```prisma
noteType NoteType @default(TAP)
duration Float?
```

- [ ] **Step 2: Generate migration**

```bash
cd apps/api && npx prisma migrate dev --name phase3_note_types
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(db): add NoteType enum and Note.noteType/duration columns"
```

---

## Task 3: Shared Types — Extend Note + Song, Add NoteType

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add NoteType + extend Note + Song**

In `packages/shared/src/types.ts`, add at top after `UserRole`:

```typescript
export type NoteType = 'TAP' | 'HOLD' | 'SWIPE'
```

Extend `Song` interface (insert before closing brace):

```typescript
  bpm:           number
  timeSignature: string
```

Extend `Note` interface (insert before closing brace):

```typescript
  noteType: NoteType
  duration?: number
```

- [ ] **Step 2: Add constants**

Append to `packages/shared/src/constants.ts`:

```typescript
export const HOLD_DURATION_MIN     = 0.1
export const HOLD_DURATION_MAX     = 30
export const HOLD_DRAG_THRESHOLD_PX = 4
```

- [ ] **Step 3: Rebuild shared**

```bash
cd packages/shared && pnpm build
```

Expected: no errors. `dist/` regenerated.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): NoteType, Note + Song extensions, HOLD constants"
```

---

## Task 4: Backend — UpdateSongDto extension

**Files:**
- Modify: `apps/api/src/modules/songs/songs.service.ts` (or songs.controller.ts where DTO lives)

- [ ] **Step 1: Locate UpdateSongDto**

```bash
grep -n "UpdateSongDto\|class.*Dto" apps/api/src/modules/songs/ -r
```

- [ ] **Step 2: Extend DTO**

In the file containing `UpdateSongDto`, add inside the class:

```typescript
@IsInt() @Min(40) @Max(300) @IsOptional() bpm?: number
@Matches(/^\d+\/\d+$/, { message: 'timeSignature must look like "4/4"' })
@IsOptional() timeSignature?: string
```

Ensure imports include `IsInt, Min, Max, Matches, IsOptional` from `class-validator`.

- [ ] **Step 3: Ensure SongService.update accepts new fields**

If the service spreads the DTO into prisma update (`data: dto`), no code change needed. Otherwise add `bpm` and `timeSignature` to the data object.

- [ ] **Step 4: Verify type-check**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: `TypeScript: No errors found`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/songs/
git commit -m "feat(api): UpdateSongDto accepts bpm and timeSignature"
```

---

## Task 5: Backend — CreateNoteDto + UpdateNoteDto + HOLD guard

**Files:**
- Modify: `apps/api/src/modules/notes/notes.service.ts` (or DTO files under `notes/dto/`)

- [ ] **Step 1: Locate Note DTOs**

```bash
grep -rn "class CreateNoteDto\|class UpdateNoteDto" apps/api/src/modules/notes/
```

- [ ] **Step 2: Extend DTOs**

In each DTO class, add:

```typescript
@IsEnum(['TAP','HOLD','SWIPE'] as const) @IsOptional() noteType?: 'TAP' | 'HOLD' | 'SWIPE'
@IsNumber() @Min(0.1) @Max(30) @IsOptional() duration?: number
```

Add imports as needed: `IsEnum, IsNumber, Min, Max, IsOptional` from `class-validator`.

- [ ] **Step 3: Add HOLD guard in NotesService.create**

In `apps/api/src/modules/notes/notes.service.ts`, inside the `create` method, before the prisma create call:

```typescript
if (dto.noteType === 'HOLD' && (dto.duration == null || dto.duration <= 0)) {
  throw new BadRequestException('HOLD notes require duration > 0')
}
```

Same guard in `update` method when `noteType === 'HOLD'`.

Import `BadRequestException` from `@nestjs/common` if not already.

- [ ] **Step 4: Add unit test for guard**

Add to `apps/api/src/modules/notes/__tests__/notes.service.spec.ts` (inside the existing `describe('create', ...)`):

```typescript
it('rejects HOLD note without duration', async () => {
  await expect(service.create(mockUser, songId, {
    track: 1, time: 0, title: 'x', noteType: 'HOLD',
  } as any)).rejects.toThrow('HOLD notes require duration')
})
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass, including the new one.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/notes/
git commit -m "feat(api): CreateNote/UpdateNote DTOs accept noteType + duration; HOLD requires duration"
```

---

## Task 6: Engine — beat-calculator.ts

**Files:**
- Create: `apps/web/src/features/editor/engine/beat-calculator.ts`
- Create: `apps/web/src/features/editor/engine/__tests__/beat-calculator.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/src/features/editor/engine/__tests__/beat-calculator.test.ts
import {
  beatDuration, measureDuration, timeToBeat, beatToTime, snapTime,
} from '../beat-calculator'

describe('beat-calculator', () => {
  it('beatDuration: 120bpm → 0.5s', () => {
    expect(beatDuration(120)).toBe(0.5)
  })

  it('measureDuration: 120bpm 4/4 → 2.0s', () => {
    expect(measureDuration(120, '4/4')).toBe(2)
  })

  it('timeToBeat: 0s @ 120bpm → bar 1 beat 1', () => {
    expect(timeToBeat(0, 120)).toEqual({ measure: 1, beat: 1 })
  })

  it('timeToBeat: 0.5s @ 120bpm → bar 1 beat 2', () => {
    expect(timeToBeat(0.5, 120)).toEqual({ measure: 1, beat: 2 })
  })

  it('timeToBeat: 2.0s @ 120bpm → bar 2 beat 1', () => {
    expect(timeToBeat(2.0, 120)).toEqual({ measure: 2, beat: 1 })
  })

  it('beatToTime: bar 2 beat 1 @ 120bpm → 2.0s', () => {
    expect(beatToTime(2, 1, 120)).toBe(2)
  })

  it('snapTime 0.1s mode: 0.27 → 0.3', () => {
    expect(snapTime(0.27, '0.1s', 120)).toBeCloseTo(0.3, 5)
  })

  it('snapTime beat mode: 0.6 @ 120bpm → 0.5', () => {
    expect(snapTime(0.6, 'beat', 120)).toBe(0.5)
  })

  it('snapTime halfBeat mode: 0.4 @ 120bpm → 0.5', () => {
    expect(snapTime(0.4, 'halfBeat', 120)).toBe(0.5)
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
cd apps/web && pnpm test --run beat-calculator
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement engine module**

```typescript
// apps/web/src/features/editor/engine/beat-calculator.ts
export type SnapMode = '0.1s' | 'beat' | 'halfBeat'

export function beatDuration(bpm: number): number {
  return 60 / bpm
}

export function measureDuration(bpm: number, timeSignature: string): number {
  const [beats] = timeSignature.split('/').map(Number)
  return beatDuration(bpm) * beats
}

export function timeToBeat(
  time: number, bpm: number, timeSignature = '4/4',
): { measure: number; beat: number } {
  const [beatsPerMeasure] = timeSignature.split('/').map(Number)
  const bd     = beatDuration(bpm)
  const total  = Math.floor(time / bd)
  return {
    measure: Math.floor(total / beatsPerMeasure) + 1,
    beat:    (total % beatsPerMeasure) + 1,
  }
}

export function beatToTime(measure: number, beat: number, bpm: number, beatsPerMeasure = 4): number {
  return ((measure - 1) * beatsPerMeasure + (beat - 1)) * beatDuration(bpm)
}

export function snapTime(rawTime: number, mode: SnapMode, bpm: number): number {
  if (mode === '0.1s') return Math.round(rawTime * 10) / 10
  const bd  = beatDuration(bpm)
  const div = mode === 'beat' ? bd : bd / 2
  return Math.round(rawTime / div) * div
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
cd apps/web && pnpm test --run beat-calculator
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/engine/beat-calculator.ts apps/web/src/features/editor/engine/__tests__/
git commit -m "feat(engine): beat-calculator (beat/measure math + snapTime)"
```

---

## Task 7: Engine — beat-grid.ts

**Files:**
- Create: `apps/web/src/features/editor/engine/beat-grid.ts`
- Create: `apps/web/src/features/editor/engine/__tests__/beat-grid.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/src/features/editor/engine/__tests__/beat-grid.test.ts
import { computeBeatLines } from '../beat-grid'

describe('computeBeatLines', () => {
  it('120bpm 4/4 from 0-2s @ pxPerSecond=10: 5 lines, first + last are measure boundaries', () => {
    const lines = computeBeatLines(0, 2, 120, '4/4', 10)
    expect(lines).toHaveLength(5)
    expect(lines[0]).toEqual({ y: 0,  weight: 'measure' })
    expect(lines[1]).toEqual({ y: 5,  weight: 'beat' })
    expect(lines[2]).toEqual({ y: 10, weight: 'beat' })
    expect(lines[3]).toEqual({ y: 15, weight: 'beat' })
    expect(lines[4]).toEqual({ y: 20, weight: 'measure' })
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
cd apps/web && pnpm test --run beat-grid
```

- [ ] **Step 3: Implement**

```typescript
// apps/web/src/features/editor/engine/beat-grid.ts
import { beatDuration } from './beat-calculator'

export interface BeatLine {
  y:      number
  weight: 'beat' | 'measure'
}

export function computeBeatLines(
  timeFrom: number, timeTo: number,
  bpm: number, timeSignature: string, pxPerSecond: number,
): BeatLine[] {
  const bd                = beatDuration(bpm)
  const [beatsPerMeasure] = timeSignature.split('/').map(Number)
  const startBeat = Math.max(0, Math.floor(timeFrom / bd))
  const endBeat   = Math.ceil(timeTo / bd)
  const lines: BeatLine[] = []
  for (let i = startBeat; i <= endBeat; i++) {
    lines.push({
      y:      i * bd * pxPerSecond,
      weight: i % beatsPerMeasure === 0 ? 'measure' : 'beat',
    })
  }
  return lines
}
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/engine/beat-grid.ts apps/web/src/features/editor/engine/__tests__/beat-grid.test.ts
git commit -m "feat(engine): beat-grid computeBeatLines for grid rendering"
```

---

## Task 8: Engine — coordinate-mapper.ts (snapMode signature)

**Files:**
- Modify: `apps/web/src/features/editor/engine/coordinate-mapper.ts`

- [ ] **Step 1: Replace yToTime**

In `coordinate-mapper.ts`, change `yToTime`:

```typescript
import { TRACK_MIN, TRACK_MAX, TIME_MIN, TIME_MAX } from '@ama-midi/shared'
import { snapTime, type SnapMode } from './beat-calculator'

export function xToTrack(x: number, gridWidth: number): number {
  const tw = gridWidth / TRACK_MAX
  const raw = Math.floor(x / tw) + TRACK_MIN
  return Math.max(TRACK_MIN, Math.min(TRACK_MAX, raw))
}

export function trackToX(track: number, gridWidth: number): number {
  const tw = gridWidth / TRACK_MAX
  return (track - TRACK_MIN) * tw
}

export function yToTime(
  y: number, pxPerSecond: number,
  snapMode: SnapMode = '0.1s', bpm = 120,
): number {
  const raw     = y / pxPerSecond
  const clamped = Math.max(TIME_MIN, Math.min(TIME_MAX, raw))
  const snapped = snapTime(clamped, snapMode, bpm)
  return Math.max(TIME_MIN, Math.min(TIME_MAX, snapped))
}

export function timeToY(time: number, pxPerSecond: number): number {
  return time * pxPerSecond
}

export function trackWidth(gridWidth: number): number {
  return gridWidth / TRACK_MAX
}
```

The `SNAP_RESOLUTION` import is removed — replaced by snapTime.

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors (callers using default args still work).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/engine/coordinate-mapper.ts
git commit -m "refactor(engine): yToTime takes snapMode + bpm"
```

---

## Task 9: Engine — index.ts barrel

**Files:**
- Modify: `apps/web/src/features/editor/engine/index.ts`

- [ ] **Step 1: Re-export new modules**

```typescript
// apps/web/src/features/editor/engine/index.ts
export * from './coordinate-mapper'
export * from './viewport-calculator'
export * from './beat-calculator'
export * from './beat-grid'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/engine/index.ts
git commit -m "chore(engine): export beat-calculator + beat-grid from barrel"
```

---

## Task 10: Store — snapMode + activeNoteType

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`

- [ ] **Step 1: Add fields**

In `editor.store.ts`:

Add type imports near top (next to existing types):

```typescript
import type { SnapMode } from '../features/editor/engine/beat-calculator'
import type { NoteType } from '@ama-midi/shared'
```

Extend the `EditorStore` interface (add inside the interface):

```typescript
snapMode:           SnapMode
activeNoteType:     NoteType
setSnapMode:        (mode: SnapMode) => void
setActiveNoteType:  (type: NoteType) => void
```

Extend `create<EditorStore>((set) => ({ ... }))` initial state and setters:

```typescript
snapMode:           '0.1s',
activeNoteType:     'TAP',
setSnapMode:        (snapMode) => set({ snapMode }),
setActiveNoteType:  (activeNoteType) => set({ activeNoteType }),
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/editor.store.ts
git commit -m "feat(store): snapMode + activeNoteType state"
```

---

## Task 11: TapNote.tsx (extract from NoteCircle)

**Files:**
- Create: `apps/web/src/features/editor/components/TapNote.tsx`

- [ ] **Step 1: Create TapNote with existing TAP rendering**

```typescript
// apps/web/src/features/editor/components/TapNote.tsx
import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import type { Note } from '@ama-midi/shared'

export interface NoteVariantProps {
  note:        Note
  gridWidth:   number
  pxPerSecond: number
  isSelected?: boolean
  viewMode?:   'composer' | 'developer' | 'qa' | 'preview'
  allNotes?:   Note[]
  onClick:     (note: Note, e: React.MouseEvent) => void
}

export function TapNote({
  note, gridWidth, pxPerSecond,
  isSelected = false, viewMode = 'composer', allNotes = [], onClick,
}: NoteVariantProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2
  const cy = y

  const isNearBoundary   = note.time < 0.5 || note.time > 299.5
  const hasCloseNeighbor = allNotes.some(
    (n) => n.id !== note.id && n.track === note.track && Math.abs(n.time - note.time) < 0.3,
  )

  const ringClass =
    viewMode === 'qa'
      ? isNearBoundary
        ? 'ring-2 ring-orange-400'
        : hasCloseNeighbor
          ? 'ring-2 ring-yellow-400'
          : ''
      : isSelected
        ? 'ring-2 ring-white'
        : ''

  const displayTime = viewMode === 'developer' ? note.time : Math.round(note.time * 10) / 10

  return (
    <>
      <div
        className={cn(
          'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear group',
          ringClass,
        )}
        style={{ left: cx - 8, top: cy - 8, backgroundColor: note.color }}
        title={`${note.title} | Track ${note.track} | ${displayTime}s`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {viewMode === 'developer' && (
          <div className="absolute top-0 left-0 text-[8px] font-mono text-white/90 whitespace-nowrap bg-black/50 px-0.5 rounded leading-none pointer-events-none select-none opacity-0 group-hover:opacity-100">
            {note.id.slice(0, 8)}
          </div>
        )}
      </div>
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: cy - 24 }} />}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/TapNote.tsx
git commit -m "feat(editor): extract TapNote component (current 16px circle)"
```

---

## Task 12: HoldNote.tsx

**Files:**
- Create: `apps/web/src/features/editor/components/HoldNote.tsx`

- [ ] **Step 1: Create HoldNote**

```typescript
// apps/web/src/features/editor/components/HoldNote.tsx
import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import type { NoteVariantProps } from './TapNote'

export function HoldNote({
  note, gridWidth, pxPerSecond,
  isSelected = false, viewMode = 'composer', onClick,
}: NoteVariantProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2
  const duration = note.duration ?? 0.5
  const bodyHeight = Math.max(24, duration * pxPerSecond)

  const ringClass = isSelected ? 'ring-2 ring-white' : ''

  return (
    <>
      <div
        className={cn('absolute pointer-events-none', ringClass)}
        style={{
          left:   cx - tw / 6,
          top:    y - 8,
          width:  tw / 3,
          height: bodyHeight + 16,
        }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
          style={{ top: 0, backgroundColor: note.color }}
          title={`${note.title} | Track ${note.track} | ${note.time}s | HOLD ${duration}s`}
          onClick={(e) => onClick(note, e)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        />
        <div
          className="absolute left-0 right-0 rounded-sm opacity-70 pointer-events-none"
          style={{ top: 8, height: bodyHeight, backgroundColor: note.color }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full opacity-50 pointer-events-none"
          style={{ top: bodyHeight + 8 - 4, backgroundColor: note.color }}
        />
      </div>
      {hovered && (viewMode === 'composer' || viewMode === 'developer') &&
        <NoteTooltip note={note} position={{ x: cx, y: y - 24 }} />}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/HoldNote.tsx
git commit -m "feat(editor): HoldNote component (cap + pill + tail)"
```

---

## Task 13: SwipeNote.tsx

**Files:**
- Create: `apps/web/src/features/editor/components/SwipeNote.tsx`

- [ ] **Step 1: Create SwipeNote**

```typescript
// apps/web/src/features/editor/components/SwipeNote.tsx
import { useState } from 'react'
import { cn } from '../../../lib/utils'
import { trackToX, timeToY, trackWidth } from '../engine'
import { NoteTooltip } from './NoteTooltip'
import type { NoteVariantProps } from './TapNote'

export function SwipeNote({
  note, gridWidth, pxPerSecond,
  isSelected = false, onClick,
}: NoteVariantProps) {
  const [hovered, setHovered] = useState(false)

  const x  = trackToX(note.track, gridWidth)
  const y  = timeToY(note.time, pxPerSecond)
  const tw = trackWidth(gridWidth)
  const cx = x + tw / 2

  const ringClass = isSelected ? 'ring-2 ring-white' : ''

  return (
    <>
      <div
        className={cn(
          'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear',
          ringClass,
        )}
        style={{ left: cx - 8, top: y - 8, backgroundColor: note.color }}
        title={`${note.title} | Track ${note.track} | ${note.time}s | SWIPE →`}
        onClick={(e) => onClick(note, e)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          left:        cx + 6,
          top:         y - 4,
          width:       0,
          height:      0,
          borderTop:   '4px solid transparent',
          borderBottom:'4px solid transparent',
          borderLeft:  `6px solid ${note.color}`,
        }}
      />
      {hovered && <NoteTooltip note={note} position={{ x: cx, y: y - 24 }} />}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/SwipeNote.tsx
git commit -m "feat(editor): SwipeNote component (circle + right arrow)"
```

---

## Task 14: NoteCircle.tsx becomes router

**Files:**
- Modify: `apps/web/src/features/editor/components/NoteCircle.tsx`

- [ ] **Step 1: Replace file content**

```typescript
// apps/web/src/features/editor/components/NoteCircle.tsx
import { TapNote, type NoteVariantProps } from './TapNote'
import { HoldNote } from './HoldNote'
import { SwipeNote } from './SwipeNote'

export type NoteCircleProps = NoteVariantProps

export function NoteCircle(props: NoteCircleProps) {
  if (props.note.noteType === 'HOLD')  return <HoldNote {...props} />
  if (props.note.noteType === 'SWIPE') return <SwipeNote {...props} />
  return <TapNote {...props} />
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/NoteCircle.tsx
git commit -m "refactor(editor): NoteCircle becomes thin router for TAP/HOLD/SWIPE"
```

---

## Task 15: GridLines beatLines prop

**Files:**
- Modify: `apps/web/src/features/editor/components/GridLines.tsx`

- [ ] **Step 1: Extend props**

```typescript
// apps/web/src/features/editor/components/GridLines.tsx
import type { VirtualItem } from '@tanstack/react-virtual'
import type { BeatLine } from '../engine/beat-grid'

export interface GridLinesProps {
  virtualItems: VirtualItem[]
  gridWidth:    number
  trackCount?:  number
  beatLines?:   BeatLine[]
}

export function GridLines({
  virtualItems, gridWidth, trackCount = 8, beatLines = [],
}: GridLinesProps) {
  const tw = gridWidth / trackCount
  return (
    <>
      {virtualItems.map((row) => {
        const isBold = row.index % 10 === 0
        return (
          <div
            key={`s${row.index}`}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top:        row.start,
              height:     1,
              background: isBold ? 'var(--canvas-grid-bold)' : 'var(--canvas-grid)',
            }}
          />
        )
      })}
      {beatLines.map((line, i) => (
        <div
          key={`b${i}`}
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top:        line.y,
            height:     1,
            background: line.weight === 'measure'
              ? 'rgba(255,255,255,0.10)'
              : 'rgba(255,255,255,0.04)',
          }}
        />
      ))}
      {Array.from({ length: trackCount - 1 }, (_, t) => (
        <div
          key={`v${t}`}
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: (t + 1) * tw, width: 1, background: 'var(--canvas-grid)' }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/GridLines.tsx
git commit -m "feat(editor): GridLines renders beatLines (beat + measure)"
```

---

## Task 16: TimeAxis dual labels

**Files:**
- Modify: `apps/web/src/features/editor/components/TimeAxis.tsx`

- [ ] **Step 1: Replace component**

```typescript
// apps/web/src/features/editor/components/TimeAxis.tsx
import { TIME_AXIS_WIDTH } from '../../../lib/constants'
import { TIME_MAX } from '@ama-midi/shared'
import { timeToBeat } from '../engine'

export interface TimeAxisProps {
  pxPerSecond:   number
  scrollTop:     number
  bpm?:          number
  timeSignature?: string
}

export function TimeAxis({
  pxPerSecond, scrollTop, bpm = 120, timeSignature = '4/4',
}: TimeAxisProps) {
  const totalHeight = TIME_MAX * pxPerSecond
  const labels: { y: number; secText: string; beatText: string; isMeasureStart: boolean }[] = []
  const step = pxPerSecond
  for (let y = 0; y <= totalHeight; y += step) {
    const time   = Math.round(y / pxPerSecond)
    const beat   = timeToBeat(time, bpm, timeSignature)
    labels.push({
      y:              y - scrollTop,
      secText:        `${time}s`,
      beatText:       `${beat.measure}.${beat.beat}`,
      isMeasureStart: beat.beat === 1,
    })
  }

  return (
    <div
      className="shrink-0 relative overflow-hidden bg-canvas-surface border-r border-canvas-border"
      style={{ width: TIME_AXIS_WIDTH }}
    >
      {labels.map((label, i) => (
        <div
          key={i}
          className="absolute left-1 select-none flex flex-col leading-tight"
          style={{ top: label.y }}
        >
          {label.y > -8 && (
            <>
              <span className="text-[9px] text-canvas-muted font-mono">{label.secText}</span>
              <span className={
                'text-[8px] font-mono ' +
                (label.isMeasureStart ? 'text-canvas-text font-bold' : 'text-canvas-muted/60')
              }>
                {label.beatText}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/TimeAxis.tsx
git commit -m "feat(editor): TimeAxis shows bar.beat below seconds"
```

---

## Task 17: BpmWidget + Snap/Type toggles in Toolbar

**Files:**
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx`

- [ ] **Step 1: Read existing Toolbar for structure**

```bash
sed -n '1,40p' apps/web/src/features/editor/components/Toolbar.tsx
```

- [ ] **Step 2: Add BPM widget, snap toggle, type toggle**

Add imports at top of `Toolbar.tsx`:

```typescript
import { useState }       from 'react'
import { apiClient }      from '../../auth/api'
import { useAuthStore }   from '../../../store/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import type { Song, NoteType } from '@ama-midi/shared'
import type { SnapMode } from '../engine/beat-calculator'
```

Replace the constants near top of file to include new toggles:

```typescript
const VIEW_MODES = [
  { value: 'composer',  label: 'Composer' },
  { value: 'developer', label: 'Dev' },
  { value: 'qa',        label: 'QA' },
]

const ZOOM_MODES = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '4', label: '4x' },
]

const SNAP_MODES: { value: SnapMode; label: string }[] = [
  { value: '0.1s',     label: '0.1s' },
  { value: 'beat',     label: 'Beat' },
  { value: 'halfBeat', label: '½' },
]

const TYPE_MODES: { value: NoteType; label: string }[] = [
  { value: 'TAP',   label: 'TAP' },
  { value: 'HOLD',  label: 'HOLD' },
  { value: 'SWIPE', label: 'SWIPE' },
]
```

Extend `ToolbarProps`:

```typescript
interface ToolbarProps {
  songId:          string
  songName:        string
  bpm:             number
  presenceList:    { id: string; name: string; avatarUrl?: string; title?: string | null; department?: string | null }[]
  onSuggest:       () => void
  onShowShortcuts: () => void
  onBack:          () => void
}
```

Inside `Toolbar`, destructure new store values + add BPM widget:

```typescript
const {
  viewMode, setViewMode,
  zoom, setZoom,
  isPlaying, setPlaying,
  playheadTime, setPlayheadTime,
  snapMode, setSnapMode,
  activeNoteType, setActiveNoteType,
} = useEditorStore()

const token        = useAuthStore(s => s.token)
const queryClient  = useQueryClient()
const [editingBpm, setEditingBpm] = useState(false)
const [bpmDraft,   setBpmDraft]   = useState(String(props.bpm))

async function saveBpm() {
  setEditingBpm(false)
  const next = Math.max(40, Math.min(300, Number(bpmDraft) || 120))
  if (next === props.bpm) return
  await apiClient(token)<Song>(`/songs/${props.songId}`, {
    method: 'PATCH',
    body:   JSON.stringify({ bpm: next }),
  })
  queryClient.invalidateQueries({ queryKey: ['song', props.songId] })
}
```

In the CENTER zone of the toolbar JSX, after the zoom toggle group, add the BPM widget + snap + type:

```tsx
{/* BPM */}
{editingBpm ? (
  <input
    autoFocus
    type="number"
    min={40}
    max={300}
    value={bpmDraft}
    onChange={(e) => setBpmDraft(e.target.value)}
    onBlur={saveBpm}
    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    className="w-16 px-2 py-0.5 text-xs bg-shell-bg border border-shell-border rounded text-shell-text"
  />
) : (
  <button
    className="text-xs font-mono text-shell-muted hover:text-shell-text px-2 py-0.5 rounded hover:bg-shell-bg"
    onClick={() => { setBpmDraft(String(props.bpm)); setEditingBpm(true) }}
    title="Click to edit BPM"
  >
    ♩ {props.bpm}
  </button>
)}

{/* Snap mode */}
<ToggleGroup
  items={SNAP_MODES.map(m => ({ value: m.value, label: m.label }))}
  value={snapMode}
  onValueChange={(v) => setSnapMode(v as SnapMode)}
  variant="canvas"
/>

{/* Active note type */}
<ToggleGroup
  items={TYPE_MODES.map(m => ({ value: m.value, label: m.label }))}
  value={activeNoteType}
  onValueChange={(v) => setActiveNoteType(v as NoteType)}
  variant="canvas"
/>
```

- [ ] **Step 3: Update EditorPage to pass bpm**

In `apps/web/src/pages/EditorPage.tsx`, where `<Toolbar ... />` is rendered, add the `bpm` prop:

```tsx
<Toolbar
  songId={songId!}
  songName={song?.name ?? '…'}
  bpm={song?.bpm ?? 120}
  presenceList={presenceList}
  onSuggest={() => triggerAiSuggest?.()}
  onShowShortcuts={() => setShowShortcuts(true)}
  onBack={() => navigate('/')}
/>
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/Toolbar.tsx apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): toolbar BPM widget, snap toggle, type toggle"
```

---

## Task 18: PianoRoll — pass beatLines, use snapMode/bpm in yToTime

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`
- Modify: `apps/web/src/features/editor/components/TimeAxis.tsx` (caller in PianoRoll if applicable)

- [ ] **Step 1: Update imports + accept song bpm**

In `PianoRoll.tsx` add imports:

```typescript
import { computeBeatLines } from '../engine/beat-grid'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../auth/api'
import { useAuthStore } from '../../../store/auth.store'
import type { Song } from '@ama-midi/shared'
```

Inside `PianoRoll` (top of function), fetch song for BPM:

```typescript
const token = useAuthStore(s => s.token)
const { data: song } = useQuery<Song>({
  queryKey: ['song', songId],
  queryFn:  () => apiClient(token)<Song>(`/songs/${songId}`),
  enabled:  !!token && !!songId,
})
const bpm           = song?.bpm ?? 120
const timeSignature = song?.timeSignature ?? '4/4'

const { snapMode } = useEditorStore()
```

- [ ] **Step 2: Compute beatLines + pass to GridLines**

After `const { timeFrom, timeTo } = getPrefetchTimeRange(...)`:

```typescript
const beatLines = computeBeatLines(timeFrom, timeTo, bpm, timeSignature, pxPerSecond)
```

Where `<GridLines virtualItems={...} gridWidth={gridWidth} />` is rendered, add `beatLines={beatLines}`.

- [ ] **Step 3: Update yToTime call to use snapMode + bpm**

Find the `handleMouseMove` callback. Change:

```typescript
const time = yToTime(y, pxPerSecond)
```

To:

```typescript
const time = yToTime(y, pxPerSecond, snapMode, bpm)
```

- [ ] **Step 4: Type-check + visual sanity**

```bash
cd apps/web && npx tsc --noEmit && pnpm dev
```

Open a song. Beat lines should appear. Toggle snap mode to "Beat" — clicking on the grid should snap to beat boundaries.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "feat(editor): PianoRoll renders beat grid and uses snapMode in yToTime"
```

---

## Task 19: PianoRoll — drag-to-create HOLD

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Add drag state + handlers**

Inside `PianoRoll`, add state and constants near other state declarations:

```typescript
import { HOLD_DRAG_THRESHOLD_PX } from '@ama-midi/shared'

const { activeNoteType } = useEditorStore()
const [drag, setDrag] = useState<
  | { start: { x: number; y: number; track: number; time: number }; currentY: number }
  | null
>(null)
```

Add `handleMouseDown`:

```typescript
const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  if (!canEdit || !containerRef.current) return
  if (activeNoteType !== 'HOLD') return                  // drag is HOLD-only
  if ((e.target as HTMLElement).closest('[data-note]')) return  // ignore clicks on existing notes
  const rect  = containerRef.current.getBoundingClientRect()
  const x     = e.clientX - rect.left
  const y     = e.clientY - rect.top + scrollTop
  const track = xToTrack(x, gridWidth)
  const time  = yToTime(y, pxPerSecond, snapMode, bpm)
  setDrag({ start: { x: e.clientX, y: e.clientY, track, time }, currentY: e.clientY })
}, [canEdit, activeNoteType, gridWidth, pxPerSecond, scrollTop, snapMode, bpm])

useEffect(() => {
  if (!drag) return
  function onMove(e: MouseEvent)  { setDrag(d => d ? { ...d, currentY: e.clientY } : null) }
  function onUp(e: MouseEvent) {
    if (!drag) return
    const dragPx = e.clientY - drag.start.y
    if (dragPx >= HOLD_DRAG_THRESHOLD_PX) {
      const duration = Math.max(0.1, dragPx / pxPerSecond)
      createNote.mutate({
        track:    drag.start.track,
        time:     drag.start.time,
        noteType: 'HOLD',
        duration,
        title:    `Hold ${drag.start.track}:${drag.start.time}`,
      })
    } else {
      createNote.mutate({
        track: drag.start.track,
        time:  drag.start.time,
        noteType: 'TAP',
        title: `Note ${drag.start.track}:${drag.start.time}`,
      })
    }
    setDrag(null)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  return () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
}, [drag, createNote, pxPerSecond])
```

- [ ] **Step 2: Wire onMouseDown to grid container + skip click handler when dragging**

Find the scrollable grid container `<div ... onClick={handleGridClick} ...>`. Add `onMouseDown={handleMouseDown}` and gate the click handler:

```tsx
<div
  ref={containerRef}
  className="overflow-y-auto overflow-x-hidden flex-1"
  onScroll={handleScroll}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onClick={(e) => { if (activeNoteType !== 'HOLD') handleGridClick(e) }}
  onMouseLeave={() => canEdit && setGhost(null)}
>
```

- [ ] **Step 3: Render drag ghost (HOLD preview)**

Inside the inner `<div className="relative" style={{ height: totalHeight }}>`, after the existing `GhostCircle`, add:

```tsx
{drag && (() => {
  const startY = timeToY(drag.start.time, pxPerSecond)
  const px     = Math.max(HOLD_DRAG_THRESHOLD_PX, drag.currentY - drag.start.y)
  const x      = trackToX(drag.start.track, gridWidth)
  const tw     = trackWidth(gridWidth)
  return (
    <div
      className="absolute rounded-sm bg-primary/40 pointer-events-none"
      style={{
        left:   x + tw / 3,
        top:    startY,
        width:  tw / 3,
        height: px,
      }}
    />
  )
})()}
```

- [ ] **Step 4: Update non-TAP fast-mode click for SWIPE**

In `handleGridClick`, when `activeNoteType === 'SWIPE'`, pass it:

Replace:

```typescript
createNote.mutate({ track: ghost.track, time: ghost.time, title: `Note ...` })
```

With:

```typescript
createNote.mutate({
  track:    ghost.track,
  time:     ghost.time,
  noteType: activeNoteType === 'SWIPE' ? 'SWIPE' : 'TAP',
  title:    `${activeNoteType} ${ghost.track}:${ghost.time}`,
})
```

- [ ] **Step 5: Type-check + manual smoke**

```bash
cd apps/web && npx tsc --noEmit && pnpm dev
```

Switch active type to HOLD, click + drag down → HOLD note created with duration. Switch to SWIPE → click creates SWIPE.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "feat(editor): drag-to-create HOLD notes; SWIPE on click in fast mode"
```

---

## Task 20: NotePopup — Type selector + Duration field

**Files:**
- Modify: `apps/web/src/features/editor/components/NotePopup.tsx`

- [ ] **Step 1: Read existing NotePopup**

```bash
sed -n '1,80p' apps/web/src/features/editor/components/NotePopup.tsx
```

- [ ] **Step 2: Add fields to form state**

Inside `NotePopup`, where form state is declared (likely with `useState` for title/color etc.), add:

```typescript
const [noteType, setNoteType] = useState<NoteType>(
  mode === 'edit' ? (note.noteType ?? 'TAP') : 'TAP',
)
const [duration, setDuration] = useState<number>(
  mode === 'edit' ? (note.duration ?? 1) : 1,
)
```

Add import:

```typescript
import type { NoteType } from '@ama-midi/shared'
```

- [ ] **Step 3: Add UI for Type + Duration**

Inside the popup's form JSX (near title/color fields), add:

```tsx
<div className="flex flex-col gap-1">
  <label className="text-[10px] text-shell-muted">Type</label>
  <div className="flex gap-1">
    {(['TAP','HOLD','SWIPE'] as const).map(t => (
      <button
        key={t}
        type="button"
        onClick={() => setNoteType(t)}
        className={
          'px-2 py-1 text-xs rounded border ' +
          (noteType === t
            ? 'bg-primary text-white border-primary'
            : 'border-shell-border text-shell-muted hover:text-shell-text')
        }
      >
        {t}
      </button>
    ))}
  </div>
</div>

{noteType === 'HOLD' && (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] text-shell-muted">Duration (seconds)</label>
    <input
      type="number"
      min={0.1}
      max={30}
      step={0.1}
      value={duration}
      onChange={(e) => setDuration(Number(e.target.value))}
      className="px-2 py-1 text-xs bg-shell-bg border border-shell-border rounded text-shell-text"
    />
  </div>
)}
```

- [ ] **Step 4: Include noteType + duration in mutate payload**

Where the popup calls `createNote.mutate(...)` or `updateNote.mutate(...)`, include the new fields:

```typescript
createNote.mutate({
  track,
  time,
  title,
  color,
  description,
  noteType,
  duration: noteType === 'HOLD' ? duration : undefined,
})
```

Same shape for update.

- [ ] **Step 5: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/NotePopup.tsx
git commit -m "feat(editor): NotePopup supports noteType + duration (HOLD only)"
```

---

## Task 21: Final verification

**Files:**
- (none — runs checks)

- [ ] **Step 1: Full type-check (api + web)**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && npx tsc --noEmit
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && npx tsc --noEmit
```

Expected: both `TypeScript: No errors found`.

- [ ] **Step 2: Backend tests**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && pnpm test
```

Expected: all tests pass (existing + new HOLD-guard test).

- [ ] **Step 3: Web tests**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && pnpm test
```

Expected: all tests pass (existing + new beat-calculator + beat-grid).

- [ ] **Step 4: Full monorepo build**

```bash
cd /Users/hohoanghvy/Projects/ama-midi && pnpm build
```

Expected: all packages build cleanly.

- [ ] **Step 5: Manual smoke**

1. Start dev server: `pnpm dev`
2. Open a song.
3. Edit BPM via toolbar widget → page reloads, beat grid changes density.
4. Toggle snap to Beat → click on grid → note snaps to nearest beat.
5. Switch active type to HOLD → drag down on grid → HOLD note created.
6. Switch to SWIPE → click → SWIPE note with arrow appears.
7. Open NotePopup on existing note → change type to HOLD, set duration → save.

- [ ] **Step 6: Commit if any final fixups**

```bash
git status
# fix anything broken, commit
```

---

## Acceptance Criteria (from spec)

- [x] Song has bpm (default 120) and timeSignature (default "4/4")
- [x] BPM widget in toolbar saves via `PATCH /songs/:id`
- [x] Beat + measure lines render on grid at correct positions
- [x] TimeAxis shows `Bar.Beat` below seconds
- [x] Snap toggle: 0.1s, Beat, ½Beat — click position snaps accordingly
- [x] TAP renders as current 16px circle
- [x] HOLD renders as cap + pill + tail with `duration * pxPerSecond` height (min 24px)
- [x] SWIPE renders as circle + right arrow
- [x] Fast-mode HOLD: drag down ≥ 4px → creates HOLD with computed duration
- [x] Popup mode has Type selector + Duration (HOLD only)
- [x] noteType + duration stored in DB
