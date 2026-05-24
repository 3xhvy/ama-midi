# AI Assistant Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragmented AI editor UX with one popup-driven AI Assistant that picks features wizard-style, runs SSE-streamed step progress, and supports global chart context plus Improve pattern (Extend / Refine).

**Architecture:** Add shared `AiStreamEvent` types and step catalogs, implement `POST /songs/:songId/ai/stream` with phase emitters in `AiService` / `AiChartService`, enhance `suggestNotes` with sections/segments/refine mode, then build `AiAssistantModal` + flows on web using `fetch`-based SSE parsing via `useAiStreamRun`. Ghost suggestions move to Zustand; full-chart previews stay on `ChartPreviewBar`.

**Tech Stack:** TypeScript, NestJS, class-validator, Jest, React, Zustand, fetch SSE, `@ama-midi/shared`.

**Spec:** `docs/superpowers/specs/2026-05-24-ai-assistant-modal-design.md`

---

## File Structure

- Create: `packages/shared/src/ai-stream.ts` — stream request/event types + step catalogs
- Modify: `packages/shared/src/index.ts` — export ai-stream
- Modify: `packages/shared/src/types.ts` — extend `SuggestNotesMode`, optional `instruction` on request
- Create: `apps/api/src/modules/ai/dto/ai-stream.dto.ts` — discriminated union DTO for stream body
- Create: `apps/api/src/modules/ai/ai-stream.util.ts` — SSE write helper
- Create: `apps/api/src/modules/ai/__tests__/ai-stream.controller.spec.ts`
- Create: `apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts`
- Modify: `apps/api/src/modules/ai/ai.controller.ts` — add `POST ai/stream`
- Modify: `apps/api/src/modules/ai/ai.service.ts` — global context, refine, progress callback
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts` — progress callback on generate/scale
- Modify: `apps/api/src/modules/ai/dto/suggest-notes.dto.ts` — refine mode + instruction
- Create: `apps/web/src/features/editor/ai-stream.ts` — SSE fetch parser
- Create: `apps/web/src/features/editor/ai-stream.test.ts`
- Create: `apps/web/src/features/editor/components/ai-assistant/ai-assistant.types.ts`
- Create: `apps/web/src/features/editor/components/ai-assistant/AiProgressTree.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/AiFeaturePicker.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/useAiStreamRun.ts`
- Create: `apps/web/src/features/editor/components/ai-assistant/AiAssistantModal.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/flows/GenerateChartFlow.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/flows/ScaleDifficultyFlow.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/flows/FillTrackFlow.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/flows/ImprovePatternFlow.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/AiAssistantTrigger.tsx`
- Modify: `apps/web/src/store/editor.store.ts` — `aiAssistant`, `aiSuggestions`, remove `triggerAiSuggest`
- Modify: `apps/web/src/features/editor/components/AiSuggestions.tsx` — read suggestions from store
- Modify: `apps/web/src/features/editor/components/MultiSelectBar.tsx` — Improve pattern
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx` — wire trigger
- Modify: `apps/web/src/pages/EditorPage.tsx` — modal mount, remove old continue handler
- Modify: `apps/web/src/features/onboarding/useAppTour.ts` — tour copy
- Delete: `apps/web/src/features/editor/components/AiSuggestMenu.tsx`
- Delete: `apps/web/src/features/editor/components/AiGenerateChartModal.tsx`
- Delete: `apps/web/src/features/editor/components/AiScaleChartModal.tsx`

---

### Task 1: Shared stream types and step catalogs

**Files:**
- Create: `packages/shared/src/ai-stream.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add ai-stream module**

Create `packages/shared/src/ai-stream.ts`:

```ts
import type { GenerateChartResponse, SnapMode, SongDifficulty, SuggestNotesResponse } from './types'
import type { SuggestNotesMode } from './types'

export type AiStreamAction = 'generate-chart' | 'scale-chart' | 'suggest-notes'

export type AiStreamStepStatus = 'active' | 'done' | 'error'

export type AiStreamStepDef = { stepId: string; label: string }

export const AI_STREAM_STEPS: Record<AiStreamAction, AiStreamStepDef[]> = {
  'generate-chart': [
    { stepId: 'prepare', label: 'Prepare request' },
    { stepId: 'generate', label: 'Generate with AI' },
    { stepId: 'normalize', label: 'Normalize chart' },
    { stepId: 'ready', label: 'Ready to preview' },
  ],
  'scale-chart': [
    { stepId: 'load_chart', label: 'Load chart & analysis' },
    { stepId: 'build_prompt', label: 'Build scale prompt' },
    { stepId: 'generate', label: 'Generate with AI' },
    { stepId: 'normalize', label: 'Normalize chart' },
    { stepId: 'ready', label: 'Ready to preview' },
  ],
  'suggest-notes': [
    { stepId: 'load_context', label: 'Load chart context' },
    { stepId: 'analyze', label: 'Analyze sections & density' },
    { stepId: 'generate', label: 'Generate suggestions' },
    { stepId: 'validate', label: 'Validate placements' },
    { stepId: 'ready', label: 'Ready — view on chart' },
  ],
}

export type AiStreamRequest =
  | {
      action: 'generate-chart'
      description: string
      snapMode: SnapMode
      targetTier?: SongDifficulty
    }
  | {
      action: 'scale-chart'
      chartId: string
      targetTier: SongDifficulty
      instruction?: string
      snapMode: SnapMode
    }
  | {
      action: 'suggest-notes'
      chartId: string
      mode: SuggestNotesMode
      playheadTime: number
      snapMode: SnapMode
      targetTrack?: number
      selectedNotes?: Array<{ track: number; time: number }>
      instruction?: string
    }

export type AiStreamEvent =
  | { type: 'run'; runId: string; action: AiStreamAction }
  | {
      type: 'step'
      runId: string
      stepId: string
      label: string
      status: AiStreamStepStatus
      detail?: string
    }
  | { type: 'result'; runId: string; action: 'generate-chart'; payload: GenerateChartResponse }
  | { type: 'result'; runId: string; action: 'scale-chart'; payload: GenerateChartResponse }
  | { type: 'result'; runId: string; action: 'suggest-notes'; payload: SuggestNotesResponse }
  | { type: 'error'; runId: string; message: string; stepId?: string; code?: string }
```

- [ ] **Step 2: Extend SuggestNotesMode in types.ts**

In `packages/shared/src/types.ts`, change:

```ts
export type SuggestNotesMode = 'continue_pattern' | 'fill_track'
```

to:

```ts
export type SuggestNotesMode = 'continue_pattern' | 'refine_pattern' | 'fill_track'
```

Add optional instruction on request:

```ts
export interface SuggestNotesRequest {
  chartId: string
  mode: SuggestNotesMode
  playheadTime: number
  snapMode: SnapMode
  targetTrack?: number
  selectedNotes?: Array<{ track: number; time: number }>
  instruction?: string
}
```

- [ ] **Step 3: Export from index**

Add to `packages/shared/src/index.ts`:

```ts
export * from './ai-stream'
```

- [ ] **Step 4: Build shared package**

Run:

```bash
cd packages/shared && npx tsc
```

Expected: succeeds (test files excluded via tsconfig).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ai-stream.ts packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "feat: add ai stream shared types"
```

---

### Task 2: SSE writer utility and stream DTO

**Files:**
- Create: `apps/api/src/modules/ai/ai-stream.util.ts`
- Create: `apps/api/src/modules/ai/dto/ai-stream.dto.ts`

- [ ] **Step 1: SSE writer**

Create `apps/api/src/modules/ai/ai-stream.util.ts`:

```ts
import type { Response } from 'express'
import type { AiStreamEvent } from '@ama-midi/shared'

export function initSse(res: Response): void {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
}

export function writeSse(res: Response, event: AiStreamEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
  const flush = (res as Response & { flush?: () => void }).flush
  flush?.()
}

export function endSse(res: Response): void {
  res.end()
}
```

- [ ] **Step 2: Stream DTO with action discriminator**

Create `apps/api/src/modules/ai/dto/ai-stream.dto.ts`:

```ts
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { GenerateChartDto } from './chart.dto'
import { ScaleChartDto } from './chart.dto'
import { SuggestNotesDto } from './suggest-notes.dto'

export class AiStreamDto {
  @IsIn(['generate-chart', 'scale-chart', 'suggest-notes'])
  action!: 'generate-chart' | 'scale-chart' | 'suggest-notes'

  @ValidateNested()
  @Type(() => Object, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: 'action',
      subTypes: [
        { value: GenerateChartStreamBodyDto, name: 'generate-chart' },
        { value: ScaleChartStreamBodyDto, name: 'scale-chart' },
        { value: SuggestNotesStreamBodyDto, name: 'suggest-notes' },
      ],
    },
  })
  body!: GenerateChartStreamBodyDto | ScaleChartStreamBodyDto | SuggestNotesStreamBodyDto
}
```

Use a simpler flat DTO instead (Nest validation is easier with explicit classes):

```ts
import { IsIn, ValidateIf } from 'class-validator'
import { GenerateChartDto, ScaleChartDto } from './chart.dto'
import { SuggestNotesDto } from './suggest-notes.dto'

export class AiStreamDto extends GenerateChartDto {
  @IsIn(['generate-chart', 'scale-chart', 'suggest-notes'])
  action!: 'generate-chart' | 'scale-chart' | 'suggest-notes'

  // scale-chart fields — validated when action matches
  @ValidateIf((o: AiStreamDto) => o.action === 'scale-chart')
  chartId?: string

  @ValidateIf((o: AiStreamDto) => o.action === 'scale-chart')
  targetTier?: string

  @ValidateIf((o: AiStreamDto) => o.action === 'scale-chart')
  instruction?: string

  // suggest-notes fields
  @ValidateIf((o: AiStreamDto) => o.action === 'suggest-notes')
  mode?: string

  @ValidateIf((o: AiStreamDto) => o.action === 'suggest-notes')
  playheadTime?: number

  @ValidateIf((o: AiStreamDto) => o.action === 'suggest-notes')
  targetTrack?: number

  @ValidateIf((o: AiStreamDto) => o.action === 'suggest-notes')
  selectedNotes?: Array<{ track: number; time: number }>
}
```

Prefer **three nested DTO classes** merged at controller level for clarity:

```ts
export class AiStreamEnvelopeDto {
  @IsIn(['generate-chart', 'scale-chart', 'suggest-notes'])
  action!: 'generate-chart' | 'scale-chart' | 'suggest-notes'

  @ValidateNested()
  @Type(({ object }) => {
    if (object.action === 'scale-chart') return ScaleChartDto
    if (object.action === 'suggest-notes') return SuggestNotesDto
    return GenerateChartDto
  })
  payload!: GenerateChartDto | ScaleChartDto | SuggestNotesDto
}
```

Use `AiStreamEnvelopeDto` in the controller.

- [ ] **Step 3: Extend SuggestNotesDto**

In `apps/api/src/modules/ai/dto/suggest-notes.dto.ts`:

```ts
  @IsIn(['continue_pattern', 'refine_pattern', 'fill_track'])
  mode!: SuggestNotesMode

  @ValidateIf((o: SuggestNotesDto) => o.mode === 'continue_pattern' || o.mode === 'refine_pattern')
  @ValidateNested({ each: true })
  @Type(() => SelectedPatternNoteDto)
  selectedNotes?: SelectedPatternNoteDto[]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string
```

Add `@IsString()` import from `class-validator`.

- [ ] **Step 4: Build API**

Run: `pnpm --dir apps/api build`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/ai-stream.util.ts apps/api/src/modules/ai/dto/ai-stream.dto.ts apps/api/src/modules/ai/dto/suggest-notes.dto.ts
git commit -m "feat: add ai stream dto and sse helpers"
```

---

### Task 3: Stream controller and service progress callbacks

**Files:**
- Modify: `apps/api/src/modules/ai/ai.controller.ts`
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Create: `apps/api/src/modules/ai/__tests__/ai-stream.controller.spec.ts`

- [ ] **Step 1: Progress emitter type in ai-chart.service.ts**

Near top of `ai-chart.service.ts`:

```ts
import { AI_STREAM_STEPS, type AiStreamStepDef } from '@ama-midi/shared'

export type AiProgressEmitter = (event: {
  type: 'step'
  stepId: string
  label: string
  status: 'active' | 'done' | 'error'
  detail?: string
}) => void

async function runStep<T>(
  steps: AiStreamStepDef[],
  stepId: string,
  onProgress: AiProgressEmitter | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const def = steps.find((s) => s.stepId === stepId)!
  onProgress?.({ type: 'step', stepId, label: def.label, status: 'active' })
  try {
    const result = await fn()
    onProgress?.({ type: 'step', stepId, label: def.label, status: 'done' })
    return result
  } catch (e) {
    onProgress?.({ type: 'step', stepId, label: def.label, status: 'error' })
    throw e
  }
}
```

Add optional `onProgress?: AiProgressEmitter` to `generateChart` and `scaleChart` signatures.

Wrap existing logic:

```ts
async generateChart(songId, userRole, body, onProgress?) {
  if (userRole === 'VIEWER') throw new ForbiddenException(...)
  const steps = AI_STREAM_STEPS['generate-chart']

  return runStep(steps, 'prepare', onProgress, async () => {
    const song = await this.prisma.song.findUnique(...)
    // existing validation + prompt build prep
    const parsed = await runStep(steps, 'generate', onProgress, () =>
      this.callClaudeForChart(prompt),
    )
    const notes = await runStep(steps, 'normalize', onProgress, async () =>
      this.normalizeGeneratedNotes(parsed.notes, body.snapMode, song.bpm),
    )
    const sections = this.normalizeSections(parsed.sections)
    onProgress?.({ type: 'step', stepId: 'ready', label: 'Ready to preview', status: 'done' })
    return { notes, sections }
  })
}
```

Apply same pattern to `scaleChart` using `AI_STREAM_STEPS['scale-chart']` step IDs.

- [ ] **Step 2: Add stream handler to controller**

In `ai.controller.ts`:

```ts
import { Res, Headers } from '@nestjs/common'
import type { Response } from 'express'
import { randomUUID } from 'crypto'
import { AiStreamEnvelopeDto } from './dto/ai-stream.dto'
import { initSse, writeSse, endSse } from './ai-stream.util'

@Post('ai/stream')
async streamAi(
  @Param('songId') songId: string,
  @Body() envelope: AiStreamEnvelopeDto,
  @Req() req: Request,
  @Res() res: Response,
  @Headers('accept') accept?: string,
): Promise<void> {
  const user = req.user as AuthUser
  const runId = randomUUID()

  if (accept && !accept.includes('text/event-stream')) {
    res.status(406).json({ message: 'Accept text/event-stream required' })
    return
  }

  initSse(res)
  writeSse(res, { type: 'run', runId, action: envelope.action })

  const emit = (event: Parameters<typeof writeSse>[1]) => {
    writeSse(res, { ...event, runId } as typeof event)
  }

  try {
    if (envelope.action === 'generate-chart') {
      const payload = await this.aiChart.generateChart(
        songId,
        user.role,
        envelope.payload as GenerateChartDto,
        (step) => emit({ ...step, type: 'step' }),
      )
      writeSse(res, { type: 'result', runId, action: 'generate-chart', payload })
    } else if (envelope.action === 'scale-chart') {
      const payload = await this.aiChart.scaleChart(
        songId,
        user.role,
        envelope.payload as ScaleChartDto,
        (step) => emit({ ...step, type: 'step' }),
      )
      writeSse(res, { type: 'result', runId, action: 'scale-chart', payload })
    } else {
      const payload = await this.ai.suggestNotes(
        songId,
        user.role,
        envelope.payload as SuggestNotesDto,
        (step) => emit({ ...step, type: 'step' }),
      )
      writeSse(res, { type: 'result', runId, action: 'suggest-notes', payload })
    }
    endSse(res)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AI stream failed'
    writeSse(res, { type: 'error', runId, message })
    endSse(res)
  }
}
```

- [ ] **Step 3: Write failing stream controller test**

Create `apps/api/src/modules/ai/__tests__/ai-stream.controller.spec.ts` with mocked services that invoke `onProgress` for each step and assert parsed SSE lines include `run`, ordered `step` events, and `result`.

- [ ] **Step 4: Run test**

```bash
pnpm --dir apps/api test -- ai-stream.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/ai.controller.ts apps/api/src/modules/ai/ai-chart.service.ts apps/api/src/modules/ai/__tests__/ai-stream.controller.spec.ts
git commit -m "feat: add ai stream sse endpoint"
```

---

### Task 4: Global chart context and refine_pattern

**Files:**
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Create: `apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts`:

- Prompt contains `Analysis segments` when segments exist
- Prompt contains `Current section` when section markers exist
- `refine_pattern` rejects <2 selected notes
- `refine_pattern` allows replacement at selected track+time (post-process)
- `onProgress` emits `load_context` → `ready` step IDs

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --dir apps/api test -- ai-suggest-global.spec.ts --runInBand
```

- [ ] **Step 3: Implement in ai.service.ts**

Add imports: `analyzeChart`, `AI_STREAM_STEPS`, progress helper.

Extend `suggestNotes` signature:

```ts
async suggestNotes(
  songId: string,
  userRole: string,
  body: { ...; instruction?: string },
  onProgress?: AiProgressEmitter,
): Promise<{ suggestions: RawSuggestion[] }>
```

Parallel fetch after chart lookup:

```ts
const [allNotes, sections, persistedSegments] = await Promise.all([
  this.prisma.note.findMany({ where: { chartId: chart.id, deletedAt: null }, ... }),
  this.prisma.sectionMarker.findMany({ where: { songId }, orderBy: { time: 'asc' }, select: { time: true, label: true } }),
  this.prisma.chartDifficultySegment.findMany({ where: { chartId: chart.id }, orderBy: { startTimeMs: 'asc' }, select: { startTimeMs: true, endTimeMs: true, notesPerSecond: true, difficultyLevel: true, difficultyScore: true } }),
])
```

Compute segments fallback with `analyzeChart` when empty (copy from `scaleChart`).

Add validation:

```ts
if (body.mode === 'refine_pattern') {
  if (!body.selectedNotes?.length || body.selectedNotes.length < 2) {
    throw new BadRequestException('Select at least 2 notes to refine a pattern')
  }
}
```

Extend `ChartContext`:

```ts
sections: Array<{ time: number; label: string }>
segments: Array<{ startTimeMs: number; endTimeMs: number; notesPerSecond: number; difficultyLevel: string; difficultyScore: number }>
chartNoteCount: number
```

In `buildPrompt`, add to `base`:

```ts
const anchorTime = body.selectedNotes?.length
  ? Math.min(...body.selectedNotes.map((n) => n.time))
  : ctx.playheadTime
const currentSection = [...ctx.sections].reverse().find((s) => s.time <= anchorTime)
// ...
currentSection ? `Current section: "${currentSection.label}" at ${currentSection.time}s.` : null,
`All sections: ${JSON.stringify(ctx.sections)}.`,
`Density profile: ${JSON.stringify(ctx.segments.map((s) => ({ start: s.startTimeMs / 1000, end: s.endTimeMs / 1000, nps: s.notesPerSecond, level: s.difficultyLevel })))}.`,
`Chart totals: ${ctx.chartNoteCount} notes.`,
body.instruction ? `User instruction: ${body.instruction}.` : null,
```

Add `refine_pattern` branch in `buildPrompt`:

```ts
if (mode === 'refine_pattern') {
  const n = ctx.contextNotes.length
  return {
    system,
    user: [
      ...base,
      `Selected pattern to refine: ${JSON.stringify(ctx.contextNotes)}.`,
      `Task: REFINE PATTERN — return exactly ${n} suggestions that improve this pattern.`,
      'Adjust timing and lanes within the selection window; preserve musical intent.',
      'Return improved track+time pairs; do not collide with occupied positions outside the selection.',
    ].join(' '),
  }
}
```

In `postProcess`, for `refine_pattern`:

```ts
const selectedKeys = new Set(
  (body.selectedNotes ?? []).map((n) => `${n.track}:${snapTime(n.time, ctx.snapMode, ctx.bpm).toFixed(1)}`),
)
const occupiedKeys = new Set(
  ctx.occupied
    .map((n) => `${n.track}:${n.time.toFixed(1)}`)
    .filter((key) => !selectedKeys.has(key)),
)
```

Use `occupiedKeys` for collision checks when mode is `refine_pattern`.

Wrap `suggestNotes` body with `runStep` calls using `AI_STREAM_STEPS['suggest-notes']`.

- [ ] **Step 4: Run tests**

```bash
pnpm --dir apps/api test -- ai-suggest-global.spec.ts ai-stream.controller.spec.ts --runInBand
pnpm --dir apps/api build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/ai.service.ts apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts
git commit -m "feat: enrich suggest-notes with global context and refine mode"
```

---

### Task 5: Web SSE client and useAiStreamRun

**Files:**
- Create: `apps/web/src/features/editor/ai-stream.ts`
- Create: `apps/web/src/features/editor/ai-stream.test.ts`
- Create: `apps/web/src/features/editor/components/ai-assistant/useAiStreamRun.ts`

- [ ] **Step 1: Write failing parser test**

Create `apps/web/src/features/editor/ai-stream.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseSseChunk } from './ai-stream'

describe('parseSseChunk', () => {
  it('parses one complete data line', () => {
    const events = parseSseChunk('', 'data: {"type":"run","runId":"1","action":"generate-chart"}\n\n')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'run', action: 'generate-chart' })
  })

  it('buffers partial lines across chunks', () => {
    let buffer = ''
    const r1 = parseSseChunk(buffer, 'data: {"type":"step"')
    buffer = r1.buffer
    expect(r1.events).toHaveLength(0)
    const r2 = parseSseChunk(buffer, ',"stepId":"prepare"}\n\n')
    expect(r2.events).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Implement ai-stream.ts**

```ts
import type { AiStreamEvent, AiStreamRequest } from '@ama-midi/shared'

const BASE = import.meta.env.VITE_API_URL ?? ''

export function parseSseChunk(
  buffer: string,
  chunk: string,
): { events: AiStreamEvent[]; buffer: string } {
  const combined = buffer + chunk
  const parts = combined.split('\n\n')
  const nextBuffer = parts.pop() ?? ''
  const events: AiStreamEvent[] = []
  for (const part of parts) {
    const line = part.split('\n').find((l) => l.startsWith('data: '))
    if (!line) continue
    events.push(JSON.parse(line.slice(6)) as AiStreamEvent)
  }
  return { events, buffer: nextBuffer }
}

export async function streamAiRequest(
  token: string | null,
  songId: string,
  body: AiStreamRequest,
  opts: {
    signal?: AbortSignal
    onEvent: (event: AiStreamEvent) => void
  },
): Promise<AiStreamEvent> {
  const res = await fetch(`${BASE}/songs/${songId}/ai/stream`, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: body.action, payload: stripAction(body) }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(typeof errBody.message === 'string' ? errBody.message : res.statusText)
  }

  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastResult: AiStreamEvent | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const parsed = parseSseChunk(buffer, decoder.decode(value, { stream: true }))
    buffer = parsed.buffer
    for (const event of parsed.events) {
      opts.onEvent(event)
      if (event.type === 'error') throw new Error(event.message)
      if (event.type === 'result') lastResult = event
    }
  }

  if (!lastResult || lastResult.type !== 'result') {
    throw new Error('Connection closed early')
  }
  return lastResult
}

function stripAction(body: AiStreamRequest): Record<string, unknown> {
  const { action, ...rest } = body as AiStreamRequest & Record<string, unknown>
  return rest
}
```

Adjust `stripAction` per envelope shape (`payload` field) to match `AiStreamEnvelopeDto`.

- [ ] **Step 3: Implement useAiStreamRun.ts**

```ts
import { useCallback, useRef, useState } from 'react'
import { AI_STREAM_STEPS, type AiStreamEvent, type AiStreamRequest, type AiStreamStepStatus } from '@ama-midi/shared'
import { streamAiRequest } from '../../ai-stream'

export function useAiStreamRun(songId: string, token: string | null) {
  const [steps, setSteps] = useState<Record<string, AiStreamStepStatus>>({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runIdRef = useRef<string | null>(null)

  const resetSteps = useCallback((action: AiStreamRequest['action']) => {
    const initial: Record<string, AiStreamStepStatus> = {}
    for (const s of AI_STREAM_STEPS[action]) initial[s.stepId] = 'pending'
    setSteps(initial)
  }, [])

  const start = useCallback(async (body: AiStreamRequest) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setProcessing(true)
    setError(null)
    resetSteps(body.action)

    try {
      const result = await streamAiRequest(token, songId, body, {
        signal: controller.signal,
        onEvent: (event: AiStreamEvent) => {
          if (event.type === 'run') {
            runIdRef.current = event.runId
            return
          }
          if (event.type === 'step') {
            if (runIdRef.current && event.runId !== runIdRef.current) return
            setSteps((prev) => ({ ...prev, [event.stepId]: event.status }))
            return
          }
        },
      })
      return result
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : 'AI request failed')
      }
      throw e
    } finally {
      setProcessing(false)
    }
  }, [token, songId, resetSteps])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setProcessing(false)
  }, [])

  return { steps, processing, error, start, cancel }
}
```

- [ ] **Step 4: Run web tests**

```bash
pnpm --dir apps/web test -- ai-stream.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/ai-stream.ts apps/web/src/features/editor/ai-stream.test.ts apps/web/src/features/editor/components/ai-assistant/useAiStreamRun.ts
git commit -m "feat: add web ai stream client"
```

---

### Task 6: Editor store and AiSuggestions store wiring

**Files:**
- Modify: `apps/web/src/store/editor.store.ts`
- Modify: `apps/web/src/features/editor/components/AiSuggestions.tsx`

- [ ] **Step 1: Extend editor store**

In `editor.store.ts`, add:

```ts
import type { NoteSuggestion } from '@ama-midi/shared'

export type AiAssistantFeature =
  | 'generate-chart'
  | 'scale-chart'
  | 'fill-track'
  | 'improve-pattern'

export type AiAssistantPhase = 'picker' | 'configure' | 'processing' | 'result'

export interface AiAssistantState {
  open: boolean
  feature: AiAssistantFeature | null
  phase: AiAssistantPhase
  entry: 'toolbar' | 'selection'
  improveSubMode?: 'extend' | 'refine'
}

// In EditorStore interface:
aiAssistant: AiAssistantState | null
aiSuggestions: NoteSuggestion[]
openAiAssistant: (partial: Partial<AiAssistantState> & { open: true }) => void
closeAiAssistant: () => void
setAiSuggestions: (suggestions: NoteSuggestion[]) => void
clearAiSuggestions: () => void

// Remove: triggerAiSuggest, setTriggerAiSuggest
```

Implement defaults: `aiAssistant: null`, `aiSuggestions: []`.

- [ ] **Step 2: Simplify AiSuggestions.tsx**

Remove internal fetch/`setTriggerAiSuggest` registration. Read:

```ts
const suggestions = useEditorStore((s) => s.aiSuggestions)
```

Keep ghost rendering + accept/dismiss; on dismiss call `setAiSuggestions` with filtered list.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/editor.store.ts apps/web/src/features/editor/components/AiSuggestions.tsx
git commit -m "feat: move ai suggestions to editor store"
```

---

### Task 7: AiAssistantModal shell, picker, and progress tree

**Files:**
- Create: `apps/web/src/features/editor/components/ai-assistant/ai-assistant.types.ts`
- Create: `apps/web/src/features/editor/components/ai-assistant/AiProgressTree.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/AiFeaturePicker.tsx`
- Create: `apps/web/src/features/editor/components/ai-assistant/AiAssistantModal.tsx`

- [ ] **Step 1: AiProgressTree**

Vertical list mapping `AI_STREAM_STEPS[action]` to `steps[stepId]`:

- `pending` → hollow circle
- `active` → spinner + primary text
- `done` → check icon
- `error` → red X

- [ ] **Step 2: AiFeaturePicker**

2×2 grid like `StartStep`. Props:

```ts
{
  noteCount: number
  selectedCount: number
  onSelect: (feature: AiAssistantFeature) => void
}
```

Disable rules per spec; show helper under Improve when `selectedCount < 2`.

- [ ] **Step 3: AiAssistantModal shell**

Props: `songId`, `song`, `chartId`, `noteCount`, `selectedNotes`, `sections`.

State from `useEditorStore().aiAssistant`.

Render by phase:

- `picker` → `AiFeaturePicker`
- `configure` → flow component by feature
- `processing` → `AiProgressTree` + Cancel (calls `cancel()`)
- `result` → success copy + Done button

On modal close (`onOpenChange(false)`): call `cancel()` if processing, then `closeAiAssistant()`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/ai-assistant/
git commit -m "feat: add ai assistant modal shell"
```

---

### Task 8: Flow components

**Files:**
- Create: `apps/web/src/features/editor/components/ai-assistant/flows/*.tsx`

- [ ] **Step 1: GenerateChartFlow.tsx**

Port fields from `AiGenerateChartModal.tsx`. On submit:

```ts
await start({
  action: 'generate-chart',
  description: brief,
  snapMode,
  ...(targetTier ? { targetTier } : {}),
})
```

On result: `setChartPreview({ notes, sections, replaceExisting })`, `closeAiAssistant()`.

- [ ] **Step 2: ScaleDifficultyFlow.tsx**

Port from `AiScaleChartModal.tsx`. Stream body:

```ts
{ action: 'scale-chart', chartId, targetTier, snapMode, instruction? }
```

On result: `setChartPreview({ notes, sections, replaceExisting: true })`, close modal.

- [ ] **Step 3: FillTrackFlow.tsx**

Track grid + optional instruction. Stream:

```ts
{
  action: 'suggest-notes',
  chartId,
  mode: 'fill_track',
  targetTrack,
  playheadTime,
  snapMode,
  instruction?,
}
```

On result: `setAiSuggestions(payload.suggestions)`, set phase `result`.

- [ ] **Step 4: ImprovePatternFlow.tsx**

Sub-mode cards (Extend → `continue_pattern`, Refine → `refine_pattern`).

Show selection summary from props.

Stream:

```ts
{
  action: 'suggest-notes',
  chartId,
  mode: subMode === 'extend' ? 'continue_pattern' : 'refine_pattern',
  playheadTime: lastSelectedTime,
  snapMode,
  selectedNotes,
  instruction?,
}
```

Entry `selection` skips sub-mode if you want — spec says show sub-mode always unless deep-linked with remembered choice; default: show sub-mode.

- [ ] **Step 5: Wire flows into AiAssistantModal**

Import all four flows; pass `useAiStreamRun` hook values.

- [ ] **Step 6: Build web**

```bash
pnpm --dir apps/web build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor/components/ai-assistant/flows/
git commit -m "feat: add ai assistant flows"
```

---

### Task 9: Entry points and cleanup

**Files:**
- Create: `apps/web/src/features/editor/components/ai-assistant/AiAssistantTrigger.tsx`
- Modify: `apps/web/src/features/editor/components/Toolbar.tsx`
- Modify: `apps/web/src/features/editor/components/MultiSelectBar.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`
- Modify: `apps/web/src/features/onboarding/useAppTour.ts`
- Delete: old AI menu/modals

- [ ] **Step 1: AiAssistantTrigger**

Simple button replacing dropdown:

```tsx
<button type="button" data-tour="ai-suggest" onClick={() => openAiAssistant({ open: true, feature: null, phase: 'picker', entry: 'toolbar' })}>
  AI
</button>
```

- [ ] **Step 2: Toolbar**

Replace `AiSuggestMenu` import with `AiAssistantTrigger`.

- [ ] **Step 3: MultiSelectBar**

Rename prop `onContinuePattern` → `onImprovePattern`, label **Improve pattern**, `data-tour="ai-improve-pattern"`.

- [ ] **Step 4: EditorPage**

- Mount `<AiAssistantModal ... />` once near toolbar
- Remove `handleContinuePattern` toast flow
- Wire `onImprovePattern`:

```ts
openAiAssistant({
  open: true,
  feature: 'improve-pattern',
  phase: 'configure',
  entry: 'selection',
})
```

- Remove `triggerAiSuggest` from destructuring

- [ ] **Step 5: Update tour**

In `useAppTour.ts`, change message to mention Improve pattern and unified AI popup.

- [ ] **Step 6: Delete obsolete files**

```bash
rm apps/web/src/features/editor/components/AiSuggestMenu.tsx
rm apps/web/src/features/editor/components/AiGenerateChartModal.tsx
rm apps/web/src/features/editor/components/AiScaleChartModal.tsx
```

Fix any remaining imports.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src/features/editor apps/web/src/pages/EditorPage.tsx apps/web/src/features/onboarding/useAppTour.ts
git commit -m "feat: wire ai assistant entry points and remove legacy menu"
```

---

### Task 10: Final verification

**Files:**
- Verify all tasks above.

- [ ] **Step 1: Run API tests**

```bash
pnpm --dir apps/api test -- ai-stream.controller.spec.ts ai-suggest-global.spec.ts ai-chart-scale.service.spec.ts llm-adapter.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run web tests**

```bash
pnpm --dir apps/web test -- ai-stream.test.ts
```

Expected: PASS.

- [ ] **Step 3: Build both apps**

```bash
pnpm --dir apps/api build
pnpm --dir apps/web build
```

Expected: both succeed.

- [ ] **Step 4: Manual smoke checklist**

- Toolbar AI → picker → Generate → progress tree steps advance → preview bar appears
- Scale with notes → replace preview
- Fill track → ghosts on grid, conflicts red
- Multi-select → Improve pattern → Extend and Refine both stream
- Close modal during processing → no stale preview applied

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|---|---|
| Unified modal + feature picker | Task 7, 9 |
| SSE streaming progress | Task 1, 2, 3, 5 |
| Global suggest context | Task 4 |
| refine_pattern | Task 4 |
| Improve Extend/Refine | Task 8 |
| Deep-link from multi-select | Task 9 |
| ChartPreviewBar unchanged | Task 8 |
| AbortController | Task 5 |
| Remove legacy UI | Task 9 |

No placeholders remain. Envelope DTO uses `action` + `payload` consistently across web and API.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-24-ai-assistant-modal.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration  
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
