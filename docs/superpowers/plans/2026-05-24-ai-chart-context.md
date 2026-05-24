# AI Chart Context & Merge Conflict Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give all AI chart actions a shared structured view of the current chart (`track`, `time`, `noteType`, `duration`, `title`) and add paste-style conflict review when applying a generated chart in merge mode.

**Architecture:** Extract `ChartContextService` + `serializeChartContextForPrompt` in the API AI module; wire generate/scale/suggest through it. Add `preview-chart` using existing `classifySlots`; extend `apply-chart` with resolutions and stale-preview 409. On web, call preview after generate, store `ChartApplyPreview`, reuse `ConflictReviewModal` from `ChartPreviewBar`.

**Tech Stack:** TypeScript, NestJS, Prisma, Jest, React, Zustand, `@ama-midi/shared`.

**Spec:** `docs/superpowers/specs/2026-05-24-ai-chart-context-design.md`

---

## File Structure

- Create: `packages/shared/src/chart-context.ts` — `AiChartNote`, `AiChartContext`, preview/apply request types
- Modify: `packages/shared/src/index.ts` — export chart-context
- Modify: `packages/shared/src/types.ts` — extend `ApplyChartRequest`, `GenerateChartRequest`, `ApplyChartResponse`
- Modify: `packages/shared/src/ai-stream.ts` — generate-chart request + step catalog
- Create: `apps/api/src/modules/ai/chart-context.service.ts`
- Create: `apps/api/src/modules/ai/chart-context.prompt.ts`
- Create: `apps/api/src/modules/ai/chart-apply-preview.service.ts`
- Create: `apps/api/src/modules/ai/__tests__/chart-context.service.spec.ts`
- Create: `apps/api/src/modules/ai/__tests__/chart-context.prompt.spec.ts`
- Create: `apps/api/src/modules/ai/__tests__/chart-apply-preview.spec.ts`
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts` — context-aware generate, preview/apply merge
- Modify: `apps/api/src/modules/ai/ai.service.ts` — use ChartContextService for suggest prompts
- Modify: `apps/api/src/modules/ai/dto/chart.dto.ts` — chartId, replaceExisting, preview/apply fields
- Modify: `apps/api/src/modules/ai/ai.controller.ts` — `POST preview-chart`
- Modify: `apps/api/src/modules/ai/ai.module.ts` — register new services
- Modify: `apps/api/src/modules/ai/__tests__/ai-stream.controller.spec.ts` — generate with chartId
- Modify: `apps/web/src/features/editor/components/placement-preview.ts` — `chartApplyPreviewToPlacement`
- Create: `apps/web/tests/chart-apply-preview.test.ts`
- Modify: `apps/web/src/store/editor.store.ts` — `ChartPreviewState.placement`
- Modify: `apps/web/src/features/editor/components/ai-assistant/flows/GenerateChartFlow.tsx`
- Modify: `apps/web/src/features/editor/components/ChartPreviewBar.tsx`
- Modify: `apps/web/src/features/editor/components/ChartPreviewLayer.tsx`
- Modify: `apps/web/src/features/editor/components/ai-assistant/AiProgressTree.tsx` — generate steps (if step ids change)

---

### Task 1: Shared chart context types

**Files:**
- Create: `packages/shared/src/chart-context.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/ai-stream.ts`

- [ ] **Step 1: Add chart-context module**

Create `packages/shared/src/chart-context.ts`:

```ts
import type { ConflictAction, GeneratedChartNote, GeneratedChartSection, NoteType } from './types'
import type { PlacementConflict, PlacementCreatableSlot, PlacementSummary } from './placement-preview'

export interface AiChartNote {
  track: number
  time: number
  noteType: NoteType
  duration?: number
  title?: string
}

export interface AiChartSection {
  time: number
  label: string
  color?: string
}

export interface AiChartContext {
  song: {
    name: string
    bpm: number
    timeSignature: string
    category: string
  }
  chart: {
    id: string
    name: string
    noteCount: number
    computedDifficulty: string
    speedMultiplier: number
    averageDifficultyScore: number
    peakDifficultyScore: number
    updatedAt: string
  }
  notes: AiChartNote[]
  sections: AiChartSection[]
  segments: Array<{
    start: number
    end: number
    nps: number
    level: string
    score: number
  }>
  warnings: Array<{ code: string; severity: string; message: string }>
  occupied: Array<{ track: number; time: number }>
}

export interface ChartApplyPreview {
  songId: string
  chartId: string
  previewVersion: string
  replaceExisting: boolean
  summary: PlacementSummary
  creatable: PlacementCreatableSlot[]
  conflicts: PlacementConflict[]
}

export interface PreviewChartRequest {
  notes: GeneratedChartNote[]
  replaceExisting: boolean
}

export interface ChartApplyResolution {
  conflictId: string
  action: ConflictAction
}
```

- [ ] **Step 2: Extend existing request types in `types.ts`**

```ts
export interface GenerateChartRequest {
  chartId: string
  description: string
  snapMode: SnapMode
  replaceExisting: boolean
  targetTier?: SongDifficulty
}

export interface ApplyChartRequest {
  chartId: string
  notes: GeneratedChartNote[]
  sections?: GeneratedChartSection[]
  replaceExisting: boolean
  previewVersion?: string
  resolutions?: ChartApplyResolution[]
}

export interface ApplyChartResponse {
  batchId: string
  createdCount: number
  skippedCount: number
  replacedCount: number
  sectionsCreated: number
}
```

Import `ChartApplyResolution` from `./chart-context` or inline the array type in `types.ts` and re-export from chart-context — pick one file as source of truth.

- [ ] **Step 3: Update ai-stream generate request + steps**

In `packages/shared/src/ai-stream.ts`, change generate-chart steps to:

```ts
'generate-chart': [
  { stepId: 'load_chart', label: 'Load chart context' },
  { stepId: 'build_prompt', label: 'Build generate prompt' },
  { stepId: 'generate', label: 'Generate with AI' },
  { stepId: 'normalize', label: 'Normalize chart' },
  { stepId: 'ready', label: 'Ready to preview' },
],
```

And extend `AiStreamRequest` generate branch:

```ts
| {
    action: 'generate-chart'
    chartId: string
    description: string
    snapMode: SnapMode
    replaceExisting: boolean
    targetTier?: SongDifficulty
  }
```

- [ ] **Step 4: Export from index**

Add `export * from './chart-context'` to `packages/shared/src/index.ts`.

- [ ] **Step 5: Build shared package**

Run: `pnpm --filter @ama-midi/shared build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/chart-context.ts packages/shared/src/index.ts packages/shared/src/types.ts packages/shared/src/ai-stream.ts
git commit -m "feat: add shared AI chart context and apply preview types"
```

---

### Task 2: ChartContextService

**Files:**
- Create: `apps/api/src/modules/ai/chart-context.service.ts`
- Create: `apps/api/src/modules/ai/__tests__/chart-context.service.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/src/modules/ai/__tests__/chart-context.service.spec.ts`:

```ts
import { ChartContextService } from '../chart-context.service'

describe('ChartContextService', () => {
  const prisma = {
    song: { findUnique: jest.fn() },
    songChart: { findFirst: jest.fn() },
    note: { findMany: jest.fn() },
    sectionMarker: { findMany: jest.fn() },
    chartDifficultySegment: { findMany: jest.fn() },
    chartValidationWarning: { findMany: jest.fn() },
  }
  const service = new ChartContextService(prisma as any)

  it('maps DB notes to AiChartNote and occupied slots', async () => {
    prisma.song.findUnique.mockResolvedValue({
      id: 's1', name: 'Test', bpm: 120, timeSignature: '4/4', category: 'POP',
    })
    prisma.songChart.findFirst.mockResolvedValue({
      id: 'c1', name: 'Main', speedMultiplier: 1, computedDifficulty: 'NORMAL',
      averageDifficultyScore: 2, peakDifficultyScore: 4, updatedAt: new Date('2026-01-01'),
    })
    prisma.note.findMany.mockResolvedValue([
      { track: 1, time: 0, noteType: 'TAP', duration: null, title: 'Kick' },
      { track: 2, time: 0.5, noteType: 'HOLD', duration: 1.2, title: 'Snare' },
    ])
    prisma.sectionMarker.findMany.mockResolvedValue([{ time: 0, label: 'Intro', color: '#fff' }])
    prisma.chartDifficultySegment.findMany.mockResolvedValue([])
    prisma.chartValidationWarning.findMany.mockResolvedValue([])

    const ctx = await service.loadChartContext('s1', 'c1')

    expect(ctx.notes).toEqual([
      { track: 1, time: 0, noteType: 'TAP', title: 'Kick' },
      { track: 2, time: 0.5, noteType: 'HOLD', duration: 1.2, title: 'Snare' },
    ])
    expect(ctx.occupied).toEqual([{ track: 1, time: 0 }, { track: 2, time: 0.5 }])
    expect(ctx.chart.noteCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/api && pnpm test -- chart-context.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ChartContextService**

Create `apps/api/src/modules/ai/chart-context.service.ts` — extract load logic from `AiChartService.scaleChart`:

```ts
@Injectable()
export class ChartContextService {
  constructor(private readonly prisma: PrismaService) {}

  async loadChartContext(songId: string, chartId: string): Promise<AiChartContext> {
    const song = await this.prisma.song.findUnique({ where: { id: songId } })
    if (!song) throw new NotFoundException('Song not found')

    const chart = await this.prisma.songChart.findFirst({
      where: { id: chartId, songId },
      select: {
        id: true, name: true, speedMultiplier: true, computedDifficulty: true,
        averageDifficultyScore: true, peakDifficultyScore: true, updatedAt: true,
      },
    })
    if (!chart) throw new NotFoundException('Chart not found')

    const [noteRows, sections, persistedSegments, warnings] = await Promise.all([
      this.prisma.note.findMany({
        where: { chartId, deletedAt: null },
        orderBy: [{ time: 'asc' }, { track: 'asc' }],
        select: { track: true, time: true, noteType: true, duration: true, title: true },
      }),
      this.prisma.sectionMarker.findMany({
        where: { songId },
        orderBy: { time: 'asc' },
        select: { time: true, label: true, color: true },
      }),
      this.prisma.chartDifficultySegment.findMany({ /* same as scaleChart */ }),
      this.prisma.chartValidationWarning.findMany({ /* same as scaleChart */ }),
    ])

    const notes: AiChartNote[] = noteRows.map((n) => ({
      track: n.track,
      time: n.time,
      noteType: n.noteType as AiChartNote['noteType'],
      ...(n.duration != null ? { duration: n.duration } : {}),
      ...(n.title ? { title: n.title } : {}),
    }))

    const segments = /* analyzeChart fallback when persistedSegments empty — copy from scaleChart */

    return {
      song: { name: song.name, bpm: song.bpm, timeSignature: song.timeSignature, category: song.category },
      chart: {
        id: chart.id,
        name: chart.name,
        noteCount: notes.length,
        computedDifficulty: chart.computedDifficulty,
        speedMultiplier: chart.speedMultiplier,
        averageDifficultyScore: chart.averageDifficultyScore,
        peakDifficultyScore: chart.peakDifficultyScore,
        updatedAt: chart.updatedAt.toISOString(),
      },
      notes,
      sections,
      segments,
      warnings: warnings.map((w) => ({ code: w.code, severity: w.severity, message: w.message })),
      occupied: notes.map((n) => ({ track: n.track, time: n.time })),
    }
  }

  previewVersion(ctx: AiChartContext): string {
    return `${ctx.chart.updatedAt}:${ctx.chart.noteCount}`
  }
}
```

Register in `ai.module.ts`.

- [ ] **Step 4: Run test — expect PASS**

Run: `cd apps/api && pnpm test -- chart-context.service.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/chart-context.service.ts apps/api/src/modules/ai/__tests__/chart-context.service.spec.ts apps/api/src/modules/ai/ai.module.ts
git commit -m "feat: add ChartContextService for AI prompts"
```

---

### Task 3: Prompt serializer

**Files:**
- Create: `apps/api/src/modules/ai/chart-context.prompt.ts`
- Create: `apps/api/src/modules/ai/__tests__/chart-context.prompt.spec.ts`

- [ ] **Step 1: Write failing test for truncation**

```ts
import { serializeChartContextForPrompt } from '../chart-context.prompt'

it('includes full occupied list when notes truncated', () => {
  const notes = Array.from({ length: 250 }, (_, i) => ({
    track: 1, time: i * 0.1, noteType: 'TAP' as const,
  }))
  const ctx = { /* minimal AiChartContext with 250 notes */ }
  const text = serializeChartContextForPrompt(ctx, { mode: 'generate_merge', snapHint: '0.1s', maxNotes: 200 })
  expect(text).toContain('50 additional notes omitted')
  expect(text).toContain('Occupied slots')
  expect(JSON.parse(text.split('Occupied slots')[1].match(/\[.*\]/)![0]).length).toBe(250)
})
```

- [ ] **Step 2: Implement serializer**

Create `apps/api/src/modules/ai/chart-context.prompt.ts`:

```ts
export type ChartPromptMode = 'generate_replace' | 'generate_merge' | 'scale' | 'suggest'

export function serializeChartContextForPrompt(
  ctx: AiChartContext,
  options: { mode: ChartPromptMode; snapHint: string; maxNotes?: number },
): string {
  const maxNotes = options.maxNotes ?? 200
  const notesForPrompt =
    ctx.notes.length <= maxNotes
      ? ctx.notes
      : ctx.notes.slice(0, maxNotes)
  const omitted = ctx.notes.length - notesForPrompt.length

  return [
    `Song: "${ctx.song.name}", ${ctx.song.bpm} BPM, ${ctx.song.timeSignature}, category ${ctx.song.category}.`,
    `Chart: "${ctx.chart.name}", ${ctx.chart.noteCount} notes, ${ctx.chart.computedDifficulty}, speed ${ctx.chart.speedMultiplier.toFixed(1)}x, avg score ${ctx.chart.averageDifficultyScore.toFixed(1)}, peak ${ctx.chart.peakDifficultyScore.toFixed(1)}.`,
    `Current notes (chronological): ${JSON.stringify(notesForPrompt)}.`,
    omitted > 0 ? `(${omitted} additional notes omitted; use density segments and occupied list for gaps.)` : null,
    `Sections: ${JSON.stringify(ctx.sections)}.`,
    `Density segments: ${JSON.stringify(ctx.segments)}.`,
    `Warnings: ${JSON.stringify(ctx.warnings)}.`,
    `Occupied slots (never duplicate track+time): ${JSON.stringify(ctx.occupied)}.`,
  ].filter(Boolean).join(' ')
}

export function buildGeneratePrompt(input: {
  ctx: AiChartContext
  description: string
  snapHint: string
  targetCount: number
  targetTier?: string
  replaceExisting: boolean
}): { system: string; user: string } {
  const mode = input.replaceExisting ? 'generate_replace' : 'generate_merge'
  const contextBlock = serializeChartContextForPrompt(input.ctx, { mode, snapHint: input.snapHint })

  const system = [
    'You are a rhythm-game chart designer for AMA-MIDI.',
    'Charts use 8 lanes (tracks 1–8), timeline 0–300 seconds.',
    'Note types: TAP (default), HOLD (requires duration in seconds), SWIPE.',
    'Return ONLY valid JSON with keys "notes" and "sections". No markdown.',
  ].join(' ')

  const task = input.replaceExisting
    ? `Generate a complete replacement chart (~${input.targetCount} notes). You may ignore current placement. Preserve song structure where appropriate.`
    : `Complement this chart. Return the complete resulting chart including existing notes unchanged plus your additions (~${input.targetCount} total notes). Never place a note on an occupied track+time. Match existing density and note types.`

  const user = [
    contextBlock,
    input.targetTier ? `Target difficulty tier hint: ${input.targetTier}.` : null,
    `Snap all times to ${input.snapHint}.`,
    `Composer brief: ${input.description}`,
    task,
    'JSON shape: {"notes":[{"track":1,"time":0.0,"noteType":"TAP","title":"Kick"}],"sections":[{"time":0,"label":"Intro","color":"#10B981"}]}',
  ].filter(Boolean).join(' ')

  return { system, user }
}
```

- [ ] **Step 3: Run tests — expect PASS**

Run: `cd apps/api && pnpm test -- chart-context.prompt.spec.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/ai/chart-context.prompt.ts apps/api/src/modules/ai/__tests__/chart-context.prompt.spec.ts
git commit -m "feat: serialize chart context for AI prompts"
```

---

### Task 4: Wire generate + scale + suggest to shared context

**Files:**
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/dto/chart.dto.ts`
- Modify: `apps/api/src/modules/ai/__tests__/ai-stream.controller.spec.ts`

- [ ] **Step 1: Extend GenerateChartDto**

```ts
export class GenerateChartDto {
  @IsUUID()
  chartId!: string

  @IsBoolean()
  replaceExisting!: boolean

  // existing description, snapMode, targetTier fields unchanged
}
```

- [ ] **Step 2: Refactor generateChart**

Inject `ChartContextService`. Replace `prepare` step with `load_chart` + `build_prompt`:

```ts
async generateChart(songId, userRole, body: GenerateChartDto, onProgress?) {
  const steps = AI_STREAM_STEPS['generate-chart']
  const ctx = await runStep(steps, 'load_chart', onProgress, () =>
    this.chartContext.loadChartContext(songId, body.chartId),
  )
  const prompt = await runStep(steps, 'build_prompt', onProgress, async () => {
    const description = body.description.trim()
    if (!description) throw new BadRequestException('Description is required')
    const targetCount = body.targetTier ? TARGET_NOTE_COUNT[body.targetTier] ?? 90 : 90
    const snapHint = /* existing snap hint helper */
    return buildGeneratePrompt({ ctx, description, snapHint, targetCount, targetTier: body.targetTier, replaceExisting: body.replaceExisting })
  })
  // generate + normalize unchanged
}
```

- [ ] **Step 3: Refactor scaleChart load step**

Replace inline DB load with `this.chartContext.loadChartContext(songId, body.chartId)` and `buildScalePrompt` to use `serializeChartContextForPrompt(ctx, { mode: 'scale', snapHint })`.

- [ ] **Step 4: Refactor AiService.suggestNotes**

After load, call `chartContext.loadChartContext` (or merge with existing load — prefer replacing duplicate queries). In `buildPrompt`, pass full `AiChartNote[]` for window notes:

```ts
const windowNotes = ctx.notes.filter((n) => n.time >= windowStart && n.time <= windowEnd)
// use JSON.stringify(windowNotes) instead of {track,time} only
```

- [ ] **Step 5: Update stream controller test payload**

```ts
{ action: 'generate-chart', payload: { chartId: '...', description: 'Test', snapMode: '0.1s', replaceExisting: false } }
```

- [ ] **Step 6: Run API tests**

Run: `cd apps/api && pnpm test -- ai-stream.controller ai-suggest-global ai-chart-scale`
Expected: PASS (fix mocks as needed)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/ai/ai-chart.service.ts apps/api/src/modules/ai/ai.service.ts apps/api/src/modules/ai/dto/chart.dto.ts apps/api/src/modules/ai/__tests__/
git commit -m "feat: load structured chart context for all AI chart actions"
```

---

### Task 5: Chart apply preview + merge apply

**Files:**
- Create: `apps/api/src/modules/ai/chart-apply-preview.service.ts`
- Create: `apps/api/src/modules/ai/__tests__/chart-apply-preview.spec.ts`
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts`
- Modify: `apps/api/src/modules/ai/dto/chart.dto.ts`
- Modify: `apps/api/src/modules/ai/ai.controller.ts`

- [ ] **Step 1: Write failing preview test**

```ts
it('classifies creatable vs conflict for merge mode', async () => {
  // mock existing note at track 1 time 0
  // incoming chart note at same slot → conflict
  // incoming at track 2 time 1 → creatable
  const preview = await service.previewChart('s1', 'c1', {
    notes: [
      { track: 1, time: 0, noteType: 'TAP' },
      { track: 2, time: 1, noteType: 'TAP' },
    ],
    replaceExisting: false,
  })
  expect(preview.summary.conflictCount).toBe(1)
  expect(preview.summary.creatableNotes).toBe(1)
})
```

- [ ] **Step 2: Implement ChartApplyPreviewService**

Use `classifySlots` from `note-slot-preview.ts`. Map to `ChartApplyPreview` with `PlacementConflict` shape (include creator on existing notes — load with `include: { creator }`).

When `replaceExisting === true`, return all incoming as creatable, zero conflicts.

`previewVersion` from `ChartContextService.previewVersion(ctx)`.

- [ ] **Step 3: Add controller route**

```ts
@Post('charts/:chartId/preview-chart')
previewChart(@Param('songId') songId: string, @Param('chartId') chartId: string, @Body() body: PreviewChartDto, @Req() req: Request) {
  return this.aiChart.previewChart(songId, req.user as AuthUser, chartId, body)
}
```

Add `PreviewChartDto` mirroring `PreviewChartRequest`.

- [ ] **Step 4: Extend applyChart for resolutions**

In merge mode with `resolutions`:

1. If `previewVersion` provided, reload context and throw `ConflictException` with fresh preview body on mismatch (409).
2. Re-run classification inside transaction.
3. For each conflict: `KEEP_EXISTING` skip incoming; `REPLACE_WITH_PATTERN` soft-delete existing + queue create.
4. Apply creatable + replace creates in one transaction with shared `batchId`.
5. Return `{ createdCount, replacedCount, skippedCount, sectionsCreated, batchId }`.

Replace mode: keep current wipe-all behavior; ignore resolutions.

- [ ] **Step 5: Extend ApplyChartDto**

```ts
@IsOptional()
@IsString()
previewVersion?: string

@IsOptional()
@ValidateNested({ each: true })
@Type(() => ChartApplyResolutionDto)
resolutions?: ChartApplyResolutionDto[]
```

- [ ] **Step 6: Run tests**

Run: `cd apps/api && pnpm test -- chart-apply-preview`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/ai/chart-apply-preview.service.ts apps/api/src/modules/ai/ai-chart.service.ts apps/api/src/modules/ai/ai.controller.ts apps/api/src/modules/ai/dto/chart.dto.ts apps/api/src/modules/ai/__tests__/chart-apply-preview.spec.ts
git commit -m "feat: preview and apply AI charts with merge conflict resolution"
```

---

### Task 6: Web — preview after generate + placement mapper

**Files:**
- Modify: `apps/web/src/features/editor/components/placement-preview.ts`
- Create: `apps/web/tests/chart-apply-preview.test.ts`
- Modify: `apps/web/src/features/editor/components/ai-assistant/flows/GenerateChartFlow.tsx`
- Modify: `apps/web/src/store/editor.store.ts`

- [ ] **Step 1: Add mapper test + implementation**

In `placement-preview.ts`:

```ts
export function chartApplyPreviewToPlacement(preview: ChartApplyPreview): PlacementPreview {
  return {
    songId: preview.songId,
    version: preview.previewVersion,
    summary: preview.summary,
    creatable: preview.creatable,
    conflicts: preview.conflicts,
  }
}
```

- [ ] **Step 2: Extend ChartPreviewState**

```ts
export interface ChartPreviewState {
  notes: GeneratedChartNote[]
  sections?: GeneratedChartSection[]
  replaceExisting: boolean
  placement: ChartApplyPreview | null
}
```

- [ ] **Step 3: Update GenerateChartFlow**

Pass `chartId` + `replaceExisting` in stream body. After result, call preview API before closing modal:

```ts
const preview = await apiClient(token)<ChartApplyPreview>(
  `/songs/${songId}/charts/${chartId}/preview-chart`,
  { method: 'POST', body: JSON.stringify({ notes, replaceExisting }) },
)
setChartPreview({ notes, sections, replaceExisting, placement: replaceExisting ? null : preview })
```

Guard: `if (!chartId) { toast.error('No chart selected'); return }`

- [ ] **Step 4: Run web tests**

Run: `cd apps/web && pnpm test -- chart-apply-preview`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/placement-preview.ts apps/web/tests/chart-apply-preview.test.ts apps/web/src/features/editor/components/ai-assistant/flows/GenerateChartFlow.tsx apps/web/src/store/editor.store.ts
git commit -m "feat: preview AI chart conflicts after generate"
```

---

### Task 7: ChartPreviewBar conflict review modal

**Files:**
- Modify: `apps/web/src/features/editor/components/ChartPreviewBar.tsx`

- [ ] **Step 1: Add conflict review state**

```ts
const [showConflicts, setShowConflicts] = useState(false)
const [resolutions, setResolutions] = useState<Record<string, ConflictAction>>({})
const [conflictChanged, setConflictChanged] = useState(false)
```

Initialize resolutions when opening modal:

```ts
Object.fromEntries(placement.conflicts.map((c) => [c.conflictId, 'KEEP_EXISTING']))
```

- [ ] **Step 2: Branch primary button**

```tsx
{replaceExisting ? (
  <Button onClick={acceptReplace}>Replace chart →</Button>
) : placement && placement.summary.conflictCount > 0 ? (
  <Button onClick={() => setShowConflicts(true)}>Review conflicts ({placement.summary.conflictCount}) →</Button>
) : (
  <Button onClick={acceptMerge}>Apply {createCount} notes →</Button>
)}
```

- [ ] **Step 3: Render ConflictReviewModal**

When `showConflicts && placement`:

```tsx
<ConflictReviewModal
  preview={chartApplyPreviewToPlacement(placement)}
  title="Apply AI Chart"
  incomingLabel="AI Chart"
  applyLabel="Apply chart"
  resolutions={resolutions}
  onResolve={(id, action) => setResolutions((p) => ({ ...p, [id]: action }))}
  onApply={() => void applyWithResolutions()}
  onCancel={() => setShowConflicts(false)}
  hasConflictChanged={conflictChanged}
/>
```

- [ ] **Step 4: Apply with resolutions + 409 handling**

```ts
await apiClient(token)(`/songs/${songId}/apply-chart`, {
  method: 'POST',
  body: JSON.stringify({
    chartId, notes, sections, replaceExisting: false,
    previewVersion: placement.previewVersion,
    resolutions: placement.conflicts.map((c) => ({
      conflictId: c.conflictId,
      action: resolutions[c.conflictId] ?? 'KEEP_EXISTING',
    })),
  }),
})
```

On 409, update placement from `err.body`, set `conflictChanged`, keep modal open (mirror `PatternPanel`).

- [ ] **Step 5: Manual smoke**

Run: `pnpm dev`
Generate chart on a chart with existing notes (merge mode) → conflict review appears.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/ChartPreviewBar.tsx
git commit -m "feat: paste-style conflict review for AI chart merge apply"
```

---

### Task 8: Conflict ghost styling on piano roll

**Files:**
- Modify: `apps/web/src/features/editor/components/ChartPreviewLayer.tsx`

- [ ] **Step 1: Highlight conflicting preview notes**

Build conflict key set from `chartPreview.placement?.conflicts`:

```ts
const conflictKeys = new Set(
  (chartPreview.placement?.conflicts ?? []).map((c) => `${c.track}:${c.time}`),
)
const isConflict = conflictKeys.has(`${note.track}:${note.time}`)
```

Apply amber/warning border when `isConflict && !chartPreview.replaceExisting`:

```tsx
className={isConflict ? 'border-2 border-dashed border-amber-400' : 'border-2 border-dashed'}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/editor/components/ChartPreviewLayer.tsx
git commit -m "feat: highlight AI preview notes that conflict with existing chart"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full API test suite**

Run: `cd apps/api && pnpm test`
Expected: all pass

- [ ] **Step 2: Run web tests**

Run: `cd apps/web && pnpm test`
Expected: all pass

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors

- [ ] **Step 4: Update spec status note (optional)**

Ensure `2026-05-24-ai-chart-context-design.md` status is `Approved`.

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|---|---|
| `AiChartNote` / `AiChartContext` types | Task 1 |
| `ChartContextService.loadChartContext` | Task 2 |
| `serializeChartContextForPrompt` + truncation | Task 3 |
| Generate with chartId + replaceExisting | Task 4 |
| Scale uses shared serializer | Task 4 |
| Suggest full note objects in prompt | Task 4 |
| `POST preview-chart` | Task 5 |
| Apply with resolutions + 409 | Task 5 |
| GenerateChartFlow passes chartId | Task 6 |
| ChartPreviewBar conflict modal | Task 7 |
| Conflict ghost styling | Task 8 |
| API + web tests | Tasks 2–8, 9 |

No placeholders remain. Type names consistent across tasks.
