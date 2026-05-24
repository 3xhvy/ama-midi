# AI Workflow Bug Fixes + Processing Screen UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 AI workflow bugs and improve the AI processing screen with elapsed timer, real detail events from backend, and smooth step animations.

**Architecture:** Backend emits `detail` strings during long-running steps (already supported by `AiStreamEvent`); frontend tracks per-step elapsed time and renders it alongside detail text; `AiProgressTree` gains stagger animations and visual prominence for the active step. Bug fixes are localized to `ai-chart.service.ts`, `ai.service.ts`, and `ai.controller.ts`.

**Tech Stack:** NestJS (`@nestjs/throttler`, `@nestjs/common` Logger), React hooks (`useEffect`, `useRef`), Tailwind CSS animations, shared `AiStreamEvent` SSE types.

---

## Files Modified

| File | Change |
|---|---|
| `apps/api/src/modules/ai/ai-chart.service.ts` | Bulk delete fix, detail events on generate/normalize |
| `apps/api/src/modules/ai/ai.service.ts` | Error logging/wrapping, remove duplicate prompt segment, detail events |
| `apps/api/src/modules/ai/ai.controller.ts` | Add `@Throttle` to AI endpoints |
| `apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts` | Update test that asserts 'Density profile' exists |
| `apps/web/src/features/editor/components/ai-assistant/useAiStreamRun.ts` | Track `details: Record<string, string>` per step |
| `apps/web/src/features/editor/components/ai-assistant/AiProgressTree.tsx` | Elapsed timer, detail text, stagger animation, active prominence |
| `apps/web/src/features/editor/components/ai-assistant/flows/ScaleDifficultyFlow.tsx` | Move replace warning before tier pick |

---

## Task 1: Fix N+1 deletes in `applyChartReplace`

**Files:**
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts:204-235`

- [ ] **Step 1: Write the failing test** (add to `apps/api/src/modules/ai/__tests__/ai-chart-scale.service.spec.ts`)

Open `apps/api/src/modules/ai/__tests__/ai-chart-scale.service.spec.ts` and add inside the describe block:

```typescript
it('uses updateMany (not per-note updates) when replacing existing notes', async () => {
  // The key assertion: note.update should NOT be called individually
  // Instead updateMany handles bulk soft-delete
  const updateManySpy = prisma.note.updateMany
  const updateSpy = prisma.note.update

  await service.applyChart(songId, user, {
    chartId,
    notes: [{ track: 1, time: 5.0, noteType: 'TAP' as const }],
    replaceExisting: true,
  })

  expect(updateManySpy).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ chartId, deletedAt: null }),
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    }),
  )
  // update (singular) should NOT be called for deletions
  const deletionCalls = (updateSpy as jest.Mock).mock.calls.filter(
    ([args]) => args?.data?.deletedAt != null,
  )
  expect(deletionCalls).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm test --testPathPattern=ai-chart-scale --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `updateMany` not called, `update` called per-note.

- [ ] **Step 3: Implement fix in `applyChartReplace`**

In `apps/api/src/modules/ai/ai-chart.service.ts`, replace the `applyChartReplace` private method body (lines ~204–254):

```typescript
private async applyChartReplace(
  songId: string,
  user: AuthUser,
  chartId: string,
  body: ApplyChartDto,
): Promise<ApplyChartResponse> {
  const batchId = randomUUID()
  const deletedIds: string[] = []
  const deletedBeforeStates: Array<{ noteId: string; beforeState: Note }> = []
  const createdEntries: Note[] = []

  await this.prisma.$transaction(async (tx) => {
    // Fetch existing for event data, then bulk-delete
    const existing = await tx.note.findMany({
      where: { chartId, deletedAt: null },
      include: { creator: { select: { name: true, avatarUrl: true } } },
    })
    for (const note of existing) {
      deletedBeforeStates.push({ noteId: note.id, beforeState: this.toNote(note) })
      deletedIds.push(note.id)
    }
    if (deletedIds.length > 0) {
      await tx.note.updateMany({
        where: { id: { in: deletedIds } },
        data: { deletedAt: new Date() },
      })
    }
    await tx.sectionMarker.deleteMany({ where: { songId } })

    for (const draft of body.notes) {
      const row = await this.createChartNote(tx, songId, chartId, user.id, draft)
      if (row) createdEntries.push(row)
    }

    if (body.sections?.length) {
      await tx.sectionMarker.createMany({
        data: body.sections.map((s) => ({
          songId,
          time: Math.round(s.time * 10) / 10,
          label: s.label.trim(),
          color: s.color ?? '#6C63FF',
          createdBy: user.id,
        })),
      })
    }
  })

  const cmd = await this.editorCommands.record({
    songId,
    chartId,
    commandType: 'AI_NOTES_APPLIED',
    userId: user.id,
    summary: { createdCount: createdEntries.length, removedCount: deletedIds.length, batchId, mode: 'replace' },
  })

  this.emitBatchEvents(songId, user.id, batchId, createdEntries, deletedBeforeStates, cmd.id)

  return {
    batchId,
    createdCount: createdEntries.length,
    skippedCount: 0,
    sectionsCreated: body.sections?.length ?? 0,
    replacedCount: deletedIds.length,
  }
}
```

Also add `updateMany` mock to the prisma mock factory in `ai-chart-scale.service.spec.ts` (find `makePrisma` and add `updateMany: jest.fn().mockResolvedValue({ count: 1 })` to `note`).

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && pnpm test --testPathPattern=ai-chart-scale --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/ai-chart.service.ts apps/api/src/modules/ai/__tests__/ai-chart-scale.service.spec.ts
git commit -m "fix(ai): bulk-delete existing notes in applyChartReplace via updateMany"
```

---

## Task 2: Fix silent error swallowing in `AiService.callClaude`

**Files:**
- Modify: `apps/api/src/modules/ai/ai.service.ts`

- [ ] **Step 1: Write the failing test** (add to `apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts`)

Add inside `describe('AiService.suggestNotes global context')`:

```typescript
it('throws ServiceUnavailableException when LLM.complete rejects', async () => {
  ;(llm.complete as jest.Mock).mockRejectedValueOnce(new Error('network error'))

  await expect(
    service.suggestNotes(songId, 'COMPOSER', {
      chartId,
      mode: 'fill_track',
      targetTrack: 1,
      playheadTime: 2,
      snapMode: '0.1s',
    }),
  ).rejects.toThrow('AI suggestion failed')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm test --testPathPattern=ai-suggest-global --no-coverage 2>&1 | tail -20
```

Expected: FAIL — currently returns `[]` instead of throwing.

- [ ] **Step 3: Implement fix**

In `apps/api/src/modules/ai/ai.service.ts`:

At the top of the file, add to imports:
```typescript
import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
```

Inside the `AiService` class, add logger:
```typescript
private readonly logger = new Logger(AiService.name)
```

Replace the `callClaude` method:
```typescript
private async callClaude(prompt: { system: string; user: string }): Promise<RawSuggestion[]> {
  let text: string
  try {
    text = await this.llm.complete({
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
      maxTokens: 600,
    })
  } catch (err) {
    this.logger.error('LLM call failed for suggestNotes', err instanceof Error ? err.stack : String(err))
    throw new ServiceUnavailableException('AI suggestion failed — try again in a moment.')
  }

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
  } catch (err) {
    this.logger.warn('Failed to parse LLM suggestNotes response', { preview: jsonText.slice(0, 200) })
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && pnpm test --testPathPattern=ai-suggest-global --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/ai.service.ts apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts
git commit -m "fix(ai): throw ServiceUnavailableException on LLM failure in suggestNotes, add logger"
```

---

## Task 3: Remove duplicate density/segments in `buildPrompt`

**Files:**
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts`

- [ ] **Step 1: Update the existing test that asserts 'Density profile' exists**

In `apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts`, find the test `'includes analysis segments in the prompt when segments exist'` and update it:

```typescript
it('includes analysis segments in the prompt when segments exist', async () => {
  await service.suggestNotes(songId, 'COMPOSER', {
    chartId,
    mode: 'fill_track',
    targetTrack: 1,
    playheadTime: 2,
    snapMode: '0.1s',
  })

  const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
  // Analysis segments contains nps, level, score — the only density block needed
  expect(userPrompt).toContain('Analysis segments')
  // Density profile is removed (duplicate of Analysis segments minus score field)
  expect(userPrompt).not.toContain('Density profile')
})
```

Also update `'computes local analysis segments when persisted segments are missing'` to remove the `Density profile` assertion:

```typescript
it('computes local analysis segments when persisted segments are missing', async () => {
  prisma.chartDifficultySegment.findMany.mockResolvedValueOnce([])

  await service.suggestNotes(songId, 'COMPOSER', {
    chartId,
    mode: 'fill_track',
    targetTrack: 1,
    playheadTime: 2,
    snapMode: '0.1s',
  })

  const userPrompt = (llm.complete as jest.Mock).mock.calls[0][0].messages[0].content
  expect(userPrompt).toContain('Analysis segments')
  expect(userPrompt).toContain('"start":0')
})
```

- [ ] **Step 2: Run tests to verify they now fail (expect 'not.toContain' to fail since the duplicate still exists)**

```bash
cd apps/api && pnpm test --testPathPattern=ai-suggest-global --no-coverage 2>&1 | tail -20
```

Expected: FAIL on the `not.toContain('Density profile')` assertion.

- [ ] **Step 3: Remove the duplicate in `buildPrompt`**

In `apps/api/src/modules/ai/ai.service.ts`, in the `buildPrompt` method, find the `base` array and remove the `Density profile` entry (keep `Analysis segments`):

```typescript
const base = [
  `Song: ${ctx.bpm} BPM, ${ctx.timeSignature}, difficulty ${ctx.difficulty}, category ${ctx.category}.`,
  `Snap grid: ${ctx.snapMode} — align all times to ${snapHint}.`,
  `Context window: ${ctx.windowStart.toFixed(1)}s–${ctx.windowEnd.toFixed(1)}s.`,
  currentSection
    ? `Current section: "${currentSection.label}" at ${currentSection.time}s.`
    : null,
  `All sections: ${JSON.stringify(ctx.sections)}.`,
  `Analysis segments: ${JSON.stringify(
    ctx.segments.map((s) => ({
      start: s.startTimeMs / 1000,
      end: s.endTimeMs / 1000,
      nps: s.notesPerSecond,
      level: s.difficultyLevel,
      score: s.difficultyScore,
    })),
  )}.`,
  `Chart totals: ${ctx.chartNoteCount} notes.`,
  instruction ? `User instruction: ${instruction}.` : null,
  `Occupied positions (never duplicate these track+time pairs): ${JSON.stringify(ctx.occupied)}.`,
].filter(Boolean)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm test --testPathPattern=ai-suggest-global --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/ai.service.ts apps/api/src/modules/ai/__tests__/ai-suggest-global.spec.ts
git commit -m "fix(ai): remove duplicate density profile from suggestNotes prompt, saves tokens"
```

---

## Task 4: Add `@Throttle` to AI endpoints

**Files:**
- Modify: `apps/api/src/modules/ai/ai.controller.ts`

- [ ] **Step 1: Add throttle decorator**

In `apps/api/src/modules/ai/ai.controller.ts`, add `Throttle` to imports:

```typescript
import { Body, Controller, Headers, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { AuthGuard } from '@nestjs/passport'
```

Then add `@Throttle({ default: { limit: 10, ttl: 60000 } })` to the controller class (applies to all routes):

```typescript
@Controller('songs/:songId')
@UseGuards(AuthGuard('jwt'))
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AiController {
```

This allows 10 AI requests per minute per IP. The SSE stream endpoint (`/ai/stream`) already covers all AI actions, so this is the key guard.

- [ ] **Step 2: Verify no tests break**

```bash
cd apps/api && pnpm test --testPathPattern=ai-stream --no-coverage 2>&1 | tail -20
```

Expected: PASS (throttle is a guard, not tested at unit level — integration test would need Redis)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/ai/ai.controller.ts
git commit -m "feat(ai): add rate limiting — 10 AI requests per minute per user"
```

---

## Task 5: Move replace-mode warning before tier pick in `ScaleDifficultyFlow`

**Files:**
- Modify: `apps/web/src/features/editor/components/ai-assistant/flows/ScaleDifficultyFlow.tsx`

- [ ] **Step 1: Restructure the component**

Replace the entire `ScaleDifficultyFlow` return JSX:

```typescript
return (
  <>
    <div className="space-y-4">
      <AiFlowIntro>
        Generate a full replacement preview for{' '}
        <AiFlowHighlight>{song?.name ?? 'this song'}</AiFlowHighlight>. The current chart is
        replaced only if you accept the preview.
      </AiFlowIntro>

      <AiFlowCallout variant="amber">
        Scale always generates a full replacement. Accepting the preview will replace all current
        notes and section markers.
      </AiFlowCallout>

      <div>
        <AiFlowLabel>Target tier</AiFlowLabel>
        <AiFlowSelect
          value={targetTier}
          onChange={(e) => setTargetTier(e.target.value as SongDifficulty | '')}
          disabled={processing}
        >
          <option value="">Choose target tier</option>
          {SONG_DIFFICULTY_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {SongDifficultyEnum.label(key)}
            </option>
          ))}
        </AiFlowSelect>
      </div>

      <AiFlowTextarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Optional: keep chorus energetic, reduce doubles, add more holds"
        rows={4}
        maxLength={2000}
        disabled={processing}
      />
    </div>

    <AiFlowFooter>
      <AiFlowGhostButton onClick={onCancel} disabled={processing}>
        Cancel
      </AiFlowGhostButton>
      <AiFlowPrimaryButton
        onClick={() => void handleSubmit()}
        disabled={processing || !targetTier || !chartId || noteCount === 0}
      >
        Generate preview
      </AiFlowPrimaryButton>
    </AiFlowFooter>
  </>
)
```

- [ ] **Step 2: Verify app builds**

```bash
cd apps/web && pnpm build 2>&1 | tail -10
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/editor/components/ai-assistant/flows/ScaleDifficultyFlow.tsx
git commit -m "fix(ai-ux): surface replace-mode warning before tier selection in ScaleDifficultyFlow"
```

---

## Task 6: Emit detail events from backend during long steps

**Files:**
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/ai-chart.service.ts`

The `AiProgressEmitter` type already accepts `detail?: string` and `AiStreamEvent` step events already carry `detail?: string`. We just need to call `onProgress` with detail text before/after key operations.

- [ ] **Step 1: Add detail helper to `ai-progress.util.ts`**

In `apps/api/src/modules/ai/ai-progress.util.ts`, add this helper after `runStep`:

```typescript
/** Emit a detail message on an already-active step without changing its status. */
export function emitDetail(
  steps: AiStreamStepDef[],
  stepId: string,
  detail: string,
  onProgress: AiProgressEmitter | undefined,
): void {
  if (!onProgress) return
  const def = steps.find((s) => s.stepId === stepId)
  if (!def) return
  onProgress({ type: 'step', stepId, label: def.label, status: 'active', detail })
}
```

- [ ] **Step 2: Emit details in `AiService.suggestNotes`**

In `apps/api/src/modules/ai/ai.service.ts`, add `emitDetail` to the import:

```typescript
import { type AiProgressEmitter, runStep, emitDetail } from './ai-progress.util'
```

In the `suggestNotes` method, update the `generate` step block:

```typescript
const raw = await runStep(steps, 'generate', onProgress, async () => {
  emitDetail(steps, 'generate', `Calling AI (${body.mode})…`, onProgress)
  const prompt = this.buildPrompt(
    body.mode,
    body.targetTrack,
    context,
    body.instruction,
    body.selectedNotes,
  )
  const result = await this.callClaude(prompt)
  emitDetail(steps, 'generate', `Received ${result.length} raw suggestion${result.length !== 1 ? 's' : ''}`, onProgress)
  return result
})

const suggestions = await runStep(steps, 'validate', onProgress, async () => {
  const validated = this.postProcess(raw, context, body.mode, body.targetTrack, body.selectedNotes)
  emitDetail(steps, 'validate', `${validated.length} valid placement${validated.length !== 1 ? 's' : ''}`, onProgress)
  return validated
})
```

- [ ] **Step 3: Emit details in `AiChartService.generateChart` and `scaleChart`**

In `apps/api/src/modules/ai/ai-chart.service.ts`, add `emitDetail` to the import:

```typescript
import { AI_STREAM_STEPS, type AiProgressEmitter, runStep, emitDetail } from './ai-progress.util'
```

In `generateChart`, hoist `targetCount` before the steps and update `generate`/`normalize`:

```typescript
// Hoist targetCount so it's accessible in later steps
const targetCount = body.targetTier ? TARGET_NOTE_COUNT[body.targetTier] ?? 90 : 90

const prompt = await runStep(steps, 'build_prompt', onProgress, async () => {
  const description = body.description.trim()
  if (!description) throw new BadRequestException('Description is required')
  return buildGeneratePrompt({
    ctx,
    description,
    snapHint: this.snapHint(body.snapMode, ctx.song.bpm),
    targetCount,
    targetTier: body.targetTier,
    replaceExisting: body.replaceExisting,
  })
})

const parsed = await runStep(steps, 'generate', onProgress, async () => {
  emitDetail(steps, 'generate', `Calling AI for ~${targetCount} notes…`, onProgress)
  const result = await this.callClaudeForChart(prompt, 'generate')
  emitDetail(steps, 'generate', `Received ${(result.notes as unknown[]).length} raw notes from AI`, onProgress)
  return result
})

const notes = await runStep(steps, 'normalize', onProgress, async () => {
  const normalized = this.normalizeGeneratedNotes(parsed.notes, body.snapMode, ctx.song.bpm)
  emitDetail(steps, 'normalize', `Kept ${normalized.length} valid notes after normalization`, onProgress)
  return normalized
})
```

In `scaleChart`, same pattern — hoist `targetCount` before steps then use in `generate`:

```typescript
// Hoist targetCount so it's accessible in later steps
const targetCount = TARGET_NOTE_COUNT[body.targetTier] ?? 90

const ctx = await runStep(steps, 'load_chart', onProgress, async () => {
  const loaded = await this.chartContext.loadChartContext(songId, body.chartId)
  if (loaded.notes.length === 0) throw new BadRequestException('Cannot scale an empty chart')
  return loaded
})

const prompt = await runStep(steps, 'build_prompt', onProgress, async () =>
  this.buildScalePrompt(ctx, body.targetTier, targetCount, body.instruction?.trim(), body.snapMode),
)

const parsed = await runStep(steps, 'generate', onProgress, async () => {
  emitDetail(steps, 'generate', `Calling AI for ~${targetCount} notes (${body.targetTier})…`, onProgress)
  const result = await this.callClaudeForChart(prompt, 'scale')
  emitDetail(steps, 'generate', `Received ${(result.notes as unknown[]).length} raw notes from AI`, onProgress)
  return result
})

const notes = await runStep(steps, 'normalize', onProgress, async () => {
  const normalized = this.normalizeGeneratedNotes(parsed.notes, body.snapMode, ctx.song.bpm)
  emitDetail(steps, 'normalize', `Kept ${normalized.length} valid notes after normalization`, onProgress)
  return normalized
})
```

- [ ] **Step 4: Verify tests still pass**

```bash
cd apps/api && pnpm test --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ai/ai-progress.util.ts apps/api/src/modules/ai/ai.service.ts apps/api/src/modules/ai/ai-chart.service.ts
git commit -m "feat(ai): emit real detail messages during generate/normalize steps via SSE"
```

---

## Task 7: Capture detail text per step in `useAiStreamRun`

**Files:**
- Modify: `apps/web/src/features/editor/components/ai-assistant/useAiStreamRun.ts`

- [ ] **Step 1: Extend hook to track details and step start times**

Replace the entire `useAiStreamRun.ts`:

```typescript
import { useCallback, useRef, useState } from 'react'
import { AI_STREAM_STEPS, type AiStreamEvent, type AiStreamRequest, type AiStreamStepStatus } from '@ama-midi/shared'
import { streamAiRequest } from '../../ai-stream'

type StepState = AiStreamStepStatus | 'pending'

export function useAiStreamRun(songId: string, token: string | null) {
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const [details, setDetails] = useState<Record<string, string>>({})
  const [stepStartTimes, setStepStartTimes] = useState<Record<string, number>>({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runIdRef = useRef<string | null>(null)

  const resetSteps = useCallback((action: AiStreamRequest['action']) => {
    const initial: Record<string, StepState> = {}
    for (const s of AI_STREAM_STEPS[action]) initial[s.stepId] = 'pending'
    setSteps(initial)
    setDetails({})
    setStepStartTimes({})
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
            if (event.detail) {
              setDetails((prev) => ({ ...prev, [event.stepId]: event.detail! }))
            }
            if (event.status === 'active') {
              setStepStartTimes((prev) => ({
                ...prev,
                [event.stepId]: prev[event.stepId] ?? Date.now(),
              }))
            }
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

  return { steps, details, stepStartTimes, processing, error, start, cancel }
}
```

- [ ] **Step 2: Update `AiAssistantModal` to pass new props**

In `apps/web/src/features/editor/components/ai-assistant/AiAssistantModal.tsx`, find where `AiProgressTree` is rendered and update:

```typescript
{phase === 'processing' && streamAction && (
  <div className="space-y-4">
    <AiProgressTree
      action={streamAction}
      steps={streamRun.steps}
      details={streamRun.details}
      stepStartTimes={streamRun.stepStartTimes}
    />
    <p className="text-[11px]" style={{ color: 'var(--modal-muted)' }}>
      Keep this open while AI runs — use Cancel to stop.
    </p>
    {streamRun.error && (
      <p className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-medium text-red-200">
        {streamRun.error}
      </p>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep -E "error|AiProgressTree" | head -20
```

Expected: errors only about `AiProgressTree` missing props (we fix that next task).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/ai-assistant/useAiStreamRun.ts apps/web/src/features/editor/components/ai-assistant/AiAssistantModal.tsx
git commit -m "feat(ai-ux): track per-step detail text and start timestamps in useAiStreamRun"
```

---

## Task 8: Redesign `AiProgressTree` with elapsed timer, detail text, and animations

**Files:**
- Modify: `apps/web/src/features/editor/components/ai-assistant/AiProgressTree.tsx`

- [ ] **Step 1: Rewrite `AiProgressTree`**

Replace the entire file:

```typescript
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { AI_STREAM_STEPS, type AiStreamAction } from '@ama-midi/shared'
import { cn } from '../../../../lib/utils'
import type { ProgressStepState } from './ai-assistant.types'

interface Props {
  action: AiStreamAction
  steps: Record<string, ProgressStepState>
  details: Record<string, string>
  stepStartTimes: Record<string, number>
}

/** Live elapsed counter for an active step. Renders MM:SS. */
function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0)
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
      rafRef.current = setTimeout(tick, 1000)
    }
    tick()
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current)
    }
  }, [startTime])

  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return (
    <span className="ml-auto shrink-0 tabular-nums text-[10px] text-primary/60">
      {m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`}
    </span>
  )
}

function StepIcon({ status }: { status: ProgressStepState }) {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/25 text-[var(--ai-accent-bright,#a5a0ff)] ring-1 ring-primary/40">
        <CheckIcon className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 ring-1 ring-red-500/40">
        <Cross2Icon className="h-3 w-3" />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="ai-progress-step--active flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/50">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--ai-accent-bright,#b4afff)] border-t-transparent" />
      </span>
    )
  }
  return (
    <span className="h-5 w-5 shrink-0 rounded-full border border-white/15 bg-white/[0.03]" />
  )
}

export function AiProgressTree({ action, steps, details, stepStartTimes }: Props) {
  const defs = AI_STREAM_STEPS[action]

  return (
    <ul className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3">
      {defs.map((def, index) => {
        const status = steps[def.stepId] ?? 'pending'
        const detail = details[def.stepId]
        const startTime = stepStartTimes[def.stepId]
        const isActive = status === 'active'

        return (
          <li
            key={def.stepId}
            className={cn(
              'flex flex-col gap-0.5 rounded-md px-2 py-1.5 transition-all duration-300',
              isActive && 'bg-primary/[0.07]',
            )}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-center gap-3">
              <StepIcon status={status} />
              <span
                className={cn(
                  'text-sm transition-all duration-200',
                  isActive && 'ai-progress-label--active font-semibold text-primary',
                  status === 'done' && 'ai-progress-label--done text-shell-text',
                  status === 'error' && 'font-medium text-red-400',
                  status === 'pending' && 'text-shell-muted dark:text-[var(--ai-text-muted)]',
                )}
              >
                {def.label}
              </span>
              {isActive && startTime && <ElapsedTimer startTime={startTime} />}
            </div>
            {isActive && detail && (
              <p
                className="ml-8 text-[11px] leading-snug text-primary/50 transition-all duration-300"
                key={detail}
              >
                {detail}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
cd apps/api && pnpm test --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/editor/components/ai-assistant/AiProgressTree.tsx
git commit -m "feat(ai-ux): add elapsed timer, detail text, and active-step highlight to AiProgressTree"
```

---

## Task 9: Final integration check

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/hohoanghvy/Projects/ama-midi && pnpm test 2>&1 | tail -20
```

Expected: all suites pass.

- [ ] **Step 2: Build both apps**

```bash
pnpm build 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
pnpm lint 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 4: Final commit if any lint fixes**

```bash
git add -A
git commit -m "chore: lint fixes after ai workflow refactor"
```

---

## Summary of Changes

| Bug | Fix | Task |
|---|---|---|
| N+1 deletes in replace mode | `updateMany` bulk soft-delete | Task 1 |
| Silent LLM error in suggestNotes | `Logger` + `ServiceUnavailableException` | Task 2 |
| Duplicate density/segments in prompt | Remove `Density profile` line | Task 3 |
| No rate limiting on AI endpoints | `@Throttle({ limit: 10, ttl: 60000 })` | Task 4 |
| Replace warning shown after tier pick | Move `AiFlowCallout` to top of form | Task 5 |
| No real progress detail during generate | `emitDetail()` calls in service | Task 6 |

| UX Feature | Implementation | Task |
|---|---|---|
| Per-step detail text | `details` state in `useAiStreamRun` | Task 7 |
| Elapsed timer on active step | `ElapsedTimer` component with `setTimeout` | Task 8 |
| Active step visual prominence | Background highlight + font-semibold | Task 8 |
