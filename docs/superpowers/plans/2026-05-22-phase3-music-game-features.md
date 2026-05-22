# Phase 3 — Music Game Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform AMA-MIDI into a purpose-built music game level editor — BPM/beat grid, note types (tap/hold/swipe), difficulty overlay, game preview mode, pattern library, section markers, combo + difficulty stats.

**Architecture:** 4 Prisma migrations → 2 new NestJS modules (PatternModule, SectionModule) → extended engine functions → new React components. Each feature is independently usable.

**Tech Stack:** NestJS, Prisma, React 18, requestAnimationFrame (game preview), client-side difficulty computation.

**Spec:** `docs/superpowers/specs/2026-05-22-phase3-music-game-features.md`

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `apps/api/prisma/schema.prisma` | NoteType enum, note.noteType/duration, song.bpm/timeSignature, SectionMarker, NotePattern models |
| Modify | `packages/shared/src/types.ts` | Extend Note + Song, add SectionMarker + NotePattern types |
| Create | `apps/web/src/features/editor/engine/beat-calculator.ts` | BPM math functions |
| Create | `apps/web/src/features/editor/engine/difficulty-calculator.ts` | NPS + combo + difficulty rating |
| Modify | `apps/web/src/features/editor/engine/index.ts` | Export new engine functions |
| Modify | `apps/api/src/modules/songs/songs.service.ts` | Include bpm in Song CRUD |
| Modify | `apps/api/src/modules/notes/notes.service.ts` | Handle noteType + duration in create/update |
| Modify | `apps/api/src/modules/notes/dto/create-note.dto.ts` | Add noteType, duration fields |
| Modify | `apps/api/src/modules/notes/dto/update-note.dto.ts` | Add color, description, noteType fields |
| Create | `apps/api/src/modules/patterns/patterns.module.ts` | PatternModule |
| Create | `apps/api/src/modules/patterns/patterns.controller.ts` | GET/POST/DELETE /patterns |
| Create | `apps/api/src/modules/patterns/patterns.service.ts` | Pattern CRUD logic |
| Create | `apps/api/src/modules/sections/sections.module.ts` | SectionModule |
| Create | `apps/api/src/modules/sections/sections.controller.ts` | CRUD /songs/:id/sections |
| Create | `apps/api/src/modules/sections/sections.service.ts` | Section marker logic |
| Modify | `apps/api/src/app.module.ts` | Register PatternModule + SectionModule |
| Create | `apps/web/src/features/editor/components/TapNote.tsx` | 16px circle (existing NoteCircle logic extracted) |
| Create | `apps/web/src/features/editor/components/HoldNote.tsx` | Pill with circle cap |
| Create | `apps/web/src/features/editor/components/SwipeNote.tsx` | Circle + arrow |
| Modify | `apps/web/src/features/editor/components/NoteCircle.tsx` | Dispatch to Tap/Hold/Swipe based on noteType |
| Create | `apps/web/src/features/editor/components/DifficultyOverlay.tsx` | NPS heatmap bands |
| Create | `apps/web/src/features/editor/components/GamePreview.tsx` | Falling-note preview view |
| Create | `apps/web/src/features/editor/components/SectionMarkerLayer.tsx` | Colored section bands on grid |
| Modify | `apps/web/src/features/editor/components/GridLines.tsx` | Add beat/measure lines |
| Modify | `apps/web/src/features/editor/components/PianoRoll.tsx` | Integrate new components |
| Modify | `apps/web/src/store/editor.store.ts` | Add snapMode, showHeatmap, selectedNoteIds |
| Modify | `apps/web/src/features/editor/components/Toolbar.tsx` | BPM input, snap mode, heatmap toggle |
| Modify | `apps/web/src/pages/EditorPage.tsx` | Add Preview view mode, BottomBar stats |
| Create | `apps/web/src/features/patterns/usePatterns.ts` | Pattern CRUD hooks |
| Create | `apps/web/src/features/sections/useSections.ts` | Section CRUD hooks |

---

## Task 1: DB Migrations

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add NoteType enum + note fields**

```prisma
enum NoteType {
  TAP
  HOLD
  SWIPE
}
```

Inside `model Note {}`, after `color String`:
```prisma
noteType NoteType @default(TAP)
duration Float?
```

- [ ] **Step 2: Add BPM to Song**

Inside `model Song {}`, after `updatedAt DateTime @updatedAt`:
```prisma
bpm           Int    @default(120)
timeSignature String @default("4/4")
```

- [ ] **Step 3: Add SectionMarker model**

```prisma
model SectionMarker {
  id        String   @id @default(uuid())
  songId    String
  time      Float
  label     String
  color     String   @default("#6C63FF")
  createdBy String
  createdAt DateTime @default(now())

  song    Song @relation(fields: [songId], references: [id], onDelete: Cascade)
  creator User @relation(fields: [createdBy], references: [id])

  @@index([songId, time])
  @@map("section_markers")
}
```

Add `sectionMarkers SectionMarker[]` to Song model.

- [ ] **Step 4: Add NotePattern model**

```prisma
model NotePattern {
  id        String   @id @default(uuid())
  name      String
  notes     Json
  createdBy String
  songId    String?
  createdAt DateTime @default(now())

  creator User  @relation(fields: [createdBy], references: [id])
  song    Song? @relation(fields: [songId], references: [id], onDelete: SetNull)

  @@map("note_patterns")
}
```

Add `notePatterns NotePattern[]` to Song and User models.

- [ ] **Step 5: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name music_game_features
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: music game DB migrations — NoteType, bpm, SectionMarker, NotePattern"
```

---

## Task 2: Extend Shared Types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Extend Note type**

```typescript
export type NoteType = 'TAP' | 'HOLD' | 'SWIPE'

export interface Note {
  // existing fields +
  noteType:  NoteType
  duration?: number
}
```

- [ ] **Step 2: Extend Song type**

```typescript
export interface Song {
  // existing fields +
  bpm:           number
  timeSignature: string
}
```

- [ ] **Step 3: Add SectionMarker + NotePattern types**

```typescript
export interface SectionMarker {
  id:        string
  songId:    string
  time:      number
  label:     string
  color:     string
  createdBy: string
  createdAt: string
}

export interface NotePattern {
  id:        string
  name:      string
  notes:     PatternNote[]
  createdBy: string
  songId?:   string
  createdAt: string
}

export interface PatternNote {
  track:       number
  timeOffset:  number
  noteType:    NoteType
  color:       string
  duration?:   number
}
```

- [ ] **Step 4: Rebuild shared**

```bash
cd packages/shared && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: extend shared types — NoteType, Song.bpm, SectionMarker, NotePattern"
```

---

## Task 3: Beat Calculator Engine

**Files:**
- Create: `apps/web/src/features/editor/engine/beat-calculator.ts`
- Modify: `apps/web/src/features/editor/engine/index.ts`

- [ ] **Step 1: Create beat-calculator.ts**

```typescript
export function beatDuration(bpm: number): number {
  return 60 / bpm
}

export function measureDuration(bpm: number, beatsPerMeasure = 4): number {
  return beatDuration(bpm) * beatsPerMeasure
}

export function timeToBeat(time: number, bpm: number): { measure: number; beat: number } {
  const bd    = beatDuration(bpm)
  const total = Math.floor(time / bd)
  return {
    measure: Math.floor(total / 4) + 1,
    beat:    (total % 4) + 1,
  }
}

export function snapToBeat(time: number, bpm: number): number {
  const bd = beatDuration(bpm)
  return Math.round(time / bd) * bd
}

export function snapToHalfBeat(time: number, bpm: number): number {
  const hbd = beatDuration(bpm) / 2
  return Math.round(time / hbd) * hbd
}
```

- [ ] **Step 2: Write unit tests**

Create `apps/web/src/features/editor/engine/__tests__/beat-calculator.test.ts`:

```typescript
import { beatDuration, timeToBeat, snapToBeat } from '../beat-calculator'

describe('beatDuration', () => {
  it('returns 0.5s per beat at 120 BPM', () => {
    expect(beatDuration(120)).toBeCloseTo(0.5)
  })
  it('returns 1s per beat at 60 BPM', () => {
    expect(beatDuration(60)).toBe(1)
  })
})

describe('timeToBeat', () => {
  it('maps 0s to measure 1 beat 1 at 120BPM', () => {
    expect(timeToBeat(0, 120)).toEqual({ measure: 1, beat: 1 })
  })
  it('maps 2.0s to measure 2 beat 1 at 120BPM (4 beats = 2s)', () => {
    expect(timeToBeat(2.0, 120)).toEqual({ measure: 2, beat: 1 })
  })
})

describe('snapToBeat', () => {
  it('snaps 0.6s to nearest beat at 120BPM (0.5s)', () => {
    expect(snapToBeat(0.6, 120)).toBeCloseTo(0.5)
  })
  it('snaps 0.3s to beat 1 at 120BPM', () => {
    expect(snapToBeat(0.3, 120)).toBeCloseTo(0.5)
  })
})
```

Run: `cd apps/web && pnpm test --testPathPattern=beat-calculator`

- [ ] **Step 3: Export from engine/index.ts**

```typescript
// Add to existing exports:
export { beatDuration, measureDuration, timeToBeat, snapToBeat, snapToHalfBeat } from './beat-calculator'
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/engine/
git commit -m "feat: beat-calculator engine — beatDuration, timeToBeat, snapToBeat"
```

---

## Task 4: Difficulty Calculator Engine

**Files:**
- Create: `apps/web/src/features/editor/engine/difficulty-calculator.ts`

- [ ] **Step 1: Create file**

```typescript
import type { Note } from '@ama-midi/shared'

export function computeNpsOverTime(
  notes: Note[],
  windowSeconds = 2,
  resolution    = 0.5,
): Array<{ time: number; nps: number }> {
  const result: Array<{ time: number; nps: number }> = []
  for (let t = 0; t <= 300; t += resolution) {
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
  const sorted = [...notes].filter(n => !n.deletedAt).sort((a, b) => a.time - b.time)
  let max = 0, streak = 0, lastTime = -Infinity
  for (const note of sorted) {
    if (note.time - lastTime <= 2) {
      streak++
      max = Math.max(max, streak)
    } else {
      streak = 1
    }
    lastTime = note.time
  }
  return max
}

export function difficultyRating(notes: Note[]): 'Easy' | 'Normal' | 'Hard' | 'Expert' {
  if (notes.length === 0) return 'Easy'
  const avgNps = notes.length / 300
  if (avgNps < 2) return 'Easy'
  if (avgNps < 4) return 'Normal'
  if (avgNps < 7) return 'Hard'
  return 'Expert'
}
```

- [ ] **Step 2: Write unit tests**

Create `apps/web/src/features/editor/engine/__tests__/difficulty-calculator.test.ts`:

```typescript
import { maxCombo, difficultyRating } from '../difficulty-calculator'

describe('maxCombo', () => {
  it('returns 0 for empty notes', () => {
    expect(maxCombo([])).toBe(0)
  })
  it('counts consecutive notes within 2s gap', () => {
    const notes = [
      { time: 0 }, { time: 1 }, { time: 2 }, // streak 3
      { time: 10 },                            // break
      { time: 11 }, { time: 12 },              // streak 2
    ] as any[]
    expect(maxCombo(notes)).toBe(3)
  })
})

describe('difficultyRating', () => {
  it('Easy for < 2 avg NPS', () => {
    const notes = Array.from({ length: 100 }, (_, i) => ({ time: i * 3 })) as any[]
    expect(difficultyRating(notes)).toBe('Easy')
  })
  it('Expert for > 7 avg NPS', () => {
    const notes = Array.from({ length: 2200 }, (_, i) => ({ time: i * 0.13 })) as any[]
    expect(difficultyRating(notes)).toBe('Expert')
  })
})
```

Run: `cd apps/web && pnpm test --testPathPattern=difficulty-calculator`

- [ ] **Step 3: Export from engine/index.ts**

```typescript
export { computeNpsOverTime, npsToColor, maxCombo, difficultyRating } from './difficulty-calculator'
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/engine/
git commit -m "feat: difficulty-calculator engine — NPS, maxCombo, difficultyRating"
```

---

## Task 5: Extend DTOs + SongsService for BPM

**Files:**
- Modify: `apps/api/src/modules/notes/dto/create-note.dto.ts`
- Modify: `apps/api/src/modules/notes/dto/update-note.dto.ts`
- Modify: `apps/api/src/modules/songs/songs.service.ts`

- [ ] **Step 1: Extend CreateNoteDto**

```typescript
import { IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator'

export class CreateNoteDto {
  // existing fields (title, track, time, color, description) +

  @IsEnum(['TAP', 'HOLD', 'SWIPE'])
  @IsOptional()
  noteType?: 'TAP' | 'HOLD' | 'SWIPE'

  @IsNumber()
  @Min(0.1)
  @Max(30)
  @IsOptional()
  duration?: number
}
```

- [ ] **Step 2: Extend UpdateNoteDto**

```typescript
export class UpdateNoteDto {
  @IsString() @IsOptional() title?:       string
  @IsString() @IsOptional() description?: string
  @IsHexColor() @IsOptional() color?:     string
  @IsEnum(['TAP', 'HOLD', 'SWIPE']) @IsOptional() noteType?: string
  @IsNumber() @Min(0.1) @Max(30) @IsOptional() duration?: number
}
```

- [ ] **Step 3: Extend SongsService for BPM**

In `songs.service.ts`, extend `create()` to accept `bpm`:

```typescript
async create(name: string, user: AuthUser, bpm = 120): Promise<Song> {
  const s = await this.prisma.song.create({
    data: { name, createdBy: user.id, bpm },
    ...
  })
  return {
    ...
    bpm: s.bpm,
    timeSignature: s.timeSignature,
  }
}
```

Add `PATCH /songs/:id/bpm` endpoint in SongsController:

```typescript
@Patch(':id/bpm')
updateBpm(
  @Param('id') id: string,
  @Body('bpm') bpm: number,
  @Req() req: Request,
) {
  return this.songs.updateBpm(id, bpm, req.user as AuthUser)
}
```

In `SongsService`:
```typescript
async updateBpm(id: string, bpm: number, user: AuthUser): Promise<Song> {
  const existing = await this.prisma.song.findUnique({ where: { id } })
  if (!existing) throw new NotFoundException('Song not found')
  const s = await this.prisma.song.update({
    where: { id },
    data:  { bpm },
    include: { creator: { select: { name: true, avatarUrl: true } }, _count: { select: { notes: { where: { deletedAt: null } } } } },
  })
  return {
    id: s.id, name: s.name, createdBy: s.createdBy,
    creatorName: s.creator.name, creatorAvatarUrl: s.creator.avatarUrl ?? undefined,
    noteCount: s._count.notes, bpm: s.bpm, timeSignature: s.timeSignature,
    createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notes/dto/ apps/api/src/modules/songs/
git commit -m "feat: extend DTOs for noteType/duration, add PATCH /songs/:id/bpm"
```

---

## Task 6: Note Type Components

**Files:**
- Create: `apps/web/src/features/editor/components/TapNote.tsx`
- Create: `apps/web/src/features/editor/components/HoldNote.tsx`
- Create: `apps/web/src/features/editor/components/SwipeNote.tsx`
- Modify: `apps/web/src/features/editor/components/NoteCircle.tsx`

- [ ] **Step 1: Create TapNote (extract from existing NoteCircle)**

```typescript
// TapNote.tsx
import { cn } from '../../../lib/utils'
import type { Note } from '@ama-midi/shared'

interface Props {
  note:        Note
  x:           number
  y:           number
  isSelected:  boolean
  viewMode:    string
  ringClass:   string
  onClick:     (note: Note, e: React.MouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function TapNote({ note, x, y, isSelected, viewMode, ringClass, onClick, onMouseEnter, onMouseLeave }: Props) {
  return (
    <div
      className={cn(
        'absolute w-4 h-4 rounded-full cursor-pointer hover:scale-125 transition-transform animate-note-appear group',
        ringClass,
      )}
      style={{ left: x - 8, top: y - 8, backgroundColor: note.color }}
      onClick={(e) => onClick(note, e)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={`${note.title} | T${note.track} | ${note.time}s`}
    >
      {viewMode === 'developer' && (
        <div className="absolute top-0 left-0 text-[8px] font-mono text-white/90 whitespace-nowrap bg-black/50 px-0.5 rounded leading-none pointer-events-none select-none opacity-0 group-hover:opacity-100">
          {note.id.slice(0, 8)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create HoldNote**

```typescript
// HoldNote.tsx
import { cn } from '../../../lib/utils'
import type { Note } from '@ama-midi/shared'

interface Props {
  note:        Note
  x:           number
  y:           number
  tw:          number
  pxPerSecond: number
  ringClass:   string
  onClick:     (note: Note, e: React.MouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function HoldNote({ note, x, y, tw, pxPerSecond, ringClass, onClick, onMouseEnter, onMouseLeave }: Props) {
  const height = Math.max(24, (note.duration ?? 1) * pxPerSecond)
  const width  = tw / 3

  return (
    <div
      className={cn('absolute cursor-pointer group', ringClass)}
      style={{ left: x - width / 2, top: y - height, width }}
      onClick={(e) => onClick(note, e)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Body */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-full"
        style={{ height: height - 8, backgroundColor: note.color + 'B3' }}
      />
      {/* Top circle cap */}
      <div
        className="absolute inset-x-0 top-0 h-4 w-4 mx-auto rounded-full"
        style={{ backgroundColor: note.color }}
      />
      {/* Bottom circle */}
      <div
        className="absolute inset-x-0 bottom-0 h-2 w-2 mx-auto rounded-full"
        style={{ backgroundColor: note.color + '80' }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create SwipeNote**

```typescript
// SwipeNote.tsx
import { cn } from '../../../lib/utils'
import type { Note } from '@ama-midi/shared'

interface Props {
  note:        Note
  x:           number
  y:           number
  ringClass:   string
  onClick:     (note: Note, e: React.MouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function SwipeNote({ note, x, y, ringClass, onClick, onMouseEnter, onMouseLeave }: Props) {
  return (
    <div
      className={cn('absolute flex items-center cursor-pointer', ringClass)}
      style={{ left: x - 10, top: y - 8 }}
      onClick={(e) => onClick(note, e)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="w-4 h-4 rounded-full"
        style={{ backgroundColor: note.color }}
      />
      {/* Arrow */}
      <div
        className="w-0 h-0 ml-0.5"
        style={{
          borderTop:    '4px solid transparent',
          borderBottom: '4px solid transparent',
          borderLeft:   `6px solid ${note.color}`,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Update NoteCircle to dispatch by noteType**

```typescript
// NoteCircle.tsx — inside render, replace current circle JSX:
import { TapNote }   from './TapNote'
import { HoldNote }  from './HoldNote'
import { SwipeNote } from './SwipeNote'

// After computing x, y, ringClass, hovered:
const noteEl = note.noteType === 'HOLD' ? (
  <HoldNote
    note={note} x={cx} y={cy} tw={tw} pxPerSecond={pxPerSecond}
    ringClass={ringClass}
    onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
  />
) : note.noteType === 'SWIPE' ? (
  <SwipeNote
    note={note} x={cx} y={cy}
    ringClass={ringClass}
    onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
  />
) : (
  <TapNote
    note={note} x={cx} y={cy}
    isSelected={isSelected} viewMode={viewMode} ringClass={ringClass}
    onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
  />
)

return (
  <>
    {noteEl}
    {hovered && <NoteTooltip note={note} position={{ x: cx, y: cy - 24 }} />}
  </>
)
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/
git commit -m "feat: note type components — TapNote, HoldNote, SwipeNote"
```

---

## Task 7: BPM Beat Grid

**Files:**
- Modify: `apps/web/src/features/editor/components/GridLines.tsx`

- [ ] **Step 1: Accept bpm prop and render beat lines**

```typescript
import type { VirtualItem } from '@tanstack/react-virtual'
import { beatDuration, measureDuration } from '../engine'

export interface GridLinesProps {
  virtualItems: VirtualItem[]
  gridWidth:    number
  trackCount?:  number
  bpm?:         number
  pxPerSecond:  number
}

export function GridLines({ virtualItems, gridWidth, trackCount = 8, bpm, pxPerSecond }: GridLinesProps) {
  const tw = gridWidth / trackCount
  const bd = bpm ? beatDuration(bpm) * pxPerSecond     : null  // px per beat
  const md = bpm ? measureDuration(bpm) * pxPerSecond  : null  // px per measure

  return (
    <>
      {/* Virtualized time lines */}
      {virtualItems.map((row) => {
        const isBold   = row.index % 10 === 0
        const isBeat   = bd && row.start % Math.round(bd) < 1
        const isMeasure = md && row.start % Math.round(md) < 1
        return (
          <div
            key={row.index}
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top:    row.start,
              height: 1,
              background: isMeasure
                ? 'rgba(255,255,255,0.18)'
                : isBeat
                  ? 'rgba(255,255,255,0.08)'
                  : isBold
                    ? 'var(--canvas-grid-bold)'
                    : 'var(--canvas-grid)',
            }}
          />
        )
      })}

      {/* Vertical track dividers */}
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

- [ ] **Step 2: Pass bpm from EditorPage → PianoRoll → GridLines**

In `PianoRoll.tsx`, accept `bpm` prop. Pass to `<GridLines bpm={bpm} pxPerSecond={pxPerSecond} ...>`.

In `EditorPage.tsx`, get `song.bpm` from `useQuery(['song', songId])` and pass to PianoRoll.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/GridLines.tsx
git commit -m "feat: GridLines beat/measure lines when BPM provided"
```

---

## Task 8: BPM Toolbar Controls

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx`

- [ ] **Step 1: Add snapMode to editor store**

```typescript
// editor.store.ts interface + defaults:
snapMode:    '0.1s' | 'beat' | 'halfbeat'
setSnapMode: (mode: '0.1s' | 'beat' | 'halfbeat') => void
showHeatmap: boolean
setShowHeatmap: (v: boolean) => void
selectedNoteIds: Set<string>
setSelectedNoteIds: (ids: Set<string>) => void

// defaults:
snapMode:        '0.1s',
setSnapMode:     (snapMode) => set({ snapMode }),
showHeatmap:     false,
setShowHeatmap:  (showHeatmap) => set({ showHeatmap }),
selectedNoteIds: new Set(),
setSelectedNoteIds: (selectedNoteIds) => set({ selectedNoteIds }),
```

- [ ] **Step 2: Add BPM + snap controls to Toolbar**

```tsx
// In Toolbar CENTER zone, after zoom group:
<div className="flex items-center gap-1 text-xs">
  <span className="text-canvas-muted">♩</span>
  <input
    type="number"
    value={bpm}
    min={40} max={300}
    onChange={e => onBpmChange(Number(e.target.value))}
    className="w-12 bg-transparent text-canvas-text border-b border-canvas-border text-center focus:outline-none text-xs"
  />
</div>

<ToggleGroup
  items={[
    { value: '0.1s',     label: '0.1s' },
    { value: 'beat',     label: 'Beat' },
    { value: 'halfbeat', label: '½' },
  ]}
  value={snapMode}
  onValueChange={(v) => setSnapMode(v as any)}
  variant="canvas"
/>

<IconButton
  size="sm"
  onClick={() => setShowHeatmap(!showHeatmap)}
  tooltip="Difficulty heatmap"
  className={showHeatmap ? 'text-warning' : 'text-canvas-muted'}
>
  🔥
</IconButton>
```

Toolbar props extended:
```typescript
bpm:         number
onBpmChange: (bpm: number) => void
```

EditorPage passes `onBpmChange={bpm => apiClient(token)(`/songs/${songId}/bpm`, { method: 'PATCH', body: JSON.stringify({ bpm }) })}`.

- [ ] **Step 3: Apply snap mode in yToTime**

In `PianoRoll.tsx`, `handleMouseMove`:

```typescript
const { snapMode } = useEditorStore()
const song = useSongQuery(songId)  // useQuery for song data

function snapTime(raw: number): number {
  if (snapMode === 'beat' && song?.bpm) return snapToBeat(raw, song.bpm)
  if (snapMode === 'halfbeat' && song?.bpm) return snapToHalfBeat(raw, song.bpm)
  return yToTime(raw, pxPerSecond)  // existing 0.1s snap
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/store/editor.store.ts apps/web/src/features/editor/components/Toolbar.tsx apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "feat: BPM toolbar input, snap modes, heatmap toggle"
```

---

## Task 9: Difficulty Overlay

**Files:**
- Create: `apps/web/src/features/editor/components/DifficultyOverlay.tsx`

- [ ] **Step 1: Create file**

```typescript
import { useMemo } from 'react'
import { computeNpsOverTime, npsToColor } from '../engine'
import { timeToY } from '../engine'
import type { Note } from '@ama-midi/shared'

interface Props {
  notes:       Note[]
  pxPerSecond: number
  timeFrom:    number
  timeTo:      number
}

export function DifficultyOverlay({ notes, pxPerSecond, timeFrom, timeTo }: Props) {
  const npsData = useMemo(
    () => computeNpsOverTime(notes).filter(d => d.time >= timeFrom && d.time <= timeTo),
    [notes, timeFrom, timeTo],
  )

  return (
    <>
      {npsData.map(({ time, nps }) => (
        <div
          key={time}
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            top:             timeToY(time, pxPerSecond),
            height:          0.5 * pxPerSecond,
            backgroundColor: npsToColor(nps),
          }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Render inside PianoRoll when showHeatmap is true**

In `PianoRoll.tsx`:

```tsx
import { DifficultyOverlay } from './DifficultyOverlay'

// In scrollable grid, after GridLines:
{showHeatmap && (
  <DifficultyOverlay
    notes={notes}
    pxPerSecond={pxPerSecond}
    timeFrom={timeFrom}
    timeTo={timeTo}
  />
)}
```

Get `showHeatmap` from `useEditorStore()`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/DifficultyOverlay.tsx
git commit -m "feat: DifficultyOverlay — NPS heatmap bands on grid"
```

---

## Task 10: Game Preview Mode

**Files:**
- Create: `apps/web/src/features/editor/components/GamePreview.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Create GamePreview component**

```typescript
import { useEffect, useRef } from 'react'
import { useEditorStore } from '../../../store/editor.store'
import { trackToX, trackWidth, timeToY } from '../engine'
import type { Note } from '@ama-midi/shared'

interface Props {
  notes:       Note[]
  gridWidth:   number
  pxPerSecond: number
}

export function GamePreview({ notes, gridWidth, pxPerSecond }: Props) {
  const { isPlaying, playheadTime } = useEditorStore()
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll viewport so notes arrive at hit zone (bottom 10%)
  useEffect(() => {
    if (!containerRef.current || !isPlaying) return
    const vh     = containerRef.current.clientHeight
    const target = timeToY(playheadTime, pxPerSecond) - vh * 0.85
    containerRef.current.scrollTop = Math.max(0, target)
  }, [playheadTime, pxPerSecond, isPlaying])

  const totalHeight = 300 * pxPerSecond
  const tw          = trackWidth(gridWidth)

  return (
    <div className="flex flex-col h-full bg-canvas-bg relative overflow-hidden">
      {/* Track headers */}
      <div className="flex h-8 border-b border-canvas-border bg-canvas-surface shrink-0">
        {Array.from({ length: 8 }, (_, i) => i + 1).map(t => (
          <div key={t} className="flex-1 flex items-center justify-center text-xs text-canvas-muted border-r border-canvas-border">
            T{t}
          </div>
        ))}
      </div>

      {/* Scrollable area */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <div className="relative" style={{ height: totalHeight }}>

          {/* Notes */}
          {notes.map(note => {
            const x = trackToX(note.track, gridWidth) + tw / 2
            const y = timeToY(note.time, pxPerSecond)
            return (
              <div
                key={note.id}
                className="absolute w-14 h-8 rounded-lg flex items-center justify-center text-xs text-white font-medium"
                style={{
                  left:            x - 28,
                  top:             y - 16,
                  backgroundColor: note.color,
                  boxShadow:       `0 0 12px ${note.color}66`,
                }}
              >
                T{note.track}
              </div>
            )
          })}

          {/* Playhead line */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-primary z-10 pointer-events-none"
            style={{ top: timeToY(playheadTime, pxPerSecond) }}
          />
        </div>
      </div>

      {/* Hit zone */}
      <div className="h-[10%] border-t-2 border-primary/50 bg-primary/5 shrink-0 flex">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex-1 border-r border-primary/20" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Preview to view mode switcher**

In `Toolbar.tsx`:

```typescript
const VIEW_MODES = [
  { value: 'composer', label: 'Composer' },
  { value: 'developer', label: 'Dev' },
  { value: 'qa', label: 'QA' },
  { value: 'preview', label: 'Preview' },  // ADD
]
```

Update `ViewMode` type in `editor.store.ts`:
```typescript
type ViewMode = 'composer' | 'developer' | 'qa' | 'preview'
```

- [ ] **Step 3: Render GamePreview in EditorPage when viewMode is 'preview'**

```tsx
// In EditorPage, where PianoRoll is rendered:
{viewMode === 'preview' ? (
  <GamePreview notes={notes ?? []} gridWidth={800} pxPerSecond={pxPerSecond} />
) : (
  <PianoRoll ... />
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/GamePreview.tsx apps/web/src/store/editor.store.ts apps/web/src/pages/EditorPage.tsx
git commit -m "feat: Game Preview mode — falling notes, hit zone, follows playhead"
```

---

## Task 11: PatternModule Backend

**Files:**
- Create: `apps/api/src/modules/patterns/patterns.service.ts`
- Create: `apps/api/src/modules/patterns/patterns.controller.ts`
- Create: `apps/api/src/modules/patterns/patterns.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create PatternsService**

```typescript
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser, NotePattern } from '@ama-midi/shared'

@Injectable()
export class PatternsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<NotePattern[]> {
    const patterns = await this.prisma.notePattern.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
    })
    return patterns.map(p => ({
      id:        p.id,
      name:      p.name,
      notes:     p.notes as NotePattern['notes'],
      createdBy: p.createdBy,
      songId:    p.songId ?? undefined,
      createdAt: p.createdAt.toISOString(),
    }))
  }

  async create(
    dto: { name: string; notes: NotePattern['notes']; songId?: string },
    user: AuthUser,
  ): Promise<NotePattern> {
    const p = await this.prisma.notePattern.create({
      data: { name: dto.name, notes: dto.notes as object, createdBy: user.id, songId: dto.songId ?? null },
    })
    return {
      id: p.id, name: p.name, notes: p.notes as NotePattern['notes'],
      createdBy: p.createdBy, songId: p.songId ?? undefined,
      createdAt: p.createdAt.toISOString(),
    }
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    const p = await this.prisma.notePattern.findUnique({ where: { id } })
    if (!p) throw new NotFoundException('Pattern not found')
    if (p.createdBy !== user.id) throw new ForbiddenException()
    await this.prisma.notePattern.delete({ where: { id } })
  }
}
```

- [ ] **Step 2: Create PatternsController**

```typescript
import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { PatternsService } from './patterns.service'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('patterns')
@UseGuards(AuthGuard('jwt'))
export class PatternsController {
  constructor(private readonly patterns: PatternsService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.patterns.findAll((req.user as AuthUser).id)
  }

  @Post()
  create(@Body() body: { name: string; notes: any[]; songId?: string }, @Req() req: Request) {
    return this.patterns.create(body, req.user as AuthUser)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.patterns.remove(id, req.user as AuthUser)
  }
}
```

- [ ] **Step 3: Create module + register**

```typescript
// patterns.module.ts
import { Module } from '@nestjs/common'
import { PatternsController } from './patterns.controller'
import { PatternsService }    from './patterns.service'
import { PrismaModule }       from '../prisma/prisma.module'
import { AuthModule }         from '../auth/auth.module'

@Module({ imports: [PrismaModule, AuthModule], controllers: [PatternsController], providers: [PatternsService] })
export class PatternsModule {}
```

Register in `app.module.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/patterns/ apps/api/src/app.module.ts
git commit -m "feat: PatternModule — GET/POST/DELETE /patterns"
```

---

## Task 12: Pattern Library Frontend

**Files:**
- Create: `apps/web/src/features/patterns/usePatterns.ts`
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Create usePatterns hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../auth/api'
import type { NotePattern, PatternNote } from '@ama-midi/shared'

export function usePatterns() {
  const token = useAuthStore(s => s.token)
  return useQuery<NotePattern[]>({
    queryKey: ['patterns'],
    queryFn:  () => apiClient(token)<NotePattern[]>('/patterns'),
    enabled:  !!token,
  })
}

export function useSavePattern() {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (dto: { name: string; notes: PatternNote[]; songId?: string }) =>
      apiClient(token)<NotePattern>('/patterns', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  })
}

export function usePastePattern(songId: string) {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()

  return async (pattern: NotePattern, atTime: number) => {
    let success = 0, conflict = 0
    for (const n of pattern.notes) {
      try {
        await apiClient(token)<any>(`/songs/${songId}/notes`, {
          method: 'POST',
          body: JSON.stringify({
            track:    n.track,
            time:     Math.round((atTime + n.timeOffset) * 10) / 10,
            title:    'Pattern Note',
            color:    n.color,
            noteType: n.noteType,
            duration: n.duration,
          }),
        })
        success++
      } catch (e: any) {
        if (e.status === 409) conflict++
      }
    }
    qc.invalidateQueries({ queryKey: ['notes', songId] })
    if (conflict > 0) {
      toast.warning(`Pasted ${success}/${pattern.notes.length} notes (${conflict} conflicts)`)
    } else {
      toast.success(`Pasted ${success} notes`)
    }
  }
}
```

- [ ] **Step 2: Add multi-select + save pattern UI**

In `EditorPage.tsx`, add shift+click multi-select (tracked in `selectedNoteIds` from store).

When `selectedNoteIds.size >= 2`, show in Toolbar:

```tsx
{selectedNoteIds.size >= 2 && (
  <div className="flex items-center gap-2">
    <span className="text-xs text-canvas-muted">{selectedNoteIds.size} selected</span>
    <Button variant="secondary" size="sm" onClick={handleSavePattern}>📋 Save</Button>
    <IconButton size="sm" onClick={() => setSelectedNoteIds(new Set())}>✕</IconButton>
  </div>
)}
```

`handleSavePattern` opens a small modal for pattern name, then calls `useSavePattern()`.

- [ ] **Step 3: Pattern list in right panel Tracks tab**

At bottom of Tracks tab:

```tsx
<div className="px-3 py-2 border-t border-shell-border">
  <p className="text-xs font-medium text-shell-muted mb-2 uppercase tracking-wide">Patterns</p>
  {patterns?.map(p => (
    <div key={p.id} className="flex items-center justify-between py-1">
      <span className="text-xs text-shell-text truncate">{p.name} ({p.notes.length})</span>
      <Button
        variant="ghost" size="sm"
        onClick={() => pastePattern(p, playheadTime)}
      >
        Paste
      </Button>
    </div>
  ))}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/patterns/ apps/web/src/pages/EditorPage.tsx
git commit -m "feat: pattern library — multi-select, save, paste with conflict report"
```

---

## Task 13: SectionModule Backend

**Files:**
- Create: `apps/api/src/modules/sections/sections.service.ts`
- Create: `apps/api/src/modules/sections/sections.controller.ts`
- Create: `apps/api/src/modules/sections/sections.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create SectionsService**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser, SectionMarker } from '@ama-midi/shared'

@Injectable()
export class SectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySong(songId: string): Promise<SectionMarker[]> {
    const rows = await this.prisma.sectionMarker.findMany({
      where:   { songId },
      orderBy: { time: 'asc' },
    })
    return rows.map(r => ({
      id: r.id, songId: r.songId, time: r.time,
      label: r.label, color: r.color, createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  async create(songId: string, dto: { time: number; label: string; color?: string }, user: AuthUser): Promise<SectionMarker> {
    const r = await this.prisma.sectionMarker.create({
      data: { songId, time: dto.time, label: dto.label, color: dto.color ?? '#6C63FF', createdBy: user.id },
    })
    return { id: r.id, songId: r.songId, time: r.time, label: r.label, color: r.color, createdBy: r.createdBy, createdAt: r.createdAt.toISOString() }
  }

  async remove(id: string): Promise<void> {
    const r = await this.prisma.sectionMarker.findUnique({ where: { id } })
    if (!r) throw new NotFoundException('Section not found')
    await this.prisma.sectionMarker.delete({ where: { id } })
  }
}
```

- [ ] **Step 2: Create SectionsController**

```typescript
import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SectionsService } from './sections.service'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs/:songId/sections')
@UseGuards(AuthGuard('jwt'))
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get()
  findAll(@Param('songId') songId: string) {
    return this.sections.findBySong(songId)
  }

  @Post()
  create(
    @Param('songId') songId: string,
    @Body() body: { time: number; label: string; color?: string },
    @Req() req: Request,
  ) {
    return this.sections.create(songId, body, req.user as AuthUser)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sections.remove(id)
  }
}
```

- [ ] **Step 3: Create module + register**

```typescript
// sections.module.ts
import { Module } from '@nestjs/common'
import { SectionsController } from './sections.controller'
import { SectionsService }    from './sections.service'
import { PrismaModule }       from '../prisma/prisma.module'
import { AuthModule }         from '../auth/auth.module'

@Module({ imports: [PrismaModule, AuthModule], controllers: [SectionsController], providers: [SectionsService] })
export class SectionsModule {}
```

Register in `app.module.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/sections/ apps/api/src/app.module.ts
git commit -m "feat: SectionModule — GET/POST/DELETE /songs/:id/sections"
```

---

## Task 14: Section Markers Frontend

**Files:**
- Create: `apps/web/src/features/sections/useSections.ts`
- Create: `apps/web/src/features/editor/components/SectionMarkerLayer.tsx`
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Create useSections hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth.store'
import { apiClient }   from '../auth/api'
import type { SectionMarker } from '@ama-midi/shared'

export function useSections(songId: string) {
  const token = useAuthStore(s => s.token)
  return useQuery<SectionMarker[]>({
    queryKey: ['sections', songId],
    queryFn:  () => apiClient(token)<SectionMarker[]>(`/songs/${songId}/sections`),
    enabled:  !!token && !!songId,
  })
}

export function useCreateSection(songId: string) {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (dto: { time: number; label: string; color?: string }) =>
      apiClient(token)<SectionMarker>(`/songs/${songId}/sections`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', songId] }),
  })
}
```

- [ ] **Step 2: Create SectionMarkerLayer**

```typescript
import { timeToY } from '../engine'
import type { SectionMarker } from '@ama-midi/shared'

interface Props {
  sections:    SectionMarker[]
  pxPerSecond: number
}

export function SectionMarkerLayer({ sections, pxPerSecond }: Props) {
  return (
    <>
      {sections.map(s => {
        const y = timeToY(s.time, pxPerSecond)
        return (
          <div
            key={s.id}
            className="absolute left-0 right-0 flex items-center gap-2 px-2 pointer-events-none"
            style={{
              top:             y,
              height:          20,
              backgroundColor: s.color + '22',
              borderTop:       `2px solid ${s.color}`,
              zIndex:          5,
            }}
          >
            <span className="text-[10px] font-semibold select-none" style={{ color: s.color }}>
              {s.label}
            </span>
          </div>
        )
      })}
    </>
  )
}
```

- [ ] **Step 3: Add to PianoRoll**

```tsx
import { SectionMarkerLayer } from './SectionMarkerLayer'

// Pass sections from EditorPage as prop to PianoRoll
// Inside scrollable grid, after GridLines:
<SectionMarkerLayer sections={sections} pxPerSecond={pxPerSecond} />
```

- [ ] **Step 4: Click on time axis to add section**

In `TimeAxis.tsx`, add `onClick` prop:

```typescript
// TimeAxis accepts: onAddSection?: (time: number) => void
// On div click: compute time from Y and call onAddSection

<div
  ...
  onClick={(e) => {
    if (!onAddSection) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y    = e.clientY - rect.top
    const time = Math.round((y / pxPerSecond) * 10) / 10
    onAddSection(time)
  }}
>
```

EditorPage shows a small label picker dropdown after `onAddSection` fires.

- [ ] **Step 5: Section list in right panel**

In Tracks tab, add below density bars:

```tsx
<div className="px-3 py-2 border-t border-shell-border">
  <p className="text-xs font-medium text-shell-muted mb-1 uppercase tracking-wide">Sections</p>
  {sections?.map(s => (
    <div
      key={s.id}
      className="flex items-center gap-2 py-1 cursor-pointer hover:bg-shell-bg rounded px-1"
      onClick={() => { setPlayheadTime(s.time) }}
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
      <span className="text-xs text-shell-text truncate">{s.label}</span>
      <span className="text-[9px] text-shell-muted ml-auto">{s.time}s</span>
    </div>
  ))}
</div>
```

- [ ] **Step 6: Current section in LiveContextStrip**

In `LiveContextStrip.tsx`, accept `sections` prop:

```typescript
// Find current section (last section marker before playheadTime):
const currentSection = sections
  ?.filter(s => s.time <= playheadTime)
  .sort((a, b) => b.time - a.time)[0]

// Show in strip:
{currentSection && (
  <span className="text-[10px] font-medium" style={{ color: currentSection.color }}>
    {currentSection.label}
  </span>
)}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/sections/ apps/web/src/features/editor/components/
git commit -m "feat: section markers — timeline bands, jump list, click-to-add on time axis"
```

---

## Task 15: Combo + Difficulty BottomBar

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Add stats to BottomBar**

In `EditorPage.tsx`, import and compute:

```typescript
import { maxCombo, difficultyRating } from '../features/editor/engine'
import { timeToBeat } from '../features/editor/engine'

// In component:
const combo      = useMemo(() => maxCombo(notes ?? []),      [notes])
const difficulty = useMemo(() => difficultyRating(notes ?? []), [notes])
const beat       = useMemo(() => timeToBeat(playheadTime, song?.bpm ?? 120), [playheadTime, song?.bpm])

const difficultyColor = {
  Easy:   'text-success',
  Normal: 'text-info',
  Hard:   'text-warning',
  Expert: 'text-error',
}[difficulty]
```

BottomBar JSX:

```tsx
<footer className="shrink-0 flex items-center gap-4 border-t border-shell-border bg-shell-surface px-4 h-10">
  <span className="text-xs font-mono text-shell-muted">{formatTime(playheadTime)}</span>
  <span className="text-xs text-shell-muted">Bar {beat.measure}·{beat.beat}</span>

  <div className="ml-auto flex items-center gap-4">
    <span className={`text-xs font-medium ${difficultyColor}`}>♦ {difficulty}</span>
    <span className="text-xs text-shell-muted">Combo ×{combo}</span>
    {errCount > 0 && (
      <span className="text-xs text-warning">{errCount} warn</span>
    )}
  </div>
</footer>
```

- [ ] **Step 2: Write unit test for combo**

```typescript
// In difficulty-calculator.test.ts (add to existing):
it('returns max combo of 5 for 5 consecutive notes within 2s', () => {
  const notes = [
    { time: 1.0 }, { time: 1.5 }, { time: 2.0 },
    { time: 2.5 }, { time: 3.0 },   // streak 5
    { time: 10.0 },                  // break
  ] as any[]
  expect(maxCombo(notes)).toBe(5)
})
```

Run: `cd apps/web && pnpm test --testPathPattern=difficulty-calculator`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat: BottomBar — difficulty rating, max combo, bar/beat position"
```

---

## Task 16: Final Build + Verification

- [ ] **Step 1: Build check**

```bash
pnpm build
```

Expected: zero TypeScript errors across all packages.

- [ ] **Step 2: Manual checklist**

**BPM + Beat Grid:**
- [ ] BPM input in toolbar, change saves to DB
- [ ] Beat lines visible at correct positions on grid
- [ ] Measure lines bolder than beat lines
- [ ] Snap-to-beat places note on beat boundary

**Note Types:**
- [ ] TAP = circle, HOLD = pill, SWIPE = circle+arrow
- [ ] Popup mode shows type selector
- [ ] HOLD duration stored and renders correct height

**Difficulty Overlay:**
- [ ] 🔥 toggle shows/hides colored bands
- [ ] Green = easy zone, red = dense zone

**Game Preview:**
- [ ] "Preview" in view mode switcher
- [ ] Notes fall downward
- [ ] Hit zone at bottom
- [ ] Play follows viewport

**Patterns:**
- [ ] Shift+click selects multiple notes
- [ ] Save pattern → appears in list
- [ ] Paste at playhead position

**Sections:**
- [ ] Click time axis → label picker → band appears on grid
- [ ] Jump to section from list
- [ ] LiveContextStrip shows current section name

**Combo + Difficulty:**
- [ ] BottomBar shows ♦ difficulty rating
- [ ] Combo count updates as notes added

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "feat: Phase 3 complete — music game features (BPM, note types, difficulty, preview, patterns, sections)"
```
