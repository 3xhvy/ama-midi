# Phase 3 — Music Game Features (Design Spec)

**Date:** 2026-05-22
**Goal:** Transform AMA-MIDI from a generic note sequencer into a purpose-built rhythm-game level editor.
**Shipping model:** 3 sequenced waves, each independently mergeable.

---

## Decisions Locked in Brainstorm

| Topic | Decision |
|---|---|
| Game Preview interactivity | Visual-only playback (no keyboard input, no scoring) |
| Section markers sync | Real-time WebSocket broadcast (`section-created/updated/deleted`) |
| Snap mode behavior | Mode switch in store: `'0.1s' \| 'beat' \| 'halfBeat'` |
| Fast-mode note types | Toolbar `activeNoteType` selector (TAP/HOLD/SWIPE). HOLD = drag-down, SWIPE = right-arrow V1 |
| Shipping sequence | Wave 1 Foundation → Wave 2 Composition → Wave 3 Game-feel |

---

## Architecture Overview

Three waves. Each is one git branch, one merge. Reviewable and reversible independently.

| Wave | Features | Days | Risk |
|---|---|---|---|
| 1. Foundation | BPM + beat grid, Note types (TAP/HOLD/SWIPE), Snap modes | ~5 | DB migrations + engine math |
| 2. Composition | Multi-select, Pattern library, Section markers | ~6 | New modules + WebSocket events |
| 3. Game-feel | Game Preview, Difficulty heatmap, Combo + difficulty stats | ~3 | Client-only, lowest risk |

**Architectural invariants preserved:**
- `NoteService` writes emit `note.*` events. Ledger + Realtime stay decoupled via EventEmitter.
- Sections add new event family (`section.*`) using same pattern.
- Pattern paste = sequential POST `/notes` calls. Each fires its own event.
- Soft delete unchanged. Partial unique index unchanged.
- Multi-select stays in Zustand store. Never crosses to backend.

---

## Data Model

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
enum NoteType { TAP HOLD SWIPE }

model Note {
  // existing +
  noteType NoteType @default(TAP)
  duration Float?   // HOLD only, range 0.1–30s. null for TAP and SWIPE.
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
  notes     Json     // PatternNote[]
  createdBy String
  songId    String?  // null = global (user library)
  createdAt DateTime @default(now())

  creator User  @relation(fields: [createdBy], references: [id])
  song    Song? @relation(fields: [songId], references: [id], onDelete: SetNull)

  @@map("note_patterns")
}
```

### Shared types

```typescript
// packages/shared/src/types.ts (additions)
export type NoteType = 'TAP' | 'HOLD' | 'SWIPE'

export interface Note {
  // existing +
  noteType: NoteType
  duration?: number
}

export interface Song {
  // existing +
  bpm: number
  timeSignature: string
}

export interface SectionMarker {
  id:          string
  songId:      string
  time:        number
  label:       string
  color:       string
  createdBy:   string
  creatorName: string
  createdAt:   string
}

export interface PatternNote {
  track:      number
  timeOffset: number
  noteType:   NoteType
  color:      string
  duration?:  number
}

export interface NotePattern {
  id:        string
  name:      string
  notes:     PatternNote[]
  createdBy: string
  songId?:   string | null
  createdAt: string
}
```

### Shared constants

```typescript
// packages/shared/src/constants.ts (additions)
export const SECTION_PRESETS = [
  { label: 'Intro',  color: '#10B981' },
  { label: 'Verse',  color: '#6C63FF' },
  { label: 'Chorus', color: '#F59E0B' },
  { label: 'Bridge', color: '#EC4899' },
  { label: 'Drop',   color: '#EF4444' },
  { label: 'Outro',  color: '#6B7280' },
]

export const HOLD_DURATION_MIN = 0.1
export const HOLD_DURATION_MAX = 30
export const HOLD_DRAG_THRESHOLD_PX = 4
```

---

## Wave 1 — Foundation

### Engine: beat-calculator.ts (new)

```typescript
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
  const bd = beatDuration(bpm)
  const total = Math.floor(time / bd)
  return {
    measure: Math.floor(total / beatsPerMeasure) + 1,
    beat:    (total % beatsPerMeasure) + 1,
  }
}

export function beatToTime(measure: number, beat: number, bpm: number, beatsPerMeasure = 4): number {
  return ((measure - 1) * beatsPerMeasure + (beat - 1)) * beatDuration(bpm)
}

export type SnapMode = '0.1s' | 'beat' | 'halfBeat'

export function snapTime(rawTime: number, mode: SnapMode, bpm: number): number {
  if (mode === '0.1s') return Math.round(rawTime * 10) / 10
  const bd  = beatDuration(bpm)
  const div = mode === 'beat' ? bd : bd / 2
  return Math.round(rawTime / div) * div
}
```

### Engine: beat-grid.ts (new)

```typescript
export interface BeatLine {
  y:      number
  weight: 'beat' | 'measure'
}

export function computeBeatLines(
  timeFrom: number, timeTo: number,
  bpm: number, timeSignature: string, pxPerSecond: number,
): BeatLine[] {
  const bd                  = beatDuration(bpm)
  const [beatsPerMeasure]   = timeSignature.split('/').map(Number)
  const startBeat = Math.max(0, Math.floor(timeFrom / bd))
  const endBeat   = Math.ceil(timeTo / bd)
  const lines: BeatLine[]   = []
  for (let i = startBeat; i <= endBeat; i++) {
    lines.push({
      y:      i * bd * pxPerSecond,
      weight: i % beatsPerMeasure === 0 ? 'measure' : 'beat',
    })
  }
  return lines
}
```

### Engine: coordinate-mapper.ts (modify)

```typescript
// yToTime signature change — backwards-compatible default snap mode
export function yToTime(
  y: number, pxPerSecond: number,
  snapMode: SnapMode = '0.1s', bpm = 120,
): number {
  const raw      = y / pxPerSecond
  const clamped  = Math.max(TIME_MIN, Math.min(TIME_MAX, raw))
  const snapped  = snapTime(clamped, snapMode, bpm)
  return Math.max(TIME_MIN, Math.min(TIME_MAX, snapped))
}
```

### Store additions

```typescript
type SnapMode  = '0.1s' | 'beat' | 'halfBeat'
type NoteType  = 'TAP' | 'HOLD' | 'SWIPE'
type ViewMode  = 'composer' | 'developer' | 'qa' | 'preview'   // 4th added

interface EditorStore {
  // existing +
  snapMode:        SnapMode             // default '0.1s'
  activeNoteType:  NoteType             // default 'TAP'
  heatmapEnabled:  boolean              // default false
  selectedNoteIds: Set<string>          // replaces selectedNoteId
  setSnapMode:        (m: SnapMode) => void
  setActiveNoteType:  (t: NoteType) => void
  setHeatmapEnabled:  (b: boolean) => void
  selectNote:         (id: string | null) => void     // sets to Set([id]) or empty
  toggleNoteSelection: (id: string) => void
  clearSelection:     () => void
}
```

### Toolbar extensions

Layout (single row, scrolls horizontally if narrow):
```
[← Song]  [Name]  │  ⏮▶⏭  00:04.2  Bar 2·3  ♩120▾  │  Snap [0.1s|Beat|½Beat]  Type [TAP|HOLD|SWIPE]  │  Composer Dev QA Preview  │  ✨  Avatars  🌙  ?
```

BPM widget: `♩120` button → on click swap to inline `<input type="number">` → on blur calls `PATCH /songs/:id { bpm }` → optimistic update.

### GridLines (modify)

Accept new `beatLines: BeatLine[]` prop. Render above virtualized second lines, below notes:
- Beat: `background: rgba(255,255,255,0.04)`
- Measure: `background: rgba(255,255,255,0.10)`, `height: 1px`

Computed by parent (`PianoRoll`) once per render using `computeBeatLines(timeFrom, timeTo, bpm, timeSignature, pxPerSecond)`. ~120 lines max in viewport at 120bpm; no virtualization needed.

### TimeAxis (modify)

Below each `Ns` label, add smaller `bar.beat` label using `timeToBeat(time, bpm, timeSignature)`. Measure boundaries (beat 1) bold.

### Note rendering

`NoteCircle` becomes a thin router:
```typescript
export function NoteCircle(props: NoteCircleProps) {
  if (props.note.noteType === 'HOLD')  return <HoldNote {...props} />
  if (props.note.noteType === 'SWIPE') return <SwipeNote {...props} />
  return <TapNote {...props} />
}
```

**TapNote.tsx** = current 16px circle, extracted as-is.

**HoldNote.tsx:**
```
   ●  ← top cap (16px circle, note.color)
   │  ← pill body, trackWidth/3 wide, note.color @ 70% opacity
   │     height = max(24, duration * pxPerSecond)
   ●  ← bottom cap (8px, note.color @ 50%)
```

**SwipeNote.tsx:** 16px circle + CSS border-triangle right-arrow at `right: -8px`.

### Note creation — fast mode

`activeNoteType === 'TAP'`: click = create TAP (current behavior).

`activeNoteType === 'HOLD'`: mousedown starts drag tracking.
- mousemove while held: render ghost HoldNote with growing duration
- mouseup: if dragDistance ≥ `HOLD_DRAG_THRESHOLD_PX` (4px) → create HOLD with `duration = dragPx / pxPerSecond`, snapped to snapMode. Else fallback to TAP at start point.

`activeNoteType === 'SWIPE'`: click = create SWIPE (right-arrow, V1 single direction).

### Note creation — popup mode

NotePopup adds Type selector (TAP/HOLD/SWIPE radio buttons) and conditional Duration input (HOLD only, `min=0.1`, `max=30`).

### Backend — DTO changes

```typescript
// CreateNoteDto, UpdateNoteDto
@IsEnum(NoteType) @IsOptional() noteType?: NoteType
@IsNumber() @Min(0.1) @Max(30) @IsOptional() duration?: number

// UpdateSongDto
@IsInt() @Min(40) @Max(300) @IsOptional() bpm?: number
@Matches(/^\d+\/\d+$/) @IsOptional() timeSignature?: string
```

Validation: HOLD requires `duration`; service-layer guard returns 400 if `noteType === 'HOLD' && !duration`.

---

## Wave 2 — Composition Tools

### Multi-select

Store: `selectedNoteId: string | null` → `selectedNoteIds: Set<string>`.

**Migration of single-select callers:**
- `selectNote(id)` → `setSelectedNoteIds(id ? new Set([id]) : new Set())`
- All readers `selectedNoteId === note.id` → `selectedNoteIds.has(note.id)`

**Interaction:**
- Click note: clear and select one
- Shift+click: toggle in/out
- Click empty grid: clear
- Escape: clear
- Cmd/Ctrl+A: select all visible notes

**MultiSelectBar.tsx** (renders when `selectedNoteIds.size >= 2`, floats at top center):
```
[N selected]  [📋 Save as Pattern]  [🗑 Delete]  [✕ Deselect]
```

Bulk delete: sequential `DELETE /notes/:id` (each emits `note.deleted` → broadcast).

### Pattern Library — Backend

```
apps/api/src/modules/patterns/
├── patterns.module.ts
├── patterns.controller.ts   (JWT-guarded, @Controller('patterns'))
└── patterns.service.ts
```

**Endpoints:**
- `GET    /patterns`        — returns `NotePattern[]` (own + global, ordered by `createdAt DESC`)
- `POST   /patterns`        — `{ name: string; notes: PatternNote[]; songId?: string }`
- `DELETE /patterns/:id`    — 403 if `createdBy !== req.user.id`

**Validation (class-validator):**
- `name`: min 1, max 50 chars
- `notes`: array, min 1, max 50
- Each `PatternNote`: `track ∈ [1, 8]`, `timeOffset ≥ 0`, `noteType ∈ NoteType`, `duration` required if HOLD

No realtime broadcast — patterns are per-user, not per-song.

### Pattern Library — Frontend

`features/patterns/usePatterns.ts`:
```typescript
export function usePatterns()              // GET /patterns
export function useCreatePattern()         // POST /patterns
export function useDeletePattern()         // DELETE /patterns/:id
```

**Save modal** (`SavePatternModal.tsx`):
```
Name:  [____________]
Scope: ◉ This song only   ○ My library (all songs)
[Cancel]  [Save]
```

Normalizes `timeOffset` relative to earliest selected note's time:
```typescript
const earliest = Math.min(...selected.map(n => n.time))
const notes: PatternNote[] = selected.map(n => ({
  track:      n.track,
  timeOffset: n.time - earliest,
  noteType:   n.noteType,
  color:      n.color,
  duration:   n.duration,
}))
```

**PatternPanel.tsx** (right panel new section under TRACKS tab):
```
PATTERNS
─────────────────
Verse Fill (4)   [Paste]
Drop Build (8)   [Paste]
Chorus Loop (6)  [Paste]
[+ Save selection]
```

**Paste:**
```typescript
let ok = 0, conflicts = 0
for (const pn of pattern.notes) {
  try {
    await POST `/songs/${songId}/notes` {
      track: pn.track,
      time:  playheadTime + pn.timeOffset,
      noteType: pn.noteType,
      color:    pn.color,
      duration: pn.duration,
      title:    `${pattern.name} ${pn.track}`,
    }
    ok++
  } catch (e) {
    if (e.status === 409) conflicts++
    else throw e
  }
}
toast.success(`Pasted ${ok}/${pattern.notes.length} notes` + (conflicts ? ` (${conflicts} conflicts)` : ''))
```

Each POST already broadcasts via existing flow. Collaborators see notes appear.

### Section Markers — Backend

```
apps/api/src/modules/sections/
├── sections.module.ts
├── sections.controller.ts   (@Controller('songs/:songId/sections'))
├── sections.service.ts      (emits 'section.created' etc.)
└── sections.listener.ts     (broadcasts via RealtimeGateway)
```

**Endpoints (all JWT-guarded):**
- `GET    /songs/:songId/sections`
- `POST   /songs/:songId/sections`     — `{ time, label, color? }`
- `PATCH  /songs/:songId/sections/:id` — `{ label?, color? }` (NOT time — would re-key timeline)
- `DELETE /songs/:songId/sections/:id`

**Validation:**
- `time`: 0 ≤ time ≤ 300
- `label`: 1–24 chars
- `color`: hex regex `/^#[0-9A-F]{6}$/i`

Service emits `section.created` / `section.updated` / `section.deleted` events. Listener calls `realtimeGateway.broadcastToSong(songId, 'section-created', payload)`.

### RealtimeGateway extension

Add handlers (no client-emit; server-emit only):
- `section-created` → SectionMarker payload
- `section-updated` → SectionMarker payload
- `section-deleted` → `{ id: string }`

### Section Markers — Frontend

`features/sections/useSections.ts`:
```typescript
export function useSections(songId: string)              // GET, TanStack Query
export function useCreateSection(songId: string)         // POST + optimistic
export function useUpdateSection(songId: string)         // PATCH
export function useDeleteSection(songId: string)         // DELETE
```

`useSocket.ts` extension — handle 3 section events → update `['sections', songId]` cache:
```typescript
socket.on('section-created', (s: SectionMarker) => {
  queryClient.setQueryData<SectionMarker[]>(['sections', songId], old =>
    old ? [...old, s].sort((a,b) => a.time - b.time) : [s])
})
socket.on('section-updated', (s: SectionMarker) => {
  queryClient.setQueryData<SectionMarker[]>(['sections', songId], old =>
    old ? old.map(x => x.id === s.id ? s : x) : [s])
})
socket.on('section-deleted', ({ id }: { id: string }) => {
  queryClient.setQueryData<SectionMarker[]>(['sections', songId], old =>
    old ? old.filter(x => x.id !== id) : [])
})
```

**Creation UI:** click TimeAxis at Y → popover at cursor:
```
Add section at 12.0s:
[Intro] [Verse] [Chorus] [Bridge] [Drop] [Outro] [Custom…]
```

Preset → POST with label + matching `SECTION_PRESETS[i].color`. Custom → input + color swatch.

**Rendering** (`SectionMarkers.tsx` inside scroll container, z-index 5):
```typescript
{sections.map(s => (
  <div key={s.id}
    className="absolute left-0 right-0 flex items-center px-2 pointer-events-none"
    style={{
      top:             timeToY(s.time, pxPerSecond),
      height:          20,
      backgroundColor: s.color + '22',
      borderTop:       `2px solid ${s.color}`,
    }}>
    <span className="text-[10px] font-medium" style={{ color: s.color }}>
      {s.label}
    </span>
  </div>
))}
```

**LiveContextStrip extension** — find largest `section.time ≤ playheadTime` → show label inline:
```
⏱ 12.4s  │  Verse  │  NPS bar
```

**SectionJumpList.tsx** — new section in left Tracks panel below tracks:
```
SECTIONS
 0.0s  Intro
12.0s  Verse      ← bold/highlighted if current
36.0s  Chorus
```

Click row → `setPlayheadTime(s.time)`. Right-click → confirm + DELETE.

---

## Wave 3 — Game-feel

All client-side. No DB, no API.

### Engine: difficulty-calculator.ts (new)

```typescript
export function computeNpsOverTime(
  notes: Note[], windowSeconds = 2, resolution = 0.5,
): Array<{ time: number; nps: number }> {
  const result = []
  for (let t = 0; t <= 300; t += resolution) {
    const count = notes.filter(
      n => n.time >= t - windowSeconds/2 && n.time < t + windowSeconds/2,
    ).length
    result.push({ time: t, nps: count / windowSeconds })
  }
  return result
}

export function npsToColor(nps: number): string {
  if (nps < 3) return 'rgba(16, 185, 129, 0.15)'   // green
  if (nps < 6) return 'rgba(245, 158, 11, 0.20)'   // yellow
  return 'rgba(239, 68, 68, 0.25)'                  // red
}

export function maxCombo(notes: Note[]): number {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  let max = 0, streak = 0, last = -Infinity
  for (const n of sorted) {
    if (n.time - last <= 2) { streak++; max = Math.max(max, streak) }
    else streak = 1
    last = n.time
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

Memoize at consumer via `useMemo([notes.length, ...notes.map(n => n.time).join(',')])` or `useMemo(() => fn(notes), [notes])` (TanStack returns referentially stable arrays).

### Difficulty heatmap

Toolbar toggle: `⬛ Heatmap` ↔ `🔥 Heatmap`. State: `useEditorStore.heatmapEnabled`.

`DifficultyOverlay.tsx` renders inside PianoRoll scroll container, z-index 1 (below grid, below notes):
```typescript
{heatmapEnabled && npsData
  .filter(({ time }) => time >= timeFrom - 1 && time <= timeTo + 1)
  .map(({ time, nps }) => (
    <div key={time}
      className="absolute left-0 right-0 pointer-events-none"
      style={{
        top:             timeToY(time, pxPerSecond),
        height:          0.5 * pxPerSecond,
        backgroundColor: npsToColor(nps),
      }} />
  ))}
```

Viewport filter caps DOM at ~30 bands.

### Combo + Difficulty stats (BottomBar)

EditorPage `bottomBar` extended:
```
00:04.2  Bar 2·3  │  ♦ Hard   Combo ×14  │  1 warn
```

Color: Easy = `text-success`, Normal = `text-info`, Hard = `text-warning`, Expert = `text-error`. Difficulty + combo computed once per `notes` change via `useMemo`.

### Game Preview Mode

4th view mode: `'composer' | 'developer' | 'qa' | 'preview'`.

**PianoRoll conditional rendering when `viewMode === 'preview'`:**
- Force `canEdit = false` (no click-to-create, no ghost, no popup)
- Suppress all click handlers (`onClick`, `onMouseMove` set-ghost branch)
- Mount `HitZone` overlay (fixed bottom 10% of scroll viewport)
- Mount `HitZonePlayhead` (line at hit-zone top)
- Auto-scroll while `isPlaying`: `scrollTop = max(0, timeToY(playheadTime, pxPerSecond) - viewportHeight * 0.9)`
- Suppress wheel + scroll-bar interaction during playback (re-enabled when paused)

**HitZone.tsx:**
```typescript
<div className="absolute bottom-0 left-0 right-0 h-[10%] border-t-2 border-primary/50 bg-primary/5 pointer-events-none z-10">
  <div className="flex h-full">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="flex-1 border-r border-primary/20 last:border-r-0" />
    ))}
  </div>
</div>
```

**Falling effect:** Pure consequence of auto-scroll. Notes don't animate per-element. CSS transitions on notes would fight virtualization.

---

## File Map

```
NEW:
apps/api/src/modules/patterns/patterns.module.ts
apps/api/src/modules/patterns/patterns.controller.ts
apps/api/src/modules/patterns/patterns.service.ts
apps/api/src/modules/sections/sections.module.ts
apps/api/src/modules/sections/sections.controller.ts
apps/api/src/modules/sections/sections.service.ts
apps/api/src/modules/sections/sections.listener.ts
apps/api/prisma/migrations/<N>_phase3_bpm_note_types/migration.sql
apps/api/prisma/migrations/<N+1>_phase3_sections_patterns/migration.sql
apps/web/src/features/editor/engine/beat-calculator.ts
apps/web/src/features/editor/engine/beat-grid.ts
apps/web/src/features/editor/engine/difficulty-calculator.ts
apps/web/src/features/editor/components/TapNote.tsx
apps/web/src/features/editor/components/HoldNote.tsx
apps/web/src/features/editor/components/SwipeNote.tsx
apps/web/src/features/editor/components/SectionMarkers.tsx
apps/web/src/features/editor/components/SectionJumpList.tsx
apps/web/src/features/editor/components/SavePatternModal.tsx
apps/web/src/features/editor/components/PatternPanel.tsx
apps/web/src/features/editor/components/DifficultyOverlay.tsx
apps/web/src/features/editor/components/HitZone.tsx
apps/web/src/features/editor/components/MultiSelectBar.tsx
apps/web/src/features/patterns/usePatterns.ts
apps/web/src/features/sections/useSections.ts

MODIFY:
apps/api/prisma/schema.prisma
apps/api/src/modules/notes/notes.service.ts        (DTO + HOLD-duration guard)
apps/api/src/modules/notes/dto/*.ts                (CreateNote/UpdateNote DTOs)
apps/api/src/modules/songs/songs.service.ts        (UpdateSongDto: bpm, timeSignature)
apps/api/src/modules/realtime/realtime.gateway.ts  (3 section-* server-emits)
apps/api/src/app.module.ts                         (register PatternsModule, SectionsModule)
packages/shared/src/types.ts                       (NoteType, Note, Song, SectionMarker, NotePattern, PatternNote)
packages/shared/src/constants.ts                   (SECTION_PRESETS, HOLD_DURATION_*, HOLD_DRAG_THRESHOLD_PX)
apps/web/src/store/editor.store.ts                 (snapMode, activeNoteType, heatmapEnabled, selectedNoteIds, preview)
apps/web/src/features/editor/engine/coordinate-mapper.ts  (yToTime(snapMode, bpm))
apps/web/src/features/editor/engine/index.ts              (barrel exports)
apps/web/src/features/editor/components/NoteCircle.tsx    (router)
apps/web/src/features/editor/components/GridLines.tsx     (beatLines prop)
apps/web/src/features/editor/components/TimeAxis.tsx      (bar.beat dual labels)
apps/web/src/features/editor/components/Toolbar.tsx       (snap, type, BPM, preview)
apps/web/src/features/editor/components/PianoRoll.tsx     (HOLD-drag, sections, heatmap, preview wiring)
apps/web/src/features/editor/components/NotePopup.tsx     (Type + Duration fields)
apps/web/src/features/editor/components/LiveContextStrip.tsx  (current section)
apps/web/src/features/collaboration/useSocket.ts          (section-* events)
apps/web/src/pages/EditorPage.tsx                          (BottomBar combo/difficulty, MultiSelectBar, SectionJumpList, PatternPanel)
```

---

## Critical Invariants

1. **NoteService EventEmitter decoupling** — never import Realtime or Ledger directly. Sections follow same rule.
2. **Soft delete + partial unique index** — note types do NOT change the unique-position rule. Two HOLDs at same `(songId, track, time)` still 409.
3. **HOLD duration validity** — service-layer guard rejects `noteType === 'HOLD' && !duration` with 400.
4. **Section time immutability via PATCH** — re-keying time on update would break ordering; require delete+create instead.
5. **Pattern paste = per-note POST** — never bulk-insert. Each emit goes through existing event/broadcast flow.
6. **Preview mode forces read-only** — no click handlers, no popup, no AI overlay. `canEdit` overridden internally.
7. **Heatmap z-index below notes** — bands must never obscure note interaction.
8. **Beat grid not virtualized** — beats don't align to row index. Computed per-render in viewport window.

---

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit (engine) | `beatDuration`, `timeToBeat`, `beatToTime`, `snapTime` | Table-driven Jest, no deps |
| Unit (engine) | `computeBeatLines`, `computeNpsOverTime`, `maxCombo`, `difficultyRating` | Table-driven Jest |
| Unit (backend) | `patterns.service`, `sections.service` | Jest + mocked PrismaService |
| Integration | Section WebSocket fan-out | `DATABASE_URL=test` two-socket test |
| Frontend smoke | HoldNote / SwipeNote rendering | React Testing Library snapshot |
| Frontend smoke | Snap modes round-trip | RTL: change snap, click, assert created note time |
| Manual | Two-browser section co-edit | Tab 1 creates section, Tab 2 sees ≤1s |
| Manual | Preview mode auto-scroll | Play, watch viewport follow playhead |

---

## Acceptance Criteria

### Wave 1
- [ ] Song has `bpm` (default 120) and `timeSignature` (default "4/4")
- [ ] BPM widget in toolbar saves via `PATCH /songs/:id`
- [ ] Beat + measure lines render on grid at correct positions
- [ ] TimeAxis shows `Bar.Beat` below seconds
- [ ] Snap toggle: 0.1s, Beat, ½Beat — click position snaps accordingly
- [ ] TAP renders as current 16px circle
- [ ] HOLD renders as cap + pill + tail with `duration * pxPerSecond` height (min 24px)
- [ ] SWIPE renders as circle + right arrow
- [ ] Fast-mode HOLD: drag down ≥ 4px → creates HOLD with computed duration
- [ ] Popup mode has Type selector + Duration (HOLD only)
- [ ] `noteType` + `duration` stored in DB

### Wave 2
- [ ] Shift+click toggles note into selection set
- [ ] MultiSelectBar appears when size ≥ 2
- [ ] Save as Pattern modal saves to `/patterns` with normalized `timeOffset`
- [ ] Pattern panel lists own + global patterns
- [ ] Paste places notes at `playheadTime + timeOffset`, reports `ok/total` + conflicts
- [ ] Click TimeAxis opens section preset popover
- [ ] Section bands render at correct time
- [ ] Two-browser: section creation broadcasts via WebSocket within 1s
- [ ] LiveContextStrip shows current section label
- [ ] SectionJumpList highlights current, click jumps playhead

### Wave 3
- [ ] Toolbar Heatmap toggle shows/hides green/yellow/red bands
- [ ] BottomBar shows difficulty rating + combo, color-coded
- [ ] Both update live as notes change
- [ ] Preview view mode added to switcher
- [ ] Notes appear to fall as viewport auto-scrolls during play
- [ ] HitZone visible at bottom 10%
- [ ] No note creation in Preview mode (clicks suppressed)

---

## Out of Scope (V1)

- SWIPE direction variants (left/up/down) — V1 right-arrow only
- Pattern editing (only save + delete + paste — no in-place modify)
- Section time-edit via PATCH (delete + recreate instead)
- Preview-mode keyboard input / scoring / hit feedback
- Pattern sharing across users (only "global" = own library across all songs)
- Multi-undo (existing single-step undo unchanged)
- Heatmap export / PNG snapshot
- BPM ramp / tempo changes mid-song (single constant BPM)
- **Multiple difficulty charts per song** — deferred to Phase 4
- **Level-designer-specific tools** — deferred to Phase 4

---

## Phase 4 Preview — Level Designer Toolkit (not in this spec)

Phase 3 ships composer-focused features. Level designers (who tune difficulty) will get a dedicated phase. Captured here so the data model in Phase 3 doesn't paint Phase 4 into a corner.

**Anticipated Phase 4 scope** (own brainstorm cycle, own spec):

1. **Chart entity** — `Song` has many `Chart` (Easy/Normal/Hard/Expert). Notes attach to Chart, not Song. Existing notes auto-migrate to "NORMAL" chart on a per-song basis.
2. **Diff view** — side-by-side comparison of two charts on same song (highlight added/removed notes between difficulties).
3. **Reference ghost** — while editing chart X, render chart Y notes at low opacity for spacing guidance.
4. **Bulk thinning** — operations like "delete every Nth note", "keep only on beats", "remove HOLD notes" to derive Easy from Hard.
5. **Per-difficulty validation rules** — Easy avg NPS ≤ 2, Expert ≥ 7, etc. Surfaced in ValidationPanel per chart.
6. **Game-export format** — `GET /charts/:id/export` returns JSON binary the game engine consumes. Versioned schema.
7. **Approval workflow** — chart status `DRAFT → IN_REVIEW → APPROVED`. Only approved charts exportable.

**Phase 3 compatibility note:** Phase 3 keeps `Note.songId` (current shape). Phase 4 will migrate to `Note.chartId` and add a backfill migration that creates a default `NORMAL` chart per song. Patterns and Sections stay attached to `Song` (musical context shared across charts).
