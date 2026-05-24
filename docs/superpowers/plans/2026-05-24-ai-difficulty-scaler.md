# AI Difficulty Scaler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI whole-chart difficulty scaler that previews a full replacement chart for a selected target tier and applies through the existing chart preview/apply flow.

**Architecture:** First extract direct Anthropic calls behind a Nest-injected `LLMAdapter`, keeping current Anthropic behavior as the default. Then add `scaleChart()` to `AiChartService`, returning the existing `GenerateChartResponse` shape so the frontend can reuse `ChartPreviewState` and `ChartPreviewBar` with `replaceExisting: true`. The frontend adds a focused `AiScaleChartModal` launched from the existing AI menu.

**Tech Stack:** TypeScript, NestJS, class-validator, Jest, React, Zustand, TanStack Query, Anthropic SDK through adapter.

---

## File Structure

- Create `apps/api/src/modules/ai/adapters/llm-adapter.interface.ts`: shared adapter types and injection token.
- Create `apps/api/src/modules/ai/adapters/anthropic.adapter.ts`: default Anthropic implementation.
- Modify `apps/api/src/modules/ai/ai.module.ts`: register `LLM_ADAPTER` provider.
- Modify `apps/api/src/modules/ai/ai.service.ts`: inject `LLMAdapter` and replace direct Anthropic call.
- Modify `apps/api/src/modules/ai/ai-chart.service.ts`: inject `LLMAdapter`, replace direct Anthropic call, add scaler behavior.
- Modify `apps/api/src/modules/ai/dto/chart.dto.ts`: add `ScaleChartDto`.
- Modify `apps/api/src/modules/ai/ai.controller.ts`: add `POST /songs/:songId/scale-chart`.
- Create `apps/api/src/modules/ai/__tests__/llm-adapter.spec.ts`: verifies adapter refactor works with fake adapter.
- Create `apps/api/src/modules/ai/__tests__/ai-chart-scale.service.spec.ts`: verifies scaler prompt, normalization, and errors.
- Create `apps/web/src/features/editor/components/AiScaleChartModal.tsx`: target tier + instruction modal.
- Modify `apps/web/src/features/editor/components/AiSuggestMenu.tsx`: add Scale difficulty menu item and modal wiring.

---

### Task 1: LLM Adapter Boundary

**Files:**
- Create: `apps/api/src/modules/ai/adapters/llm-adapter.interface.ts`
- Create: `apps/api/src/modules/ai/adapters/anthropic.adapter.ts`
- Modify: `apps/api/src/modules/ai/ai.module.ts`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts`
- Test: `apps/api/src/modules/ai/__tests__/llm-adapter.spec.ts`

- [ ] **Step 1: Write failing adapter injection tests**

Create `apps/api/src/modules/ai/__tests__/llm-adapter.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AiService } from '../ai.service'
import { AiChartService } from '../ai-chart.service'
import { LLM_ADAPTER, type LLMAdapter } from '../adapters/llm-adapter.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'

const fakeLlm: LLMAdapter = {
  complete: jest.fn(),
}

describe('AI services LLM adapter injection', () => {
  it('constructs AiService with an injected LLM adapter', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: LLM_ADAPTER, useValue: fakeLlm },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile()

    expect(moduleRef.get(AiService)).toBeInstanceOf(AiService)
  })

  it('constructs AiChartService with an injected LLM adapter', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiChartService,
        { provide: LLM_ADAPTER, useValue: fakeLlm },
        { provide: PrismaService, useValue: {} },
        { provide: ProjectAccessService, useValue: {} },
        { provide: EventEmitter2, useValue: {} },
      ],
    }).compile()

    expect(moduleRef.get(AiChartService)).toBeInstanceOf(AiChartService)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --dir apps/api test -- llm-adapter.spec.ts --runInBand
```

Expected: FAIL because `../adapters/llm-adapter.interface` does not exist and services do not inject `LLM_ADAPTER`.

- [ ] **Step 3: Add adapter interface**

Create `apps/api/src/modules/ai/adapters/llm-adapter.interface.ts`:

```ts
export const LLM_ADAPTER = Symbol('LLM_ADAPTER')

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  complete(opts: {
    system: string
    messages: LLMMessage[]
    maxTokens: number
  }): Promise<string>
}
```

- [ ] **Step 4: Add Anthropic adapter**

Create `apps/api/src/modules/ai/adapters/anthropic.adapter.ts`:

```ts
import { Injectable } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, LLMMessage } from './llm-adapter.interface'

@Injectable()
export class AnthropicAdapter implements LLMAdapter {
  private readonly client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  async complete(opts: {
    system: string
    messages: LLMMessage[]
    maxTokens: number
  }): Promise<string> {
    const message = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
    })

    return message.content[0]?.type === 'text' ? message.content[0].text : ''
  }
}
```

- [ ] **Step 5: Register adapter provider**

Replace `apps/api/src/modules/ai/ai.module.ts` with:

```ts
import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiChartService } from './ai-chart.service'
import { ProjectAccessModule } from '../project-access/project-access.module'
import { LLM_ADAPTER } from './adapters/llm-adapter.interface'
import { AnthropicAdapter } from './adapters/anthropic.adapter'

@Module({
  imports: [ProjectAccessModule],
  controllers: [AiController],
  providers: [
    { provide: LLM_ADAPTER, useClass: AnthropicAdapter },
    AiService,
    AiChartService,
  ],
})
export class AiModule {}
```

- [ ] **Step 6: Refactor AiService to use adapter**

In `apps/api/src/modules/ai/ai.service.ts`:

Remove:

```ts
import Anthropic from '@anthropic-ai/sdk'
```

Add imports:

```ts
import { Inject } from '@nestjs/common'
import { LLM_ADAPTER, type LLMAdapter } from './adapters/llm-adapter.interface'
```

If `@nestjs/common` is already imported as a multiline list, add `Inject` to that list instead of creating a duplicate import.

Remove the class field:

```ts
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

Replace constructor:

```ts
  constructor(
    @Inject(LLM_ADAPTER) private readonly llm: LLMAdapter,
    private readonly prisma: PrismaService,
  ) {}
```

Replace `callClaude()` body with:

```ts
  private async callClaude(prompt: { system: string; user: string }): Promise<RawSuggestion[]> {
    const text = await this.llm.complete({
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
      maxTokens: 600,
    })
    const jsonText = (text || '[]').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const parsed = JSON.parse(jsonText.trim()) as unknown
      if (!Array.isArray(parsed)) return []
      return (parsed as Array<Record<string, unknown>>)
        .filter(
          (s) =>
            Number.isInteger(s.track) &&
            (s.track as number) >= TRACK_MIN &&
            (s.track as number) <= TRACK_MAX &&
            typeof s.time === 'number',
        )
        .map((s) => ({ track: s.track as number, time: s.time as number }))
    } catch {
      return []
    }
  }
```

- [ ] **Step 7: Refactor AiChartService to use adapter**

In `apps/api/src/modules/ai/ai-chart.service.ts`:

Remove:

```ts
import Anthropic from '@anthropic-ai/sdk'
```

Add `Inject` to `@nestjs/common` imports and add:

```ts
import { LLM_ADAPTER, type LLMAdapter } from './adapters/llm-adapter.interface'
```

Remove:

```ts
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

Update constructor:

```ts
  constructor(
    @Inject(LLM_ADAPTER) private readonly llm: LLMAdapter,
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
```

Replace `callClaudeForChart()` body with:

```ts
  private async callClaudeForChart(prompt: { system: string; user: string }) {
    const text = await this.llm.complete({
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
      maxTokens: 8192,
    })
    return this.parseChartJson(text || '{}')
  }

  private parseChartJson(text: string): { notes: unknown[]; sections: unknown[] } {
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const parsed = JSON.parse(jsonText) as {
        notes?: unknown
        sections?: unknown
      }
      return {
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      }
    } catch {
      return { notes: [], sections: [] }
    }
  }
```

- [ ] **Step 8: Run adapter tests and existing AI build**

Run:

```bash
pnpm --dir apps/api test -- llm-adapter.spec.ts --runInBand
pnpm --dir apps/api build
```

Expected: tests PASS and API build succeeds.

- [ ] **Step 9: Commit adapter refactor**

Run:

```bash
git add apps/api/src/modules/ai/adapters/llm-adapter.interface.ts \
        apps/api/src/modules/ai/adapters/anthropic.adapter.ts \
        apps/api/src/modules/ai/ai.module.ts \
        apps/api/src/modules/ai/ai.service.ts \
        apps/api/src/modules/ai/ai-chart.service.ts \
        apps/api/src/modules/ai/__tests__/llm-adapter.spec.ts
git commit -m "feat: add ai llm adapter"
```

---

### Task 2: Backend Scale Chart API

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/api/src/modules/ai/dto/chart.dto.ts`
- Modify: `apps/api/src/modules/ai/ai.controller.ts`
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts`
- Test: `apps/api/src/modules/ai/__tests__/ai-chart-scale.service.spec.ts`

- [ ] **Step 1: Add shared request type**

In `packages/shared/src/types.ts`, after `GenerateChartRequest`, add:

```ts
export interface ScaleChartRequest {
  chartId: string
  targetTier: SongDifficulty
  instruction?: string
  snapMode: SnapMode
}
```

- [ ] **Step 2: Add DTO**

In `apps/api/src/modules/ai/dto/chart.dto.ts`, add after `GenerateChartDto`:

```ts
export class ScaleChartDto {
  @IsUUID()
  chartId!: string

  @IsIn(['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'])
  targetTier!: SongDifficulty

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string

  @IsIn(['0.1s', 'beat', 'halfBeat'])
  snapMode!: SnapMode
}
```

- [ ] **Step 3: Write failing backend scaler tests**

Create `apps/api/src/modules/ai/__tests__/ai-chart-scale.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AiChartService } from '../ai-chart.service'
import { LLM_ADAPTER, type LLMAdapter } from '../adapters/llm-adapter.interface'
import { PrismaService } from '../../prisma/prisma.service'
import { ProjectAccessService } from '../../project-access/project-access.service'

const songId = 'song-1'
const chartId = 'chart-1'

function makePrisma() {
  return {
    song: {
      findUnique: jest.fn().mockResolvedValue({
        id: songId,
        name: 'Scale Song',
        bpm: 120,
        timeSignature: '4/4',
        category: 'EDM',
      }),
    },
    songChart: {
      findFirst: jest.fn().mockResolvedValue({
        id: chartId,
        name: 'Hard Chart',
        songId,
        speedMultiplier: 1,
        computedDifficulty: 'HARD',
        averageDifficultyScore: 10,
        peakDifficultyScore: 18,
      }),
      findUnique: jest.fn(),
    },
    note: {
      findMany: jest.fn().mockResolvedValue([
        { track: 1, time: 1.04, noteType: 'TAP', duration: null, title: 'Kick' },
        { track: 4, time: 1.54, noteType: 'HOLD', duration: 0.5, title: 'Hold' },
      ]),
    },
    sectionMarker: {
      findMany: jest.fn().mockResolvedValue([
        { time: 0, label: 'Intro', color: '#10B981' },
      ]),
    },
    chartDifficultySegment: {
      findMany: jest.fn().mockResolvedValue([
        {
          startTimeMs: 0,
          endTimeMs: 5000,
          notesPerSecond: 2,
          difficultyLevel: 'HARD',
          difficultyScore: 10,
        },
      ]),
    },
    chartValidationWarning: {
      findMany: jest.fn().mockResolvedValue([
        { code: 'HIGH_DENSITY', severity: 'WARN', startTimeMs: 0, endTimeMs: 5000, message: 'Elevated density' },
      ]),
    },
    $transaction: jest.fn(),
  }
}

describe('AiChartService.scaleChart', () => {
  let service: AiChartService
  let prisma: ReturnType<typeof makePrisma>
  let llm: LLMAdapter

  beforeEach(async () => {
    prisma = makePrisma()
    llm = {
      complete: jest.fn().mockResolvedValue(JSON.stringify({
        notes: [
          { track: 1, time: 2.04, noteType: 'TAP', title: 'Scaled' },
          { track: 9, time: 3, noteType: 'TAP', title: 'Invalid lane' },
        ],
        sections: [{ time: 0, label: 'Intro', color: '#10B981' }],
      })),
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiChartService,
        { provide: LLM_ADAPTER, useValue: llm },
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectAccessService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile()

    service = moduleRef.get(AiChartService)
  })

  it('rejects viewers', async () => {
    await expect(service.scaleChart(songId, 'VIEWER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })).rejects.toThrow(ForbiddenException)
  })

  it('rejects empty source charts', async () => {
    prisma.note.findMany.mockResolvedValueOnce([])

    await expect(service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })).rejects.toThrow(BadRequestException)
  })

  it('sends source notes, analysis, target tier, and instruction to the LLM', async () => {
    await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      instruction: 'reduce doubles',
      snapMode: '0.1s',
    })

    expect(llm.complete).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 8192,
      messages: [expect.objectContaining({ role: 'user', content: expect.stringContaining('reduce doubles') })],
    }))
    const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
    expect(userPrompt).toContain('Target tier: NORMAL')
    expect(userPrompt).toContain('Source notes')
    expect(userPrompt).toContain('Analysis segments')
    expect(userPrompt).toContain('Current warnings')
  })

  it('computes local analysis segments when persisted segments are missing', async () => {
    prisma.chartDifficultySegment.findMany.mockResolvedValueOnce([])

    await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })

    const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
    expect(userPrompt).toContain('Analysis segments')
    expect(userPrompt).toContain('"start":0')
  })

  it('normalizes model output and drops invalid notes', async () => {
    const result = await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })

    expect(result.notes).toEqual([{ track: 1, time: 2, noteType: 'TAP', duration: undefined, title: 'Scaled' }])
    expect(result.sections).toEqual([{ time: 0, label: 'Intro', color: '#10B981' }])
  })

  it('returns empty preview for invalid model JSON', async () => {
    ;(llm.complete as jest.Mock).mockResolvedValueOnce('not json')

    const result = await service.scaleChart(songId, 'COMPOSER', {
      chartId,
      targetTier: 'NORMAL',
      snapMode: '0.1s',
    })

    expect(result).toEqual({ notes: [], sections: [] })
  })
})
```

- [ ] **Step 4: Run scaler tests to verify failure**

Run:

```bash
pnpm --dir apps/api test -- ai-chart-scale.service.spec.ts --runInBand
```

Expected: FAIL because `scaleChart()` does not exist.

- [ ] **Step 5: Add controller endpoint**

In `apps/api/src/modules/ai/ai.controller.ts`, change DTO import:

```ts
import { ApplyChartDto, GenerateChartDto, ScaleChartDto } from './dto/chart.dto'
```

Add route after `generateChart()`:

```ts
  @Post('scale-chart')
  scaleChart(
    @Param('songId') songId: string,
    @Body() body: ScaleChartDto,
    @Req() req: Request,
  ): Promise<GenerateChartResponse> {
    const user = req.user as AuthUser
    return this.aiChart.scaleChart(songId, user.role, body)
  }
```

- [ ] **Step 6: Implement scaleChart service method**

In `apps/api/src/modules/ai/ai-chart.service.ts`, add `SongDifficulty` and `analyzeChart` to shared imports.

Add method after `generateChart()`:

```ts
  async scaleChart(
    songId: string,
    userRole: string,
    body: { chartId: string; targetTier: SongDifficulty; instruction?: string; snapMode: SnapMode },
  ): Promise<GenerateChartResponse> {
    if (userRole === 'VIEWER') throw new ForbiddenException('VIEWER cannot use AI chart scaling')

    const song = await this.prisma.song.findUnique({ where: { id: songId } })
    if (!song) throw new NotFoundException('Song not found')

    const chart = await this.prisma.songChart.findFirst({
      where: { id: body.chartId, songId },
      select: {
        id: true,
        name: true,
        speedMultiplier: true,
        computedDifficulty: true,
        averageDifficultyScore: true,
        peakDifficultyScore: true,
      },
    })
    if (!chart) throw new NotFoundException('Chart not found')

    const [notes, sections, persistedSegments, warnings] = await Promise.all([
      this.prisma.note.findMany({
        where: { chartId: chart.id, deletedAt: null },
        orderBy: [{ time: 'asc' }, { track: 'asc' }],
        select: { track: true, time: true, noteType: true, duration: true, title: true },
      }),
      this.prisma.sectionMarker.findMany({
        where: { songId },
        orderBy: { time: 'asc' },
        select: { time: true, label: true, color: true },
      }),
      this.prisma.chartDifficultySegment.findMany({
        where: { chartId: chart.id },
        orderBy: { startTimeMs: 'asc' },
        select: { startTimeMs: true, endTimeMs: true, notesPerSecond: true, difficultyLevel: true, difficultyScore: true },
      }),
      this.prisma.chartValidationWarning.findMany({
        where: { chartId: chart.id },
        orderBy: [{ severity: 'asc' }, { startTimeMs: 'asc' }],
        select: { code: true, severity: true, startTimeMs: true, endTimeMs: true, message: true },
      }),
    ])

    if (notes.length === 0) throw new BadRequestException('Cannot scale an empty chart')

    const localAnalysis = persistedSegments.length === 0
      ? analyzeChart({
          chartId: chart.id,
          notes: notes.map((n) => ({
            track: n.track,
            time: n.time,
            noteType: n.noteType as 'TAP' | 'HOLD' | 'SWIPE',
            duration: n.duration,
          })),
          bpm: song.bpm,
          timeSignature: song.timeSignature,
          speedMultiplier: chart.speedMultiplier,
        })
      : null
    const segments = persistedSegments.length > 0 ? persistedSegments : localAnalysis!.segments.map((s) => ({
      startTimeMs: s.startTimeMs,
      endTimeMs: s.endTimeMs,
      notesPerSecond: s.notesPerSecond,
      difficultyLevel: s.difficultyLevel,
      difficultyScore: s.difficultyScore,
    }))

    const targetCount = TARGET_NOTE_COUNT[body.targetTier] ?? 90
    const prompt = this.buildScalePrompt({
      song,
      chart,
      notes,
      sections,
      segments,
      warnings,
      targetTier: body.targetTier,
      targetCount,
      instruction: body.instruction?.trim(),
      snapMode: body.snapMode,
    })
    const parsed = await this.callClaudeForChart(prompt)

    return {
      notes: this.normalizeGeneratedNotes(parsed.notes, body.snapMode, song.bpm),
      sections: this.normalizeSections(parsed.sections),
    }
  }
```

- [ ] **Step 7: Add scale prompt builder**

In `apps/api/src/modules/ai/ai-chart.service.ts`, add this private method before `callClaudeForChart()`:

```ts
  private buildScalePrompt(input: {
    song: { name: string; bpm: number; timeSignature: string; category: string }
    chart: {
      name: string
      speedMultiplier: number
      computedDifficulty: string
      averageDifficultyScore: number
      peakDifficultyScore: number
    }
    notes: Array<{ track: number; time: number; noteType: string; duration: number | null; title: string }>
    sections: Array<{ time: number; label: string; color: string }>
    segments: Array<{ startTimeMs: number; endTimeMs: number; notesPerSecond: number; difficultyLevel: string; difficultyScore: number }>
    warnings: Array<{ code: string; severity: string; startTimeMs: number | null; endTimeMs: number | null; message: string }>
    targetTier: SongDifficulty
    targetCount: number
    instruction?: string
    snapMode: SnapMode
  }): { system: string; user: string } {
    const snapHint =
      input.snapMode === '0.1s'
        ? `${SNAP_RESOLUTION}s steps`
        : input.snapMode === 'beat'
          ? `quarter notes at ${input.song.bpm} BPM`
          : `eighth notes at ${input.song.bpm} BPM`

    const system = [
      'You are a rhythm-game chart arranger for AMA-MIDI.',
      'Charts use 8 lanes (tracks 1-8), timeline 0-300 seconds.',
      'Return ONLY valid JSON with keys "notes" and "sections". No markdown.',
      'The returned chart is a full replacement, not a patch.',
    ].join(' ')

    const user = [
      `Song: ${input.song.name}, ${input.song.bpm} BPM, ${input.song.timeSignature}, category ${input.song.category}.`,
      `Source chart: ${input.chart.name}, computed ${input.chart.computedDifficulty}, average score ${input.chart.averageDifficultyScore.toFixed(1)}, peak score ${input.chart.peakDifficultyScore.toFixed(1)}, speed ${input.chart.speedMultiplier.toFixed(1)}x.`,
      `Target tier: ${input.targetTier}. Target about ${input.targetCount} notes, never more than ${MAX_GENERATED_NOTES}.`,
      `Snap all times to ${snapHint}. Avoid duplicate track+time pairs.`,
      input.instruction ? `User instruction: ${input.instruction}.` : null,
      `Source notes: ${JSON.stringify(input.notes.map((n) => ({ track: n.track, time: n.time, noteType: n.noteType, duration: n.duration, title: n.title })).slice(0, MAX_GENERATED_NOTES))}.`,
      `Source sections: ${JSON.stringify(input.sections)}.`,
      `Analysis segments: ${JSON.stringify(input.segments.map((s) => ({ start: s.startTimeMs / 1000, end: s.endTimeMs / 1000, nps: s.notesPerSecond, level: s.difficultyLevel, score: s.difficultyScore })))}.`,
      `Current warnings: ${JSON.stringify(input.warnings)}.`,
      'Preserve recognizable timing motifs and song structure.',
      'For easier targets: thin density, reduce large lane jumps, reduce simultaneous notes, and simplify holds.',
      'For harder targets: add notes, controlled doubles, holds, and syncopation while preserving musical feel.',
      'JSON shape: {"notes":[{"track":1,"time":0.0,"noteType":"TAP","title":"Kick"}],"sections":[{"time":0,"label":"Intro","color":"#10B981"}]}',
    ].filter(Boolean).join(' ')

    return { system, user }
  }
```

- [ ] **Step 8: Run scaler tests and API build**

Run:

```bash
pnpm --dir apps/api test -- ai-chart-scale.service.spec.ts --runInBand
pnpm --dir apps/api build
```

Expected: tests PASS and API build succeeds.

- [ ] **Step 9: Commit backend scaler**

Run:

```bash
git add packages/shared/src/types.ts \
        apps/api/src/modules/ai/dto/chart.dto.ts \
        apps/api/src/modules/ai/ai.controller.ts \
        apps/api/src/modules/ai/ai-chart.service.ts \
        apps/api/src/modules/ai/__tests__/ai-chart-scale.service.spec.ts
git commit -m "feat: add ai chart difficulty scaler api"
```

---

### Task 3: Frontend Scale Difficulty Modal

**Files:**
- Create: `apps/web/src/features/editor/components/AiScaleChartModal.tsx`
- Modify: `apps/web/src/features/editor/components/AiSuggestMenu.tsx`

- [ ] **Step 1: Create modal component**

Create `apps/web/src/features/editor/components/AiScaleChartModal.tsx`:

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import {
  SONG_DIFFICULTY_OPTIONS,
  SongDifficultyEnum,
  type GenerateChartResponse,
  type ScaleChartRequest,
  type Song,
  type SongDifficulty,
} from '@ama-midi/shared'
import { Button, Modal, Textarea } from '../../../components/ui'
import { useAuthStore } from '../../../store/auth.store'
import { useEditorStore } from '../../../store/editor.store'
import { apiClient } from '../../auth/api'

interface Props {
  songId: string
  song: Song | undefined
  chartId: string | null
  noteCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiScaleChartModal({ songId, song, chartId, noteCount, open, onOpenChange }: Props) {
  const token = useAuthStore((s) => s.token)
  const { snapMode, setChartPreview } = useEditorStore()
  const [targetTier, setTargetTier] = useState<SongDifficulty | ''>('')
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)

  async function scale() {
    if (!chartId) {
      toast.error('No chart selected')
      return
    }
    if (!targetTier) {
      toast.error('Choose a target tier')
      return
    }
    if (noteCount === 0) {
      toast.error('Add or generate notes before scaling difficulty')
      return
    }

    setLoading(true)
    const toastId = toast.loading('Scaling chart…')
    try {
      const body: ScaleChartRequest = {
        chartId,
        targetTier,
        snapMode,
        ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
      }
      const result = await apiClient(token)<GenerateChartResponse>(`/songs/${songId}/scale-chart`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (result.notes.length === 0) {
        toast.error('AI returned no notes — try a different target or instruction')
        return
      }
      setChartPreview({
        notes: result.notes,
        sections: result.sections,
        replaceExisting: true,
      })
      toast.success(`Scaled preview ready — ${result.notes.length} notes`)
      onOpenChange(false)
      setInstruction('')
    } catch {
      toast.error('Failed to scale chart')
    } finally {
      setLoading(false)
      toast.dismiss(toastId)
    }
  }

  const selectClassName =
    'w-full rounded-lg border border-shell-border bg-shell-surface px-3 py-2 text-sm text-shell-text'

  return (
    <Modal.Root open={open} onOpenChange={onOpenChange}>
      <Modal.Content className="max-w-lg">
        <Modal.Header>
          <h2 className="text-sm font-semibold text-shell-text">Scale chart difficulty</h2>
        </Modal.Header>
        <Modal.Body className="space-y-3">
          <p className="text-xs text-shell-muted">
            Generate a full replacement preview for <span className="text-shell-text">{song?.name ?? 'this song'}</span>.
            The current chart is replaced only if you accept the preview.
          </p>
          <div>
            <label className="mb-1 block text-xs text-shell-muted">Target tier</label>
            <select
              value={targetTier}
              onChange={(e) => setTargetTier(e.target.value as SongDifficulty | '')}
              className={selectClassName}
              disabled={loading}
            >
              <option value="">Choose target tier</option>
              {SONG_DIFFICULTY_OPTIONS.map((key) => (
                <option key={key} value={key}>{SongDifficultyEnum.label(key)}</option>
              ))}
            </select>
          </div>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional: keep chorus energetic, reduce doubles, add more holds"
            rows={4}
            maxLength={2000}
            disabled={loading}
          />
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-shell-text">
            Preview uses replace mode. Accepting it will replace the current chart notes and section markers.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void scale()} disabled={loading || !targetTier || !chartId || noteCount === 0}>
            {loading ? 'Scaling…' : 'Generate preview'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
```

- [ ] **Step 2: Wire modal into AI menu**

In `apps/web/src/features/editor/components/AiSuggestMenu.tsx`, add import:

```ts
import { AiScaleChartModal } from './AiScaleChartModal'
```

Add state after `generateOpen`:

```ts
  const [scaleOpen, setScaleOpen] = useState(false)
```

Add menu item after `Generate chart…`:

```tsx
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className="block w-full px-3 py-2 text-left text-xs text-shell-text hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => { setScaleOpen(true); setOpen(false) }}
            >
              Scale difficulty…
              <span className="mt-0.5 block text-[10px] text-shell-muted">
                Make the current chart easier or harder
              </span>
            </button>
```

Render modal after `AiGenerateChartModal`:

```tsx
      <AiScaleChartModal
        songId={songId}
        song={song}
        chartId={activeChartId}
        noteCount={noteCount}
        open={scaleOpen}
        onOpenChange={setScaleOpen}
      />
```

- [ ] **Step 3: Run web build**

Run:

```bash
pnpm --dir apps/web build
```

Expected: web build succeeds.

- [ ] **Step 4: Commit frontend scaler UI**

Run:

```bash
git add apps/web/src/features/editor/components/AiScaleChartModal.tsx \
        apps/web/src/features/editor/components/AiSuggestMenu.tsx
git commit -m "feat: add ai difficulty scaler modal"
```

---

### Task 4: Final Verification

**Files:**
- Verify all files changed by Tasks 1-3.

- [ ] **Step 1: Run AI-focused tests**

Run:

```bash
pnpm --dir apps/api test -- llm-adapter.spec.ts ai-chart-scale.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run builds**

Run:

```bash
pnpm --dir apps/api build
pnpm --dir apps/web build
```

Expected: both builds succeed. The existing Vite chunk-size warning is acceptable if no new build error appears.

- [ ] **Step 3: Inspect final status**

Run:

```bash
git status --short
```

Expected: no uncommitted scaler files. Pre-existing unrelated worktree changes may remain and must not be reverted.
