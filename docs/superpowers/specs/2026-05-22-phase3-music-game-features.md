# Phase 3 — Music Game Features

**Date:** 2026-05-22
**Scope:** Major DB migrations + new modules + significant frontend additions.
**Goal:** Transform AMA-MIDI from a generic note sequencer into a purpose-built music game level editor.

---

## Overview

| Feature | DB change | Backend | Frontend |
|---|---|---|---|
| BPM + Beat Grid | `songs.bpm`, `songs.timeSignature` | Song CRUD extended | Grid beat lines, time axis dual labels, snap modes |
| Note Types | `notes.noteType`, `notes.duration` | Note CRUD extended | TAP/HOLD/SWIPE rendering, hold drag |
| Difficulty Curve | None | None | Client-side NPS heatmap overlay |
| Game Preview Mode | None | None | 4th view mode, falling notes |
| Pattern Library | `note_patterns` table | New PatternModule | Select, save, paste patterns |
| Section Markers | `section_markers` table | New SectionModule | Timeline bands, jump list |
| Combo + Difficulty | None | None | Client-side BottomBar stats |

---

## DB Migrations

### Migration 1 — Song BPM

```prisma
model Song {
  // existing +
  bpm           Int    @default(120)
  timeSignature String @default("4/4")
}
```

### Migration 2 — Note Types

```prisma
enum NoteType {
  TAP
  HOLD
  SWIPE
}

model Note {
  // existing +
  noteType NoteType @default(TAP)
  duration Float?   // seconds, HOLD only. null for TAP and SWIPE.
}
```

### Migration 3 — Section Markers

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

### Migration 4 — Note Patterns

```prisma
model NotePattern {
  id        String   @id @default(uuid())
  name      String
  notes     Json
  createdBy String
  songId    String?  // null = global (user's own library)
  createdAt DateTime @default(now())

  creator User  @relation(fields: [createdBy], references: [id])
  song    Song? @relation(fields: [songId], references: [id], onDelete: SetNull)

  @@map("note_patterns")
}
```

Pattern `notes` JSON shape:
```typescript
// Each note is relative — timeOffset from pattern start
type PatternNote = {
  track:      number   // 1–8
  timeOffset: number   // seconds from pattern start (0.0+)
  noteType:   NoteType
  color:      string
  duration?:  number   // HOLD only
}
```

---

## Feature 1 — BPM + Beat Grid

### Song type extended

```typescript
// shared/types.ts
export interface Song {
  // existing +
  bpm:           number   // default 120
  timeSignature: string   // default "4/4"
}
```

### Beat computation

```typescript
// engine/beat-calculator.ts
export function beatDuration(bpm: number): number {
  return 60 / bpm
}

export function measureDuration(bpm: number, timeSignature: string): number {
  const [beats] = timeSignature.split('/').map(Number)
  return beatDuration(bpm) * beats
}

export function timeToBeat(time: number, bpm: number): { measure: number; beat: number } {
  const bd    = beatDuration(bpm)
  const total = Math.floor(time / bd)
  return {
    measure: Math.floor(total / 4) + 1,
    beat:    (total % 4) + 1,
  }
}

export function beatToTime(measure: number, beat: number, bpm: number): number {
  return ((measure - 1) * 4 + (beat - 1)) * beatDuration(bpm)
}
```

### BPM in toolbar

```
[← Song Name]  [⏮ ▶ ⏭  00:04.2s  ♩120▾  Beat  1x 2x 4x  Composer Dev QA Preview]  [✨ ...]
```

- `♩120` — click to open inline number input, blur to save via `PATCH /songs/:id { bpm }`
- Beat indicator: `Bar 2·3` updates live with playhead

### Grid beat lines

GridLines component extended to render beat/measure lines when `bpm` is provided:

- **Beat lines:** thin, `rgba(255,255,255,0.04)`, every `beatDuration(bpm)` pixels
- **Measure lines:** medium, `rgba(255,255,255,0.10)`, every `measureDuration(bpm)` pixels
- **Second lines:** existing behavior unchanged

All still virtualized via `virtualItems` from `useVirtualizer`.

### Time axis dual labels

```
┌──────┐
│  0s  │  ← seconds (existing)
│  1.1 │  ← bar.beat (new, smaller font)
│  1s  │
│  1.2 │
│  2s  │
│  1.3 │
│  3s  │
│  1.4 │
│  4s  │
│  2.1 │  ← measure boundary (bold)
└──────┘
```

### Snap modes

Three snap options added to toolbar (small toggle group):

```
Snap: [0.1s]  [Beat]  [½Beat]
```

- `0.1s` — existing behavior
- `Beat` — `yToTime` snaps to nearest beat boundary
- `½Beat` — snaps to nearest half-beat

`snapMode` added to `useEditorStore()`.

---

## Feature 2 — Note Types

### Rendering

**TAP** (existing): 16px circle, `backgroundColor: note.color`

**HOLD:**
```
   ●  ← circle cap (16px, note.color)
   │
   │  ← pill body (trackWidth/3 wide, note.color at 70% opacity)
   │
   ●  ← circle base (8px, note.color at 50% opacity)
```
Height = `duration * pxPerSecond`. Minimum 24px.

**SWIPE:**
```
   ●→  ← circle + arrow pointing right (default direction)
```
Arrow rendered as CSS border triangle. Direction always right in V1.

### NoteCircle extended

```typescript
export interface NoteCircleProps {
  // existing +
  // noteType and duration are on the Note object itself
}

// Inside NoteCircle:
if (note.noteType === 'HOLD') {
  return <HoldNote note={note} ... />
}
if (note.noteType === 'SWIPE') {
  return <SwipeNote note={note} ... />
}
return <TapNote note={note} ... />  // existing circle
```

### Creating note types

**Fast mode:** creates TAP only (unchanged).

**Popup mode:** adds Type selector:
```
Type: [● TAP]  [│ HOLD]  [→ SWIPE]
Duration: [____] s   ← shown only when HOLD selected
```

**Hold drag (fast mode):** click + hold + drag downward:
- On mousedown: start tracking
- On mousemove while held: show ghost hold note extending downward
- On mouseup: create HOLD note with `duration = dragDistance / pxPerSecond`

### API changes

`CreateNoteDto` extended:
```typescript
export class CreateNoteDto {
  // existing +
  @IsEnum(NoteType) @IsOptional() noteType?: NoteType
  @IsNumber() @Min(0.1) @Max(30) @IsOptional() duration?: number
}
```

---

## Feature 3 — Difficulty Curve Overlay

No API calls. Client-side only.

### Computation

```typescript
// engine/difficulty-calculator.ts
export function computeNpsOverTime(
  notes: Note[],
  windowSeconds = 2,
  resolution = 0.5,   // compute every 0.5s
): Array<{ time: number; nps: number }> {
  const result = []
  for (let t = 0; t <= 300; t += resolution) {
    const count = notes.filter(
      n => n.time >= t - windowSeconds / 2 && n.time < t + windowSeconds / 2
    ).length
    result.push({ time: t, nps: count / windowSeconds })
  }
  return result
}

export function npsToColor(nps: number): string {
  if (nps < 3) return 'rgba(16, 185, 129, 0.15)'   // green
  if (nps < 6) return 'rgba(245, 158, 11, 0.20)'   // yellow
  return 'rgba(239, 68, 68, 0.25)'                   // red
}
```

### Rendering

Toggle button in toolbar: `⬛ Heatmap` (off) → `🔥 Heatmap` (on).

When enabled, render horizontal colored bands as absolute-positioned divs inside the grid's scrollable area:

```typescript
// One div per 0.5s resolution bucket:
{npsData.map(({ time, nps }) => (
  <div
    key={time}
    className="absolute left-0 right-0 pointer-events-none"
    style={{
      top:    timeToY(time, pxPerSecond),
      height: 0.5 * pxPerSecond,
      backgroundColor: npsToColor(nps),
    }}
  />
))}
```

Only render bands in current viewport (filter by `timeFrom`/`timeTo`). No virtualization needed — bands are simple divs.

---

## Feature 4 — Game Preview Mode

4th entry in view mode switcher: `Composer` `Developer` `QA` `Preview`.

### Layout

Preview mode replaces the piano roll grid with a vertically flipped, game-style view:

```
┌──────────────────────────────────┐
│  T1    T2    T3    T4  ...  T8  │  ← Track columns (same 8)
│                                  │
│        ●          ●              │  ← notes falling from top
│   ●              ●    ●          │
│              ●                   │
│  ─────────────────────────────── │  ← HIT ZONE (bottom 10%)
│  ████  ████  ████  ████  ...     │  ← Piano keys visual
└──────────────────────────────────┘
```

- Notes fall **downward** (Y increases with time, same math as editor)
- Hit zone at bottom — fixed position
- Play button scrolls viewport so notes arrive at hit zone at real time
- Notes entering the visible area = "now playable" for the player
- Read-only: no click-to-create in preview mode

### Scroll behavior in Preview mode

Normal editor: scroll manually, playhead is a line.
Preview mode: playhead IS the viewport — the "camera" follows game time.

```typescript
// While playing in Preview mode:
// Scroll position = timeToY(playheadTime, pxPerSecond) - (viewportHeight * 0.9)
containerRef.current.scrollTop = Math.max(0, 
  timeToY(playheadTime, pxPerSecond) - viewportHeight * 0.9
)
```

### Hit Zone

```typescript
// Fixed at bottom of viewport, not the grid:
<div className="absolute bottom-0 left-0 right-0 h-[10%] border-t-2 border-primary/50 bg-primary/5 pointer-events-none">
  <div className="flex h-full">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex-1 border-r border-primary/20" />
    ))}
  </div>
</div>
```

---

## Feature 5 — Pattern Library

### Backend — PatternModule

```
modules/patterns/
├── patterns.module.ts
├── patterns.controller.ts
└── patterns.service.ts
```

**Endpoints:**
- `GET /patterns` — list user's patterns (own + global)
- `POST /patterns` — save pattern `{ name, notes: PatternNote[], songId? }`
- `DELETE /patterns/:id` — delete (own patterns only)

### Frontend — Multi-select

Shift+click to select multiple notes (new `selectedNoteIds: Set<string>` in store).

When 2+ notes selected, toolbar shows:
```
[2 selected]  [📋 Save as Pattern]  [✕ Deselect]
```

Save pattern modal: enter name → `POST /patterns`.

### Frontend — Pattern panel

Right panel TRACKS tab bottom section:

```
PATTERNS
─────────────────
Verse Fill (4)   [Paste]
Drop Build (8)   [Paste]
Chorus Loop (6)  [Paste]
[+ Save selection as pattern]
```

`[Paste]` → places pattern notes at current `playheadTime`:
- Each note: `time = playheadTime + note.timeOffset`
- Calls `POST /songs/:songId/notes` for each note in sequence
- Conflict notes (409) skipped silently, toast shows count: "Pasted 6/8 notes (2 conflicts)"

---

## Feature 6 — Section Markers

### Backend — SectionModule

```
modules/sections/
├── sections.module.ts
├── sections.controller.ts
└── sections.service.ts
```

**Endpoints:**
- `GET /songs/:songId/sections` — list all markers ordered by time
- `POST /songs/:songId/sections` — `{ time, label, color? }`
- `PATCH /songs/:songId/sections/:id` — rename/recolor
- `DELETE /songs/:songId/sections/:id`

### Frontend — Marker creation

Click on the **time axis** (left 40px column) → add section marker dropdown:

```
Add section at 12.0s:
[Intro] [Verse] [Chorus] [Bridge] [Drop] [Outro] [Custom…]
```

### Frontend — Grid rendering

Section markers render as horizontal label bands at their `time` position:

```typescript
// Above the note layer (z-index 5):
{sections.map(section => (
  <div
    key={section.id}
    className="absolute left-0 right-0 flex items-center gap-2 px-2 pointer-events-none"
    style={{
      top:             timeToY(section.time, pxPerSecond),
      height:          20,
      backgroundColor: section.color + '22',  // 13% opacity
      borderTop:       `2px solid ${section.color}`,
    }}
  >
    <span className="text-[10px] font-medium" style={{ color: section.color }}>
      {section.label}
    </span>
  </div>
))}
```

### Live Context strip enrichment

Playhead-reactive panel shows current section:
```
⏱ 12.4s  │  Verse
```

### Section jump list (Tracks tab)

```
SECTIONS
──────────────────
  0.0s  Intro
 12.0s  Verse      ← current (highlighted)
 36.0s  Chorus
 60.0s  Bridge
```

Click row → `setPlayheadTime(section.time)` + scroll grid to that position.

---

## Feature 7 — Combo + Difficulty (BottomBar)

Client-side only. Updates live as notes change.

### Computation

```typescript
// engine/difficulty-calculator.ts
export function maxCombo(notes: Note[]): number {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
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
  if (avgNps < 2)  return 'Easy'
  if (avgNps < 4)  return 'Normal'
  if (avgNps < 7)  return 'Hard'
  return 'Expert'
}
```

### BottomBar

```
00:04.2   1x   Bar 2·3   │   ♦ Hard   Combo ×14   │   1 warn
```

Color coding for difficulty:
- Easy → `text-success`
- Normal → `text-info`
- Hard → `text-warning`
- Expert → `text-error`

---

## New Files

```
apps/api/src/modules/users/                  (Phase 2)
apps/api/src/modules/patterns/patterns.module.ts
apps/api/src/modules/patterns/patterns.controller.ts
apps/api/src/modules/patterns/patterns.service.ts
apps/api/src/modules/sections/sections.module.ts
apps/api/src/modules/sections/sections.controller.ts
apps/api/src/modules/sections/sections.service.ts
apps/web/src/features/editor/engine/beat-calculator.ts
apps/web/src/features/editor/engine/difficulty-calculator.ts
apps/web/src/features/editor/components/HoldNote.tsx
apps/web/src/features/editor/components/SwipeNote.tsx
apps/web/src/features/editor/components/TapNote.tsx
apps/web/src/features/editor/components/SectionMarkers.tsx
apps/web/src/features/editor/components/CollaboratorCursors.tsx
apps/web/src/features/editor/components/DifficultyOverlay.tsx
apps/web/src/features/editor/components/GamePreview.tsx
apps/web/src/features/patterns/usePatterns.ts
apps/web/src/features/sections/useSections.ts
```

---

## Acceptance Criteria

### BPM + Beat Grid
- [ ] Song has `bpm` field, default 120
- [ ] BPM editable in toolbar, saved to DB
- [ ] Beat lines visible on grid at correct positions
- [ ] Measure lines bolder than beat lines
- [ ] Snap-to-beat places note exactly on beat boundary
- [ ] Time axis shows `Bar.Beat` alongside seconds

### Note Types
- [ ] TAP renders as existing 16px circle
- [ ] HOLD renders as tall pill with circle cap
- [ ] SWIPE renders as circle with arrow
- [ ] Popup mode allows selecting note type
- [ ] Hold drag creates HOLD note with correct duration
- [ ] `noteType` + `duration` stored in DB

### Difficulty Overlay
- [ ] Toggle button shows/hides heatmap
- [ ] Green/yellow/red bands visible at correct time positions
- [ ] Updates live when notes added/removed

### Game Preview
- [ ] "Preview" in view mode switcher
- [ ] Notes render falling downward
- [ ] Hit zone visible at bottom
- [ ] Play button scrolls viewport in real time
- [ ] No note creation in Preview mode

### Pattern Library
- [ ] Shift+click selects multiple notes
- [ ] Save as Pattern modal works
- [ ] Pattern list in right panel
- [ ] Paste places notes at playhead position
- [ ] Conflict count shown in toast

### Section Markers
- [ ] Click time axis to add section marker
- [ ] Preset labels + custom option
- [ ] Markers render as colored bands on grid
- [ ] Live Context strip shows current section name
- [ ] Section jump list in Tracks tab

### Combo + Difficulty
- [ ] BottomBar shows difficulty rating
- [ ] BottomBar shows max combo count
- [ ] Both update live as notes added/removed
- [ ] Color coding matches difficulty level
