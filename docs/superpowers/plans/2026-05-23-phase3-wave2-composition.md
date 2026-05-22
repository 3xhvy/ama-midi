# Phase 3 — Wave 2: Composition Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-select, pattern library (save selection + paste at playhead), and section markers (with WebSocket broadcast).

**Architecture:** Two Prisma migrations (`SectionMarker`, `NotePattern`), two new NestJS modules (`patterns/`, `sections/`) with their own services + DTOs, a `sections.listener.ts` that bridges service events to `RealtimeGateway`. Frontend gets `selectedNoteIds: Set<string>` (replacing single `selectedNoteId`), `MultiSelectBar`, `SavePatternModal`, `PatternPanel`, `SectionMarkers` overlay, `SectionJumpList`, and three new WebSocket handlers in `useSocket`.

**Tech Stack:** Prisma, NestJS class-validator, EventEmitter2, Socket.io, Zustand, React 18, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-05-22-phase3-music-game-features-design.md`

**Prerequisite:** Wave 1 must be merged (depends on `NoteType` and store changes).

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Create | `apps/api/prisma/migrations/<auto>_phase3_section_markers/migration.sql` | SectionMarker table |
| Create | `apps/api/prisma/migrations/<auto>_phase3_note_patterns/migration.sql` | NotePattern table |
| Modify | `apps/api/prisma/schema.prisma` | SectionMarker + NotePattern models |
| Modify | `packages/shared/src/types.ts` | SectionMarker, PatternNote, NotePattern |
| Modify | `packages/shared/src/constants.ts` | SECTION_PRESETS |
| Create | `apps/api/src/modules/patterns/patterns.module.ts` | Module wiring |
| Create | `apps/api/src/modules/patterns/patterns.controller.ts` | GET/POST/DELETE /patterns |
| Create | `apps/api/src/modules/patterns/patterns.service.ts` | Pattern CRUD |
| Create | `apps/api/src/modules/patterns/dto/create-pattern.dto.ts` | DTO + validation |
| Create | `apps/api/src/modules/sections/sections.module.ts` | Module wiring |
| Create | `apps/api/src/modules/sections/sections.controller.ts` | CRUD /songs/:songId/sections |
| Create | `apps/api/src/modules/sections/sections.service.ts` | Section CRUD, emit events |
| Create | `apps/api/src/modules/sections/sections.listener.ts` | Bridge events → Realtime broadcast |
| Create | `apps/api/src/modules/sections/dto/section.dto.ts` | DTOs |
| Modify | `apps/api/src/app.module.ts` | Register PatternsModule + SectionsModule |
| Modify | `apps/api/src/modules/realtime/realtime.gateway.ts` | broadcastToSong already exists; ensure helper available |
| Modify | `apps/web/src/store/editor.store.ts` | selectedNoteIds Set, multi-select setters |
| Create | `apps/web/src/features/patterns/usePatterns.ts` | TanStack hooks |
| Create | `apps/web/src/features/sections/useSections.ts` | TanStack hooks |
| Modify | `apps/web/src/features/collaboration/useSocket.ts` | section-* handlers |
| Create | `apps/web/src/features/editor/components/MultiSelectBar.tsx` | Floating action bar |
| Create | `apps/web/src/features/editor/components/SavePatternModal.tsx` | Save selection as pattern |
| Create | `apps/web/src/features/editor/components/PatternPanel.tsx` | List + paste patterns |
| Create | `apps/web/src/features/editor/components/SectionMarkers.tsx` | Render section bands |
| Create | `apps/web/src/features/editor/components/SectionCreatePopover.tsx` | Preset selector |
| Create | `apps/web/src/features/editor/components/SectionJumpList.tsx` | Sidebar list |
| Modify | `apps/web/src/features/editor/components/NoteCircle.tsx` (and TapNote/HoldNote/SwipeNote) | Use selectedNoteIds.has |
| Modify | `apps/web/src/features/editor/components/PianoRoll.tsx` | Shift+click, section overlay, drop on time axis |
| Modify | `apps/web/src/features/editor/components/LiveContextStrip.tsx` | Show current section name |
| Modify | `apps/web/src/features/editor/components/TimeAxis.tsx` | onSectionClick callback |
| Modify | `apps/web/src/pages/EditorPage.tsx` | Mount MultiSelectBar, SectionJumpList, PatternPanel |

---

## Task 1: DB Migration — SectionMarker

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add SectionMarker model + User/Song relation back-references**

In `apps/api/prisma/schema.prisma`, append at end:

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

In `model Song {}` add: `sectionMarkers SectionMarker[]`.
In `model User {}` add: `sectionMarkers SectionMarker[]`.

- [ ] **Step 2: Migrate**

```bash
cd apps/api && npx prisma migrate dev --name phase3_section_markers
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(db): add SectionMarker table"
```

---

## Task 2: DB Migration — NotePattern

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add NotePattern model + relations**

Append in `schema.prisma`:

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

In `model Song {}` add: `patterns NotePattern[]`.
In `model User {}` add: `patterns NotePattern[]`.

- [ ] **Step 2: Migrate**

```bash
cd apps/api && npx prisma migrate dev --name phase3_note_patterns
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(db): add NotePattern table"
```

---

## Task 3: Shared types + SECTION_PRESETS

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add types**

Append to `packages/shared/src/types.ts`:

```typescript
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
  songId:    string | null
  createdAt: string
}
```

- [ ] **Step 2: Add SECTION_PRESETS constant**

Append to `packages/shared/src/constants.ts`:

```typescript
export const SECTION_PRESETS = [
  { label: 'Intro',  color: '#10B981' },
  { label: 'Verse',  color: '#6C63FF' },
  { label: 'Chorus', color: '#F59E0B' },
  { label: 'Bridge', color: '#EC4899' },
  { label: 'Drop',   color: '#EF4444' },
  { label: 'Outro',  color: '#6B7280' },
] as const
```

- [ ] **Step 3: Build shared**

```bash
cd packages/shared && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): SectionMarker, NotePattern, PatternNote types + SECTION_PRESETS"
```

---

## Task 4: Backend — PatternsModule scaffolding

**Files:**
- Create: `apps/api/src/modules/patterns/patterns.module.ts`
- Create: `apps/api/src/modules/patterns/patterns.controller.ts`
- Create: `apps/api/src/modules/patterns/patterns.service.ts`
- Create: `apps/api/src/modules/patterns/dto/create-pattern.dto.ts`

- [ ] **Step 1: Create DTO**

```typescript
// apps/api/src/modules/patterns/dto/create-pattern.dto.ts
import {
  IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

class PatternNoteDto {
  @IsNumber() @Min(1) @Max(8) track!: number
  @IsNumber() @Min(0)         timeOffset!: number
  @IsEnum(['TAP','HOLD','SWIPE']) noteType!: 'TAP' | 'HOLD' | 'SWIPE'
  @IsString() color!: string
  @IsNumber() @Min(0.1) @Max(30) @IsOptional() duration?: number
}

export class CreatePatternDto {
  @IsString() @MinLength(1) @MaxLength(50) name!: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => PatternNoteDto)
  notes!: PatternNoteDto[]
  @IsUUID() @IsOptional() songId?: string
}
```

- [ ] **Step 2: Create service**

```typescript
// apps/api/src/modules/patterns/patterns.service.ts
import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePatternDto } from './dto/create-pattern.dto'
import type { NotePattern, PatternNote } from '@ama-midi/shared'

@Injectable()
export class PatternsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<NotePattern[]> {
    const rows = await this.prisma.notePattern.findMany({
      where:   { OR: [{ createdBy: userId }, { songId: null }] },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(this.toDomain)
  }

  async create(userId: string, dto: CreatePatternDto): Promise<NotePattern> {
    for (const n of dto.notes) {
      if (n.noteType === 'HOLD' && (n.duration == null || n.duration <= 0)) {
        throw new BadRequestException('HOLD notes in pattern require duration > 0')
      }
    }
    const row = await this.prisma.notePattern.create({
      data: {
        name:      dto.name,
        notes:     dto.notes as unknown as object,
        songId:    dto.songId ?? null,
        createdBy: userId,
      },
    })
    return this.toDomain(row)
  }

  async delete(userId: string, id: string): Promise<void> {
    const row = await this.prisma.notePattern.findUnique({ where: { id } })
    if (!row) throw new NotFoundException()
    if (row.createdBy !== userId) throw new ForbiddenException()
    await this.prisma.notePattern.delete({ where: { id } })
  }

  private toDomain = (row: any): NotePattern => ({
    id:        row.id,
    name:      row.name,
    notes:     row.notes as PatternNote[],
    createdBy: row.createdBy,
    songId:    row.songId,
    createdAt: row.createdAt.toISOString(),
  })
}
```

- [ ] **Step 3: Create controller**

```typescript
// apps/api/src/modules/patterns/patterns.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { PatternsService } from './patterns.service'
import { CreatePatternDto } from './dto/create-pattern.dto'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('patterns')
@UseGuards(AuthGuard('jwt'))
export class PatternsController {
  constructor(private readonly patterns: PatternsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.patterns.list((req.user as AuthUser).id)
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreatePatternDto) {
    return this.patterns.create((req.user as AuthUser).id, dto)
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.patterns.delete((req.user as AuthUser).id, id)
  }
}
```

- [ ] **Step 4: Create module**

```typescript
// apps/api/src/modules/patterns/patterns.module.ts
import { Module } from '@nestjs/common'
import { PatternsController } from './patterns.controller'
import { PatternsService } from './patterns.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports:     [PrismaModule],
  controllers: [PatternsController],
  providers:   [PatternsService],
})
export class PatternsModule {}
```

- [ ] **Step 5: Register in AppModule**

In `apps/api/src/app.module.ts`, add `PatternsModule` to imports.

- [ ] **Step 6: Type-check + commit**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

```bash
git add apps/api/src/modules/patterns/ apps/api/src/app.module.ts
git commit -m "feat(api): PatternsModule (GET/POST/DELETE /patterns)"
```

---

## Task 5: Backend — SectionsModule scaffolding

**Files:**
- Create: `apps/api/src/modules/sections/sections.module.ts`
- Create: `apps/api/src/modules/sections/sections.controller.ts`
- Create: `apps/api/src/modules/sections/sections.service.ts`
- Create: `apps/api/src/modules/sections/sections.listener.ts`
- Create: `apps/api/src/modules/sections/dto/section.dto.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// apps/api/src/modules/sections/dto/section.dto.ts
import { IsHexColor, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class CreateSectionDto {
  @IsNumber() @Min(0) @Max(300) time!: number
  @IsString() @MinLength(1) @MaxLength(24) label!: string
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'color must be 6-digit hex' })
  @IsOptional() color?: string
}

export class UpdateSectionDto {
  @IsString() @MinLength(1) @MaxLength(24) @IsOptional() label?: string
  @Matches(/^#[0-9A-F]{6}$/i) @IsOptional() color?: string
}
```

- [ ] **Step 2: Create service**

```typescript
// apps/api/src/modules/sections/sections.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../prisma/prisma.service'
import type { SectionMarker } from '@ama-midi/shared'
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto'

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(songId: string): Promise<SectionMarker[]> {
    const rows = await this.prisma.sectionMarker.findMany({
      where:   { songId },
      orderBy: { time: 'asc' },
      include: { creator: { select: { name: true } } },
    })
    return rows.map(this.toDomain)
  }

  async create(userId: string, songId: string, dto: CreateSectionDto): Promise<SectionMarker> {
    const row = await this.prisma.sectionMarker.create({
      data: {
        songId,
        time:      dto.time,
        label:     dto.label,
        color:     dto.color ?? '#6C63FF',
        createdBy: userId,
      },
      include: { creator: { select: { name: true } } },
    })
    const dom = this.toDomain(row)
    this.events.emit('section.created', { songId, section: dom })
    return dom
  }

  async update(songId: string, id: string, dto: UpdateSectionDto): Promise<SectionMarker> {
    const existing = await this.prisma.sectionMarker.findUnique({ where: { id } })
    if (!existing || existing.songId !== songId) throw new NotFoundException()
    const row = await this.prisma.sectionMarker.update({
      where: { id },
      data:  { label: dto.label, color: dto.color },
      include: { creator: { select: { name: true } } },
    })
    const dom = this.toDomain(row)
    this.events.emit('section.updated', { songId, section: dom })
    return dom
  }

  async delete(songId: string, id: string): Promise<void> {
    const existing = await this.prisma.sectionMarker.findUnique({ where: { id } })
    if (!existing || existing.songId !== songId) throw new NotFoundException()
    await this.prisma.sectionMarker.delete({ where: { id } })
    this.events.emit('section.deleted', { songId, id })
  }

  private toDomain = (row: any): SectionMarker => ({
    id:          row.id,
    songId:      row.songId,
    time:        row.time,
    label:       row.label,
    color:       row.color,
    createdBy:   row.createdBy,
    creatorName: row.creator?.name ?? 'Unknown',
    createdAt:   row.createdAt.toISOString(),
  })
}
```

- [ ] **Step 3: Create controller**

```typescript
// apps/api/src/modules/sections/sections.controller.ts
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { SectionsService } from './sections.service'
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto'
import type { Request } from 'express'
import type { AuthUser } from '@ama-midi/shared'

@Controller('songs/:songId/sections')
@UseGuards(AuthGuard('jwt'))
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get()
  list(@Param('songId') songId: string) {
    return this.sections.list(songId)
  }

  @Post()
  create(@Req() req: Request, @Param('songId') songId: string, @Body() dto: CreateSectionDto) {
    return this.sections.create((req.user as AuthUser).id, songId, dto)
  }

  @Patch(':id')
  update(@Param('songId') songId: string, @Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.sections.update(songId, id, dto)
  }

  @Delete(':id')
  remove(@Param('songId') songId: string, @Param('id') id: string) {
    return this.sections.delete(songId, id)
  }
}
```

- [ ] **Step 4: Create listener (bridge to Realtime)**

```typescript
// apps/api/src/modules/sections/sections.listener.ts
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import type { SectionMarker } from '@ama-midi/shared'

@Injectable()
export class SectionsListener {
  constructor(private readonly realtime: RealtimeGateway) {}

  @OnEvent('section.created')
  handleCreated({ songId, section }: { songId: string; section: SectionMarker }) {
    this.realtime.broadcastToSong(songId, 'section-created', section)
  }

  @OnEvent('section.updated')
  handleUpdated({ songId, section }: { songId: string; section: SectionMarker }) {
    this.realtime.broadcastToSong(songId, 'section-updated', section)
  }

  @OnEvent('section.deleted')
  handleDeleted({ songId, id }: { songId: string; id: string }) {
    this.realtime.broadcastToSong(songId, 'section-deleted', { id })
  }
}
```

- [ ] **Step 5: Create module**

```typescript
// apps/api/src/modules/sections/sections.module.ts
import { Module } from '@nestjs/common'
import { SectionsController } from './sections.controller'
import { SectionsService } from './sections.service'
import { SectionsListener } from './sections.listener'
import { PrismaModule } from '../prisma/prisma.module'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { JwtModule } from '@nestjs/jwt'

@Module({
  imports:     [PrismaModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [SectionsController],
  providers:   [SectionsService, SectionsListener, RealtimeGateway],
})
export class SectionsModule {}
```

Note: if `RealtimeGateway` is exported from `RealtimeModule` instead, import that module and remove the provider line.

- [ ] **Step 6: Register in AppModule**

In `apps/api/src/app.module.ts`, add `SectionsModule` to imports.

- [ ] **Step 7: Type-check + commit**

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors.

```bash
git add apps/api/src/modules/sections/ apps/api/src/app.module.ts
git commit -m "feat(api): SectionsModule with WebSocket broadcast via listener"
```

---

## Task 6: Frontend store — multi-select migration

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`

- [ ] **Step 1: Replace selectedNoteId with selectedNoteIds**

In `editor.store.ts`, replace the existing `selectedNoteId` field and `selectNote` setter with:

```typescript
selectedNoteIds:     Set<string>
selectNote:          (id: string | null) => void
toggleNoteSelection: (id: string) => void
clearSelection:      () => void
```

Initial state:

```typescript
selectedNoteIds: new Set<string>(),
```

Setters:

```typescript
selectNote:          (id) => set({ selectedNoteIds: id ? new Set([id]) : new Set() }),
toggleNoteSelection: (id) => set((s) => {
  const next = new Set(s.selectedNoteIds)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return { selectedNoteIds: next }
}),
clearSelection:      () => set({ selectedNoteIds: new Set() }),
```

- [ ] **Step 2: Update all readers**

```bash
grep -rln "selectedNoteId" apps/web/src/
```

For each match, replace `selectedNoteId === note.id` → `selectedNoteIds.has(note.id)`. Replace consumers that pass `isSelected` boolean. Notable files: `NoteCircle.tsx`, `TapNote.tsx`, `HoldNote.tsx`, `SwipeNote.tsx`, `PianoRoll.tsx`, `EditorPage.tsx`.

In `PianoRoll.tsx`, the existing `[selectedNote, setSelectedNote]` local state can be removed in favor of store. Update `handleNoteClick`:

```typescript
const handleNoteClick = useCallback((note: Note, e: React.MouseEvent) => {
  e.stopPropagation()
  if (e.shiftKey) toggleNoteSelection(note.id)
  else            selectNote(note.id)
  onNoteSelected?.(note)
  if (!e.shiftKey) setPopup({ type: 'edit', note, pos: { x: e.clientX, y: e.clientY } })
}, [onNoteSelected, selectNote, toggleNoteSelection])
```

Make sure `useEditorStore` destructures `selectedNoteIds, selectNote, toggleNoteSelection, clearSelection`.

In keyboard handler, change `Escape` to call `clearSelection()` instead of clearing single ID. Same for `Delete/Backspace`: iterate `selectedNoteIds` to delete each.

- [ ] **Step 3: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "refactor(editor): multi-select via selectedNoteIds Set in store"
```

---

## Task 7: Frontend — usePatterns hook

**Files:**
- Create: `apps/web/src/features/patterns/usePatterns.ts`

- [ ] **Step 1: Create hook file**

```typescript
// apps/web/src/features/patterns/usePatterns.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../auth/api'
import { useAuthStore } from '../../store/auth.store'
import type { NotePattern, PatternNote } from '@ama-midi/shared'

export function usePatterns() {
  const token = useAuthStore(s => s.token)
  return useQuery<NotePattern[]>({
    queryKey: ['patterns'],
    queryFn:  () => apiClient(token)<NotePattern[]>('/patterns'),
    enabled:  !!token,
  })
}

export function useCreatePattern() {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; notes: PatternNote[]; songId?: string }) =>
      apiClient(token)<NotePattern>('/patterns', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  })
}

export function useDeletePattern() {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(token)<void>(`/patterns/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patterns'] }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/patterns/
git commit -m "feat(patterns): usePatterns/useCreatePattern/useDeletePattern hooks"
```

---

## Task 8: MultiSelectBar component

**Files:**
- Create: `apps/web/src/features/editor/components/MultiSelectBar.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/web/src/features/editor/components/MultiSelectBar.tsx
import { Button } from '../../../components/ui'

interface Props {
  count:           number
  onSavePattern:   () => void
  onDelete:        () => void
  onDeselect:      () => void
}

export function MultiSelectBar({ count, onSavePattern, onDelete, onDeselect }: Props) {
  if (count < 2) return null
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 bg-shell-surface border border-shell-border rounded-full shadow-lg">
      <span className="text-xs text-shell-text font-medium">{count} selected</span>
      <Button size="sm" variant="secondary" onClick={onSavePattern}>📋 Save as Pattern</Button>
      <Button size="sm" variant="ghost"     onClick={onDelete}>🗑 Delete</Button>
      <Button size="sm" variant="ghost"     onClick={onDeselect}>✕</Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/MultiSelectBar.tsx
git commit -m "feat(editor): MultiSelectBar component"
```

---

## Task 9: SavePatternModal

**Files:**
- Create: `apps/web/src/features/editor/components/SavePatternModal.tsx`

- [ ] **Step 1: Create modal**

```typescript
// apps/web/src/features/editor/components/SavePatternModal.tsx
import { useState } from 'react'
import { Button, Input } from '../../../components/ui'
import { useCreatePattern } from '../../patterns/usePatterns'
import { toast } from 'sonner'
import type { Note, PatternNote } from '@ama-midi/shared'

interface Props {
  songId:        string
  selectedNotes: Note[]
  onClose:       () => void
}

export function SavePatternModal({ songId, selectedNotes, onClose }: Props) {
  const [name,  setName]  = useState('')
  const [scope, setScope] = useState<'song' | 'library'>('library')
  const create = useCreatePattern()

  async function handleSave() {
    if (!name.trim()) return
    const earliest = Math.min(...selectedNotes.map(n => n.time))
    const notes: PatternNote[] = selectedNotes.map(n => ({
      track:      n.track,
      timeOffset: n.time - earliest,
      noteType:   n.noteType ?? 'TAP',
      color:      n.color,
      duration:   n.duration,
    }))
    await create.mutateAsync({
      name:   name.trim(),
      notes,
      songId: scope === 'song' ? songId : undefined,
    })
    toast.success(`Pattern "${name.trim()}" saved`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div className="bg-shell-surface border border-shell-border rounded-xl p-6 w-80 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-shell-text mb-4">Save selection as pattern</h2>
        <label className="block text-xs text-shell-muted mb-1">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Verse Fill" autoFocus />
        <div className="flex flex-col gap-1 mt-4">
          <label className="text-xs text-shell-muted">Scope</label>
          <label className="flex items-center gap-2 text-xs">
            <input type="radio" checked={scope === 'song'}    onChange={() => setScope('song')} />
            This song only
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="radio" checked={scope === 'library'} onChange={() => setScope('library')} />
            My library (all songs)
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button size="sm" variant="ghost"   onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={handleSave} loading={create.isPending} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/SavePatternModal.tsx
git commit -m "feat(editor): SavePatternModal component"
```

---

## Task 10: PatternPanel

**Files:**
- Create: `apps/web/src/features/editor/components/PatternPanel.tsx`

- [ ] **Step 1: Create panel**

```typescript
// apps/web/src/features/editor/components/PatternPanel.tsx
import { usePatterns, useDeletePattern } from '../../patterns/usePatterns'
import { useCreateNote } from '../../notes/useNotes'
import { useEditorStore } from '../../../store/editor.store'
import { toast } from 'sonner'
import type { NotePattern } from '@ama-midi/shared'

interface Props { songId: string }

export function PatternPanel({ songId }: Props) {
  const { data: patterns = [] } = usePatterns()
  const deletePattern = useDeletePattern()
  const createNote    = useCreateNote(songId)
  const playheadTime  = useEditorStore(s => s.playheadTime)

  async function handlePaste(pattern: NotePattern) {
    let ok = 0, conflicts = 0
    for (const pn of pattern.notes) {
      try {
        await createNote.mutateAsync({
          track:    pn.track,
          time:     playheadTime + pn.timeOffset,
          title:    `${pattern.name} ${pn.track}`,
          color:    pn.color,
          noteType: pn.noteType,
          duration: pn.duration,
        })
        ok++
      } catch (e: any) {
        if (e?.status === 409) conflicts++
        else throw e
      }
    }
    const summary = `Pasted ${ok}/${pattern.notes.length} notes` + (conflicts ? ` (${conflicts} conflicts)` : '')
    if (conflicts) toast.warning(summary)
    else           toast.success(summary)
  }

  return (
    <div className="px-3 py-2 border-t border-shell-border">
      <div className="text-xs font-medium text-shell-text uppercase tracking-wide mb-2">Patterns</div>
      {patterns.length === 0 ? (
        <p className="text-[10px] text-shell-muted">No patterns yet. Select 2+ notes and save as pattern.</p>
      ) : (
        <ul className="space-y-1">
          {patterns.map(p => (
            <li key={p.id} className="flex items-center justify-between text-xs">
              <span className="truncate text-shell-text">{p.name} <span className="text-shell-muted">({p.notes.length})</span></span>
              <div className="flex gap-1">
                <button
                  onClick={() => handlePaste(p)}
                  className="px-1.5 py-0.5 text-[10px] rounded border border-shell-border text-shell-muted hover:text-shell-text"
                >
                  Paste
                </button>
                <button
                  onClick={() => deletePattern.mutate(p.id)}
                  className="px-1.5 py-0.5 text-[10px] rounded text-shell-muted/60 hover:text-error"
                  title="Delete pattern"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/PatternPanel.tsx
git commit -m "feat(editor): PatternPanel — list + paste at playhead"
```

---

## Task 11: useSections hook

**Files:**
- Create: `apps/web/src/features/sections/useSections.ts`

- [ ] **Step 1: Create hook**

```typescript
// apps/web/src/features/sections/useSections.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../auth/api'
import { useAuthStore } from '../../store/auth.store'
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
    mutationFn: (body: { time: number; label: string; color?: string }) =>
      apiClient(token)<SectionMarker>(`/songs/${songId}/sections`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', songId] }),
  })
}

export function useUpdateSection(songId: string) {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { label?: string; color?: string } }) =>
      apiClient(token)<SectionMarker>(`/songs/${songId}/sections/${id}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', songId] }),
  })
}

export function useDeleteSection(songId: string) {
  const token = useAuthStore(s => s.token)
  const qc    = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(token)<void>(`/songs/${songId}/sections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sections', songId] }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/sections/
git commit -m "feat(sections): useSections TanStack hooks"
```

---

## Task 12: useSocket — section-* event handlers

**Files:**
- Modify: `apps/web/src/features/collaboration/useSocket.ts`

- [ ] **Step 1: Add 3 section handlers**

In `useSocket.ts`, inside the existing `useEffect` after `socket.on('note-deleted', ...)`, add:

```typescript
socket.on('section-created', (section: SectionMarker) => {
  queryClient.setQueryData<SectionMarker[]>(['sections', songId], (old) =>
    old ? [...old, section].sort((a, b) => a.time - b.time) : [section])
})

socket.on('section-updated', (section: SectionMarker) => {
  queryClient.setQueryData<SectionMarker[]>(['sections', songId], (old) =>
    old ? old.map(s => s.id === section.id ? section : s) : [section])
})

socket.on('section-deleted', ({ id }: { id: string }) => {
  queryClient.setQueryData<SectionMarker[]>(['sections', songId], (old) =>
    old ? old.filter(s => s.id !== id) : [])
})
```

Add import:

```typescript
import type { Note, SectionMarker } from '@ama-midi/shared'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/collaboration/useSocket.ts
git commit -m "feat(realtime): section-created/updated/deleted handlers"
```

---

## Task 13: SectionMarkers overlay

**Files:**
- Create: `apps/web/src/features/editor/components/SectionMarkers.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/web/src/features/editor/components/SectionMarkers.tsx
import { timeToY } from '../engine'
import type { SectionMarker } from '@ama-midi/shared'

interface Props {
  sections:    SectionMarker[]
  pxPerSecond: number
}

export function SectionMarkers({ sections, pxPerSecond }: Props) {
  return (
    <>
      {sections.map(s => (
        <div
          key={s.id}
          className="absolute left-0 right-0 flex items-center px-2 pointer-events-none"
          style={{
            top:             timeToY(s.time, pxPerSecond),
            height:          20,
            backgroundColor: s.color + '22',
            borderTop:       `2px solid ${s.color}`,
            zIndex:          5,
          }}
        >
          <span className="text-[10px] font-medium" style={{ color: s.color }}>
            {s.label}
          </span>
        </div>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/SectionMarkers.tsx
git commit -m "feat(editor): SectionMarkers band overlay"
```

---

## Task 14: SectionCreatePopover

**Files:**
- Create: `apps/web/src/features/editor/components/SectionCreatePopover.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/web/src/features/editor/components/SectionCreatePopover.tsx
import { useState } from 'react'
import { SECTION_PRESETS } from '@ama-midi/shared'
import { useCreateSection } from '../../sections/useSections'
import { Button, Input } from '../../../components/ui'

interface Props {
  songId:  string
  time:    number
  pos:     { x: number; y: number }
  onClose: () => void
}

export function SectionCreatePopover({ songId, time, pos, onClose }: Props) {
  const [custom, setCustom]       = useState('')
  const [customColor, setCustomColor] = useState('#6C63FF')
  const create = useCreateSection(songId)

  function add(label: string, color: string) {
    create.mutate({ time, label, color }, { onSuccess: onClose })
  }

  return (
    <div
      className="fixed z-50 bg-shell-surface border border-shell-border rounded-lg shadow-lg p-3 w-64"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] text-shell-muted mb-2">Add section at {time.toFixed(1)}s</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {SECTION_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => add(p.label, p.color)}
            className="px-2 py-1 text-[10px] rounded border text-shell-text hover:opacity-80"
            style={{ borderColor: p.color, backgroundColor: p.color + '22' }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom label" />
        <input
          type="color"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer"
        />
        <Button size="sm" variant="primary" onClick={() => custom.trim() && add(custom.trim(), customColor)}>Add</Button>
      </div>
      <button onClick={onClose} className="absolute top-1 right-2 text-shell-muted hover:text-shell-text">✕</button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/SectionCreatePopover.tsx
git commit -m "feat(editor): SectionCreatePopover (presets + custom)"
```

---

## Task 15: SectionJumpList

**Files:**
- Create: `apps/web/src/features/editor/components/SectionJumpList.tsx`

- [ ] **Step 1: Create component**

```typescript
// apps/web/src/features/editor/components/SectionJumpList.tsx
import { useDeleteSection } from '../../sections/useSections'
import { useEditorStore } from '../../../store/editor.store'
import type { SectionMarker } from '@ama-midi/shared'

interface Props {
  songId:   string
  sections: SectionMarker[]
}

export function SectionJumpList({ songId, sections }: Props) {
  const playheadTime    = useEditorStore(s => s.playheadTime)
  const setPlayheadTime = useEditorStore(s => s.setPlayheadTime)
  const deleteSection   = useDeleteSection(songId)

  const currentIdx = sections.findIndex((s, i, arr) =>
    s.time <= playheadTime && (i === arr.length - 1 || arr[i + 1].time > playheadTime),
  )

  return (
    <div className="px-3 py-2 border-t border-shell-border">
      <div className="text-xs font-medium text-shell-text uppercase tracking-wide mb-2">Sections</div>
      {sections.length === 0 ? (
        <p className="text-[10px] text-shell-muted">No sections yet. Click the time axis to add one.</p>
      ) : (
        <ul className="space-y-0.5">
          {sections.map((s, i) => (
            <li
              key={s.id}
              className={
                'flex items-center justify-between text-xs px-1 py-0.5 rounded cursor-pointer ' +
                (i === currentIdx ? 'bg-shell-bg font-medium text-shell-text' : 'text-shell-muted hover:text-shell-text')
              }
              onClick={() => setPlayheadTime(s.time)}
              onContextMenu={(e) => {
                e.preventDefault()
                if (confirm(`Delete section "${s.label}"?`)) deleteSection.mutate(s.id)
              }}
            >
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="font-mono text-[10px]">{s.time.toFixed(1)}s</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/SectionJumpList.tsx
git commit -m "feat(editor): SectionJumpList with current highlight + right-click delete"
```

---

## Task 16: LiveContextStrip — current section enrichment

**Files:**
- Modify: `apps/web/src/features/editor/components/LiveContextStrip.tsx`

- [ ] **Step 1: Add sections prop + current label**

In `LiveContextStrip.tsx`, extend props:

```typescript
import type { Note, SectionMarker } from '@ama-midi/shared'

interface Props {
  playheadTime: number
  notes:        Note[]
  sections?:    SectionMarker[]
}
```

Inside component, find current section:

```typescript
const currentSection = sections
  ? [...sections].reverse().find(s => s.time <= playheadTime)
  : undefined
```

Render section name alongside existing content:

```tsx
{currentSection && (
  <span className="flex items-center gap-1 px-2 py-0.5 rounded" style={{ backgroundColor: currentSection.color + '22', color: currentSection.color }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentSection.color }} />
    {currentSection.label}
  </span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/LiveContextStrip.tsx
git commit -m "feat(editor): LiveContextStrip shows current section name"
```

---

## Task 17: TimeAxis click → SectionCreatePopover

**Files:**
- Modify: `apps/web/src/features/editor/components/TimeAxis.tsx`

- [ ] **Step 1: Add onAddSection prop**

Extend props in `TimeAxis.tsx`:

```typescript
export interface TimeAxisProps {
  pxPerSecond:    number
  scrollTop:      number
  bpm?:           number
  timeSignature?: string
  onAddSection?:  (time: number, e: React.MouseEvent) => void
}
```

Inside the outer `<div>` add `onClick`:

```tsx
<div
  className="shrink-0 relative overflow-hidden bg-canvas-surface border-r border-canvas-border cursor-pointer"
  style={{ width: TIME_AXIS_WIDTH }}
  onClick={(e) => {
    if (!onAddSection) return
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const y    = e.clientY - rect.top + scrollTop
    const time = Math.max(0, Math.min(300, Math.round((y / pxPerSecond) * 10) / 10))
    onAddSection(time, e)
  }}
>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/TimeAxis.tsx
git commit -m "feat(editor): TimeAxis click → onAddSection callback"
```

---

## Task 18: PianoRoll — render SectionMarkers + handle TimeAxis click

**Files:**
- Modify: `apps/web/src/features/editor/components/PianoRoll.tsx`

- [ ] **Step 1: Pull in sections + popover state**

Add imports:

```typescript
import { useSections } from '../../sections/useSections'
import { SectionMarkers } from './SectionMarkers'
import { SectionCreatePopover } from './SectionCreatePopover'
```

Inside `PianoRoll`:

```typescript
const { data: sections = [] } = useSections(songId)
const [sectionPopover, setSectionPopover] = useState<{ time: number; pos: { x: number; y: number } } | null>(null)
```

- [ ] **Step 2: Render SectionMarkers inside scroll container**

Inside `<div className="relative" style={{ height: totalHeight }}>`, after `<Playhead .../>`:

```tsx
<SectionMarkers sections={sections} pxPerSecond={pxPerSecond} />
```

- [ ] **Step 3: Pass onAddSection if TimeAxis is rendered here**

If `<TimeAxis>` is rendered inside PianoRoll, pass:

```tsx
<TimeAxis
  pxPerSecond={pxPerSecond}
  scrollTop={scrollTop}
  bpm={bpm}
  timeSignature={timeSignature}
  onAddSection={(time, e) => setSectionPopover({ time, pos: { x: e.clientX, y: e.clientY } })}
/>
```

If TimeAxis is rendered in `EditorPage`, do the same wiring there.

- [ ] **Step 4: Render popover**

End of `PianoRoll` return:

```tsx
{sectionPopover && (
  <SectionCreatePopover
    songId={songId}
    time={sectionPopover.time}
    pos={sectionPopover.pos}
    onClose={() => setSectionPopover(null)}
  />
)}
```

- [ ] **Step 5: Type-check + smoke**

```bash
cd apps/web && npx tsc --noEmit && pnpm dev
```

Click on TimeAxis at any Y → popover appears → pick preset → band appears at that time.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/PianoRoll.tsx
git commit -m "feat(editor): PianoRoll renders SectionMarkers + opens section popover from time axis"
```

---

## Task 19: EditorPage — mount MultiSelectBar, PatternPanel, SectionJumpList

**Files:**
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Add imports + state**

```typescript
import { MultiSelectBar }    from '../features/editor/components/MultiSelectBar'
import { SavePatternModal }  from '../features/editor/components/SavePatternModal'
import { PatternPanel }      from '../features/editor/components/PatternPanel'
import { SectionJumpList }   from '../features/editor/components/SectionJumpList'
import { useSections }       from '../features/sections/useSections'
import { useDeleteNote }     from '../features/notes/useNotes'
```

Inside `EditorPage`:

```typescript
const { selectedNoteIds, clearSelection } = useEditorStore()
const { data: sections = [] } = useSections(songId!)
const deleteNote = useDeleteNote(songId!)

const [showSavePattern, setShowSavePattern] = useState(false)

const selectedNotes = allNotes.filter(n => selectedNoteIds.has(n.id))
```

- [ ] **Step 2: Render MultiSelectBar at top of page**

Inside the outermost `<div className="relative">`:

```tsx
<MultiSelectBar
  count={selectedNoteIds.size}
  onSavePattern={() => setShowSavePattern(true)}
  onDelete={async () => {
    for (const id of selectedNoteIds) await deleteNote.mutateAsync(id)
    clearSelection()
  }}
  onDeselect={clearSelection}
/>

{showSavePattern && (
  <SavePatternModal
    songId={songId!}
    selectedNotes={selectedNotes}
    onClose={() => setShowSavePattern(false)}
  />
)}
```

- [ ] **Step 3: Append PatternPanel + SectionJumpList to leftPanel**

In the `leftPanel` JSX (after existing tracks list):

```tsx
<SectionJumpList songId={songId!} sections={sections} />
<PatternPanel    songId={songId!} />
```

- [ ] **Step 4: Pass sections to LiveContextStrip**

```tsx
<LiveContextStrip playheadTime={playheadTime} notes={allNotes} sections={sections} />
```

- [ ] **Step 5: Type-check + smoke**

```bash
cd apps/web && npx tsc --noEmit && pnpm dev
```

Open a song. Shift+click notes → MultiSelectBar appears. Save pattern → modal → pattern listed in PatternPanel. Click TimeAxis → add section → SectionJumpList row appears.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/EditorPage.tsx
git commit -m "feat(editor): EditorPage mounts MultiSelectBar, PatternPanel, SectionJumpList"
```

---

## Task 20: Backend tests — sections.service

**Files:**
- Create: `apps/api/src/modules/sections/__tests__/sections.service.spec.ts`

- [ ] **Step 1: Write test**

```typescript
// apps/api/src/modules/sections/__tests__/sections.service.spec.ts
import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SectionsService } from '../sections.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('SectionsService', () => {
  let service: SectionsService
  let prisma: any
  let events: { emit: jest.Mock }

  beforeEach(async () => {
    prisma = {
      sectionMarker: {
        findMany:    jest.fn().mockResolvedValue([]),
        findUnique:  jest.fn(),
        create:      jest.fn(),
        update:      jest.fn(),
        delete:      jest.fn(),
      },
    }
    events = { emit: jest.fn() }
    const mod = await Test.createTestingModule({
      providers: [
        SectionsService,
        { provide: PrismaService,  useValue: prisma },
        { provide: EventEmitter2,  useValue: events },
      ],
    }).compile()
    service = mod.get(SectionsService)
  })

  it('create emits section.created event', async () => {
    prisma.sectionMarker.create.mockResolvedValue({
      id: 's1', songId: 'sg', time: 12, label: 'Verse', color: '#6C63FF',
      createdBy: 'u1', createdAt: new Date(), creator: { name: 'Alice' },
    })
    await service.create('u1', 'sg', { time: 12, label: 'Verse' })
    expect(events.emit).toHaveBeenCalledWith('section.created', expect.objectContaining({
      songId: 'sg', section: expect.objectContaining({ label: 'Verse', creatorName: 'Alice' }),
    }))
  })

  it('delete emits section.deleted event with id', async () => {
    prisma.sectionMarker.findUnique.mockResolvedValue({ id: 's1', songId: 'sg' })
    prisma.sectionMarker.delete.mockResolvedValue({})
    await service.delete('sg', 's1')
    expect(events.emit).toHaveBeenCalledWith('section.deleted', { songId: 'sg', id: 's1' })
  })

  it('update throws if section belongs to other song', async () => {
    prisma.sectionMarker.findUnique.mockResolvedValue({ id: 's1', songId: 'other' })
    await expect(service.update('sg', 's1', { label: 'X' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run**

```bash
cd apps/api && pnpm test --testPathPattern=sections.service
```

Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/sections/__tests__/
git commit -m "test(sections): service emits correct events; cross-song update rejected"
```

---

## Task 21: Final verification

**Files:**
- (none)

- [ ] **Step 1: Full type-check**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && npx tsc --noEmit
cd /Users/hohoanghvy/Projects/ama-midi/apps/web && npx tsc --noEmit
```

Expected: both clean.

- [ ] **Step 2: Backend tests**

```bash
cd /Users/hohoanghvy/Projects/ama-midi/apps/api && pnpm test
```

- [ ] **Step 3: Build**

```bash
cd /Users/hohoanghvy/Projects/ama-midi && pnpm build
```

- [ ] **Step 4: Manual two-browser smoke**

1. Open same song in Tab A and Tab B.
2. Tab A: click time axis at 12s, pick "Verse" preset.
3. Tab B: within 1s, "Verse" band appears at 12s and shows up in SectionJumpList.
4. Tab A: shift+click 3 notes → MultiSelectBar appears → Save as Pattern modal → save.
5. Tab A: move playhead to 30s, click Paste on the pattern in PatternPanel → 3 notes appear at 30s+.
6. Tab B: those notes appear via existing `note-created` broadcast.

- [ ] **Step 5: Commit fixups if any**

```bash
git status
```

---

## Acceptance Criteria (from spec)

- [x] Shift+click toggles note into selection set
- [x] MultiSelectBar appears when size ≥ 2
- [x] Save as Pattern modal saves to `/patterns` with normalized `timeOffset`
- [x] Pattern panel lists own + global patterns
- [x] Paste places notes at `playheadTime + timeOffset`, reports `ok/total` + conflicts
- [x] Click TimeAxis opens section preset popover
- [x] Section bands render at correct time
- [x] Two-browser: section creation broadcasts via WebSocket within 1s
- [x] LiveContextStrip shows current section label
- [x] SectionJumpList highlights current, click jumps playhead
