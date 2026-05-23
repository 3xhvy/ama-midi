# Difficulty Analysis & Assessment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship full-stack difficulty analysis — multi-chart songs, shared 8-factor engine, persisted segments/warnings, editor live panel, and Analysis Board for level designers.

**Architecture:** Pure analysis in `packages/shared/src/difficulty/`. Prisma adds `SongChart`, `ChartDifficultySegment`, `ChartValidationWarning`; notes owned by `chartId`. API `charts` module + `ChartAnalyzeService` runs after note mutations. Web debounces client-side `analyzeChart()` for live UX; Analysis Board reads persisted API data.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React 18, TanStack Query, Zustand, `@ama-midi/shared`, node:test (web), Jest (api).

**Spec:** `docs/superpowers/specs/2026-05-24-difficulty-analysis-design.md`

**Prerequisite:** Dev DB wipe acceptable — run `cd apps/api && npx prisma migrate reset --force` after schema migration.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `packages/shared/src/difficulty/types.ts` | Analysis input/output types |
| Create | `packages/shared/src/difficulty/tier-thresholds.ts` | Tier mapping + validation limits |
| Create | `packages/shared/src/difficulty/factors.ts` | Per-factor scorers |
| Create | `packages/shared/src/difficulty/analyze-chart.ts` | `analyzeChart`, segment scoring |
| Create | `packages/shared/src/difficulty/validate-chart.ts` | Warning generation |
| Create | `packages/shared/src/difficulty/index.ts` | Public exports |
| Modify | `packages/shared/src/types.ts` | `SongChart`, segments, warnings; `Note.chartId`; remove `Song.difficulty` |
| Modify | `packages/shared/src/index.ts` | Export difficulty module |
| Modify | `apps/api/prisma/schema.prisma` | New models, Note.chartId, drop Song.difficulty |
| Create | `apps/api/src/modules/charts/*` | Charts CRUD + analyze |
| Modify | `apps/api/src/modules/notes/*` | chartId-scoped routes |
| Modify | `apps/api/src/modules/songs/songs.service.ts` | Default chart on create; publish gate |
| Create | `apps/web/tests/difficulty-analysis.test.ts` | Shared engine unit tests |
| Create | `apps/web/src/features/charts/*` | Chart switcher hooks |
| Create | `apps/web/src/features/analysis/*` | Analysis Board |
| Modify | `apps/web/src/features/editor/engine/difficulty-calculator.ts` | Re-export shared + heatmap colors |
| Modify | `apps/web/src/features/editor/components/DifficultyOverlay.tsx` | Segment-score colors |
| Create | `apps/web/src/features/editor/components/AnalysisSummaryPanel.tsx` | Live editor panel |
| Modify | `apps/web/src/pages/EditorPage.tsx` | Chart context + panel |
| Modify | `apps/web/src/App.tsx` | Analysis Board route |
| Modify | `apps/web/src/features/notes/useNotes.ts` | chartId API paths |
| Modify | `apps/web/src/features/songs/create-wizard/*` | Remove difficulty picker |

---

## Task 1: Shared types + tier thresholds

**Files:**
- Create: `packages/shared/src/difficulty/types.ts`
- Create: `packages/shared/src/difficulty/tier-thresholds.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add difficulty types**

```typescript
// packages/shared/src/difficulty/types.ts
import type { NoteType, SongDifficulty } from '../enums'

export interface AnalyzeNote {
  track: number
  time: number
  noteType: NoteType
  duration?: number | null
}

export interface AnalyzeChartInput {
  chartId?: string
  notes: AnalyzeNote[]
  bpm: number
  timeSignature: string
  speedMultiplier: number
  segmentWindowSeconds?: number
  songDurationSeconds?: number
}

export interface ChartFactorBreakdown {
  densityScore: number
  speedScore: number
  laneJumpScore: number
  syncopationScore: number
  holdNoteScore: number
  simultaneousNoteScore: number
  patternComplexityScore: number
  repetitionScore: number
}

export interface AnalyzedSegment {
  startTimeMs: number
  endTimeMs: number
  notesPerSecond: number
  averageLaneJump: number
  offbeatRatio: number
  holdNoteRatio: number
  simultaneousNoteRatio: number
  patternComplexityScore: number
  difficultyScore: number
  difficultyLevel: SongDifficulty
}

export interface AnalysisWarningDraft {
  code: string
  severity: 'INFO' | 'WARN' | 'ERROR'
  startTimeMs?: number
  endTimeMs?: number
  message: string
  metadata?: Record<string, unknown>
}

export interface ChartAnalysisResult {
  chartId?: string
  computedDifficulty: SongDifficulty
  averageDifficultyScore: number
  peakDifficultyScore: number
  segments: AnalyzedSegment[]
  warnings: AnalysisWarningDraft[]
  factors: ChartFactorBreakdown
}
```

- [ ] **Step 2: Add tier thresholds**

```typescript
// packages/shared/src/difficulty/tier-thresholds.ts
import type { SongDifficulty } from '../enums'

export function scoreToDifficulty(score: number): SongDifficulty {
  if (score < 3) return 'EASY'
  if (score < 7) return 'NORMAL'
  if (score < 12) return 'HARD'
  if (score < 18) return 'EXPERT'
  return 'MASTER'
}

export function difficultyToSpeedSuggestion(tier: SongDifficulty): number {
  const map: Record<SongDifficulty, number> = {
    EASY: 1.0, NORMAL: 1.2, HARD: 1.5, EXPERT: 1.8, MASTER: 2.0,
  }
  return map[tier]
}

export interface TierLimits {
  maxNpsWarn: number
  maxNpsError: number
  maxOffbeatRatio: number
  maxDoublesPer10s: number
}

export const TIER_LIMITS: Record<SongDifficulty, TierLimits> = {
  EASY:   { maxNpsWarn: 2.5, maxNpsError: 3.5, maxOffbeatRatio: 0.20, maxDoublesPer10s: 0 },
  NORMAL: { maxNpsWarn: 4.0, maxNpsError: 5.5, maxOffbeatRatio: 0.35, maxDoublesPer10s: 1 },
  HARD:   { maxNpsWarn: 6.0, maxNpsError: 7.5, maxOffbeatRatio: 0.50, maxDoublesPer10s: 3 },
  EXPERT: { maxNpsWarn: 8.0, maxNpsError: 10.0, maxOffbeatRatio: 0.65, maxDoublesPer10s: 5 },
  MASTER: { maxNpsWarn: 10.0, maxNpsError: 12.0, maxOffbeatRatio: 0.80, maxDoublesPer10s: 8 },
}

export function segmentScoreToColor(score: number): string {
  if (score < 4) return 'rgba(16, 185, 129, 0.15)'
  if (score < 10) return 'rgba(245, 158, 11, 0.20)'
  return 'rgba(239, 68, 68, 0.25)'
}
```

- [ ] **Step 3: Update shared types — add SongChart, remove Song.difficulty**

In `packages/shared/src/types.ts`:
- Add `chartId: string` to `Note`
- Add `SongChart`, `ChartDifficultySegment`, `ChartValidationWarning`, `ChartAnalysisResult` interfaces (match spec Section 1)
- Remove `difficulty` from `Song`, `CreateProjectSongInput`, and any template types
- Add optional `charts?: SongChart[]` and `chartSummary?: string` on list DTOs

- [ ] **Step 4: Export from index**

```typescript
// packages/shared/src/index.ts (append)
export * from './difficulty'
```

```typescript
// packages/shared/src/difficulty/index.ts
export * from './types'
export * from './tier-thresholds'
export { analyzeChart } from './analyze-chart'
export { validateChart } from './validate-chart'
export { maxCombo, computeNpsOverTime } from './factors'
```

- [ ] **Step 5: Build shared**

```bash
cd packages/shared && pnpm build
```

Expected: compiles (analyze-chart not yet implemented — stub export if needed for build).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/difficulty packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "feat(shared): add difficulty analysis types and tier thresholds"
```

---

## Task 2: Analysis engine — factors + analyzeChart

**Files:**
- Create: `packages/shared/src/difficulty/factors.ts`
- Create: `packages/shared/src/difficulty/analyze-chart.ts`
- Test: `apps/web/tests/difficulty-analysis.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/tests/difficulty-analysis.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeChart, scoreToDifficulty } from '../../packages/shared/src/difficulty/index.ts'
import type { AnalyzeNote } from '../../packages/shared/src/difficulty/types.ts'

const tap = (track: number, time: number): AnalyzeNote => ({
  track, time, noteType: 'TAP',
})

describe('scoreToDifficulty', () => {
  it('maps boundary scores', () => {
    assert.equal(scoreToDifficulty(2.9), 'EASY')
    assert.equal(scoreToDifficulty(3.0), 'NORMAL')
    assert.equal(scoreToDifficulty(11.9), 'HARD')
    assert.equal(scoreToDifficulty(12.0), 'EXPERT')
    assert.equal(scoreToDifficulty(18.0), 'MASTER')
  })
})

describe('analyzeChart', () => {
  it('empty chart → EASY, score 0', () => {
    const r = analyzeChart({ notes: [], bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    assert.equal(r.computedDifficulty, 'EASY')
    assert.equal(r.averageDifficultyScore, 0)
    assert.equal(r.warnings.length, 0)
  })

  it('straight 1-2-3-4 pattern has low lane jump', () => {
    const notes = [1, 2, 3, 4].map((t, i) => tap(t, i * 0.5))
    const r = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    assert.ok(r.factors.laneJumpScore < 0.3)
  })

  it('random jumps 1-8-2-7 increase jump + complexity', () => {
    const notes = [tap(1, 0), tap(8, 0.5), tap(2, 1), tap(7, 1.5)]
    const r = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    assert.ok(r.factors.laneJumpScore > 0.4)
    assert.ok(r.factors.patternComplexityScore > 0.2)
  })

  it('speedMultiplier 2.0 increases score vs 1.0', () => {
    const notes = Array.from({ length: 40 }, (_, i) => tap((i % 4) + 1, i * 0.25))
    const slow = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const fast = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 2.0 })
    assert.ok(fast.averageDifficultyScore > slow.averageDifficultyScore)
  })

  it('simultaneous pair increases simultaneous factor', () => {
    const r = analyzeChart({
      notes: [tap(1, 1.0), tap(4, 1.0)],
      bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0,
    })
    assert.ok(r.factors.simultaneousNoteScore > 0)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
node --import tsx --test apps/web/tests/difficulty-analysis.test.ts
```

- [ ] **Step 3: Implement factors.ts**

```typescript
// packages/shared/src/difficulty/factors.ts
import { beatDuration } from '../snap'
import type { AnalyzeNote } from './types'

const SIMULTANEOUS_EPS = 0.05
const MAX_LANE_SPAN = 7

export function computeNpsOverTime(
  notes: AnalyzeNote[], windowSeconds = 2, resolution = 0.5, maxTime = 300,
): Array<{ time: number; nps: number }> {
  const result: Array<{ time: number; nps: number }> = []
  for (let t = 0; t <= maxTime; t = +(t + resolution).toFixed(3)) {
    const count = notes.filter(
      n => n.time >= t - windowSeconds / 2 && n.time < t + windowSeconds / 2,
    ).length
    result.push({ time: t, nps: count / windowSeconds })
  }
  return result
}

export function maxCombo(notes: AnalyzeNote[]): number {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  let max = 0, streak = 0, last = -Infinity
  for (const n of sorted) {
    if (n.time - last <= 2) streak++
    else streak = 1
    max = Math.max(max, streak)
    last = n.time
  }
  return max
}

function beatPhase(time: number, bpm: number): number {
  const bd = beatDuration(bpm)
  return (time % bd) / bd
}

export function syncopationWeight(time: number, bpm: number): number {
  const phase = beatPhase(time, bpm)
  const dist = Math.min(
    Math.abs(phase), Math.abs(phase - 0.5),
    Math.abs(phase - 0.25), Math.abs(phase - 0.75),
  )
  if (dist < 0.05 / beatDuration(bpm)) return 0
  if (dist < 0.08) return 0.5
  return 1
}

export function laneJumps(notes: AnalyzeNote[]): number[] {
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.track - b.track)
  const jumps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    jumps.push(Math.abs(sorted[i].track - sorted[i - 1].track))
  }
  return jumps
}

export function simultaneousGroups(notes: AnalyzeNote[]): number[] {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  const sizes: number[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && Math.abs(sorted[j].time - sorted[i].time) <= SIMULTANEOUS_EPS) j++
    const size = j - i
    if (size > 1) sizes.push(size)
    i = j
  }
  return sizes
}

export function patternEntropy(notes: AnalyzeNote[]): number {
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  if (sorted.length < 2) return 0
  const counts = new Map<string, number>()
  for (let i = 1; i < sorted.length; i++) {
    const key = `${sorted[i - 1].track}->${sorted[i].track}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  let entropy = 0
  for (const c of counts.values()) {
    const p = c / total
    entropy -= p * Math.log2(p)
  }
  const maxEntropy = Math.log2(Math.min(64, counts.size || 1))
  return maxEntropy > 0 ? entropy / maxEntropy : 0
}

export function surpriseScore(notes: AnalyzeNote[], bpm: number): number {
  const bd = beatDuration(bpm) * 4
  if (notes.length < 8) return 0
  const sorted = [...notes].sort((a, b) => a.time - b.time)
  const windowTracks = sorted.slice(0, 8).map(n => n.track)
  let matches = 0, total = 0
  for (let start = 8; start + 8 <= sorted.length; start += 4) {
    const next = sorted.slice(start, start + 8).map(n => n.track)
    for (let k = 0; k < 8; k++) {
      total++
      if (windowTracks[k] === next[k]) matches++
    }
  }
  return total > 0 ? 1 - matches / total : 0
}

export function holdOverlapStress(notes: AnalyzeNote[]): number {
  const holds = notes.filter(n => n.noteType === 'HOLD' && n.duration)
  if (!holds.length) return 0
  let stress = 0
  for (const h of holds) {
    const end = h.time + (h.duration ?? 0)
    const overlaps = notes.filter(
      n => n !== h && n.time >= h.time && n.time <= end && n.track !== h.track,
    )
    if (overlaps.length >= 2) stress++
  }
  return holds.length ? stress / holds.length : 0
}

export function segmentMetrics(
  notes: AnalyzeNote[], startSec: number, endSec: number, bpm: number,
) {
  const seg = notes.filter(n => n.time >= startSec && n.time < endSec)
  const duration = endSec - startSec
  const nps = duration > 0 ? seg.length / duration : 0
  const jumps = laneJumps(seg)
  const avgJump = jumps.length ? jumps.reduce((a, b) => a + b, 0) / jumps.length : 0
  const offbeat = seg.length
    ? seg.reduce((s, n) => s + syncopationWeight(n.time, bpm), 0) / seg.length
    : 0
  const holdRatio = seg.length ? seg.filter(n => n.noteType === 'HOLD').length / seg.length : 0
  const simGroups = simultaneousGroups(seg)
  const simRatio = seg.length ? simGroups.length / seg.length : 0
  const complexity = patternEntropy(seg)
  return { nps, avgJump, offbeat, holdRatio, simRatio, complexity, noteCount: seg.length }
}

export function computeSegmentScore(
  m: ReturnType<typeof segmentMetrics>,
  speedMultiplier: number,
  surprise: number,
): number {
  return (
    m.nps * 2.0
    + m.avgJump * 1.5
    + m.offbeat * 3.0
    + m.holdRatio * 2.0
    + m.simRatio * 3.0
    + m.complexity * 2.5
    + speedMultiplier * 2.0
    + surprise * 1.5
  )
}
```

- [ ] **Step 4: Implement analyze-chart.ts**

```typescript
// packages/shared/src/difficulty/analyze-chart.ts
import type { AnalyzeChartInput, ChartAnalysisResult, ChartFactorBreakdown } from './types'
import { scoreToDifficulty } from './tier-thresholds'
import {
  computeSegmentScore, holdOverlapStress, laneJumps, maxCombo,
  patternEntropy, segmentMetrics, simultaneousGroups, surpriseScore, syncopationWeight,
} from './factors'

export function analyzeChart(input: AnalyzeChartInput): ChartAnalysisResult {
  const {
    notes, bpm, timeSignature: _ts, speedMultiplier,
    segmentWindowSeconds = 5, songDurationSeconds = 300, chartId,
  } = input

  const segments = []
  let totalWeight = 0, weightedScore = 0, peak = 0
  const globalSurprise = surpriseScore(notes, bpm)

  for (let start = 0; start < songDurationSeconds; start += segmentWindowSeconds) {
    const end = Math.min(start + segmentWindowSeconds, songDurationSeconds)
    const m = segmentMetrics(notes, start, end, bpm)
    const score = computeSegmentScore(m, speedMultiplier, globalSurprise)
    peak = Math.max(peak, score)
    if (m.noteCount > 0) {
      weightedScore += score * m.noteCount
      totalWeight += m.noteCount
    }
    segments.push({
      startTimeMs: Math.round(start * 1000),
      endTimeMs: Math.round(end * 1000),
      notesPerSecond: m.nps,
      averageLaneJump: m.avgJump,
      offbeatRatio: m.offbeat,
      holdNoteRatio: m.holdRatio,
      simultaneousNoteRatio: m.simRatio,
      patternComplexityScore: m.complexity,
      difficultyScore: score,
      difficultyLevel: scoreToDifficulty(score),
    })
  }

  const averageDifficultyScore = totalWeight > 0 ? weightedScore / totalWeight : 0
  const jumps = laneJumps(notes)
  const simGroups = simultaneousGroups(notes)

  const MAX_LANE = 7
  const factors: ChartFactorBreakdown = {
    densityScore: Math.min(1, notes.length / songDurationSeconds / 8),
    speedScore: Math.min(1, (speedMultiplier - 0.8) / 1.2),
    laneJumpScore: jumps.length ? Math.min(1, jumps.reduce((a, b) => a + b, 0) / jumps.length / MAX_LANE) : 0,
    syncopationScore: notes.length
      ? notes.reduce((s, n) => s + syncopationWeight(n.time, bpm), 0) / notes.length
      : 0,
    holdNoteScore: Math.min(1, holdOverlapStress(notes) + (notes.filter(n => n.noteType === 'HOLD').length / Math.max(notes.length, 1))),
    simultaneousNoteScore: Math.min(1, simGroups.filter(s => s >= 2).length / Math.max(notes.length, 1)),
    patternComplexityScore: patternEntropy(notes),
    repetitionScore: 1 - globalSurprise,
  }

  const result: ChartAnalysisResult = {
    chartId,
    computedDifficulty: scoreToDifficulty(averageDifficultyScore),
    averageDifficultyScore,
    peakDifficultyScore: peak,
    segments,
    warnings: [],
    factors,
  }

  return result
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
node --import tsx --test apps/web/tests/difficulty-analysis.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/difficulty/factors.ts packages/shared/src/difficulty/analyze-chart.ts apps/web/tests/difficulty-analysis.test.ts
git commit -m "feat(shared): analyzeChart engine with 8 difficulty factors"
```

---

## Task 3: Validation engine

**Files:**
- Create: `packages/shared/src/difficulty/validate-chart.ts`
- Test: `apps/web/tests/difficulty-validation.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/tests/difficulty-validation.test.ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeChart, validateChart } from '../../packages/shared/src/difficulty/index.ts'

describe('validateChart', () => {
  it('EASY chart with triple simultaneous → TOO_MANY_TRIPLES ERROR', () => {
    const notes = [
      { track: 1, time: 1, noteType: 'TAP' as const },
      { track: 2, time: 1, noteType: 'TAP' as const },
      { track: 3, time: 1, noteType: 'TAP' as const },
    ]
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChart(analysis, 'EASY', 1.0)
    assert.ok(warnings.some(w => w.code === 'TOO_MANY_TRIPLES' && w.severity === 'ERROR'))
  })

  it('detects DIFFICULTY_SPIKE ERROR when segment >> average', () => {
    const sparse = Array.from({ length: 10 }, (_, i) => ({ track: 1, time: i * 10, noteType: 'TAP' as const }))
    const burst = Array.from({ length: 30 }, (_, i) => ({ track: (i % 8) + 1, time: 50 + i * 0.1, noteType: 'TAP' as const }))
    const notes = [...sparse, ...burst]
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChart(analysis, analysis.computedDifficulty, 1.0)
    assert.ok(warnings.some(w => w.code === 'DIFFICULTY_SPIKE'))
  })

  it('SPEED_TIER_MISMATCH when speed differs from suggestion', () => {
    const analysis = analyzeChart({ notes: [], bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChart(analysis, 'EXPERT', 1.0)
    assert.ok(warnings.some(w => w.code === 'SPEED_TIER_MISMATCH'))
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
node --import tsx --test apps/web/tests/difficulty-validation.test.ts
```

- [ ] **Step 3: Implement validate-chart.ts**

Implement all warning codes from spec Section 3 using `TIER_LIMITS`, `difficultyToSpeedSuggestion`, and `computeNpsOverTime` for peak NPS checks. Export:

```typescript
export function validateChart(
  analysis: ChartAnalysisResult,
  tier: SongDifficulty,
  speedMultiplier: number,
  chartName = '',
): AnalysisWarningDraft[]
```

- [ ] **Step 4: Wire warnings into analyzeChart**

At end of `analyzeChart`, call `validateChart(result, result.computedDifficulty, speedMultiplier)` and assign to `result.warnings`.

- [ ] **Step 5: Run all difficulty tests — expect PASS**

```bash
node --import tsx --test apps/web/tests/difficulty-analysis.test.ts apps/web/tests/difficulty-validation.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/difficulty/validate-chart.ts apps/web/tests/difficulty-validation.test.ts
git commit -m "feat(shared): tier-aware chart validation warnings"
```

---

## Task 4: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Update schema per spec**

Add `SongChart`, `ChartDifficultySegment`, `ChartValidationWarning`, `ValidationSeverity` enum. Add `chartId` to `Note`. Remove `difficulty` from `Song`. Add relations on `Song.charts`.

- [ ] **Step 2: Create migration**

```bash
cd apps/api && npx prisma migrate dev --name difficulty_analysis_charts
```

Expected: migration SQL creates tables, updates notes FK, drops `songs.difficulty`.

- [ ] **Step 3: Reset dev DB (user confirmed wipe OK)**

```bash
cd apps/api && npx prisma migrate reset --force
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat(api): prisma schema for song charts and difficulty analysis"
```

---

## Task 5: Charts API module

**Files:**
- Create: `apps/api/src/modules/charts/charts.module.ts`
- Create: `apps/api/src/modules/charts/charts.controller.ts`
- Create: `apps/api/src/modules/charts/charts.service.ts`
- Create: `apps/api/src/modules/charts/chart-analyze.service.ts`
- Create: `apps/api/src/modules/charts/dto/create-chart.dto.ts`
- Create: `apps/api/src/modules/charts/dto/update-chart.dto.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: charts.service.ts — CRUD + duplicate + default chart**

```typescript
async createDefaultChart(songId: string): Promise<SongChart> {
  return this.prisma.songChart.create({
    data: { songId, name: 'Main', speedMultiplier: 1.0 },
  })
}

async duplicate(chartId: string, user: AuthUser, opts?: { name?: string; speedMultiplier?: number }) {
  const src = await this.findOne(chartId, user)
  const copy = await this.prisma.songChart.create({
    data: {
      songId: src.songId,
      name: opts?.name ?? `${src.name} copy`,
      speedMultiplier: opts?.speedMultiplier ?? src.speedMultiplier,
    },
  })
  const notes = await this.prisma.note.findMany({ where: { chartId: src.id, deletedAt: null } })
  if (notes.length) {
    await this.prisma.note.createMany({
      data: notes.map(n => ({
        chartId: copy.id, songId: src.songId, track: n.track, time: n.time,
        title: n.title, description: n.description, noteType: n.noteType,
        duration: n.duration, createdBy: user.id,
      })),
    })
  }
  await this.analyze.run(copy.id)
  return copy
}
```

- [ ] **Step 2: chart-analyze.service.ts**

Load chart + song + notes → `analyzeChart()` from `@ama-midi/shared` → transaction:
1. Update chart scores + `analyzedAt`
2. `deleteMany` segments/warnings for chartId
3. `createMany` new segments/warnings with generated UUIDs

- [ ] **Step 3: charts.controller.ts routes**

Implement all routes from spec Section 4. Guard with existing `ProjectAccessService`.

- [ ] **Step 4: Register ChartsModule in AppModule**

- [ ] **Step 5: Manual smoke test**

```bash
cd apps/api && pnpm dev
# POST create song → GET /songs/:id/charts → expect one "Main" chart
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/charts apps/api/src/app.module.ts
git commit -m "feat(api): charts module with analyze persistence"
```

---

## Task 6: Notes API — chartId scope

**Files:**
- Modify: `apps/api/src/modules/notes/notes.controller.ts`
- Modify: `apps/api/src/modules/notes/notes.service.ts`
- Modify: `apps/api/src/modules/notes/note-query.service.ts`
- Modify: `apps/api/src/modules/charts/chart-analyze.service.ts` (hook)
- Test: `apps/api/src/modules/charts/__tests__/charts.analyze.spec.ts`

- [ ] **Step 1: Change controller base path**

```typescript
@Controller('charts/:chartId')
export class NotesController { /* ... */ }
```

All methods resolve `chartId` → `songId` via chart lookup for access checks and denormalized `songId` on note writes.

- [ ] **Step 2: Update overlap assert + unique index queries**

Replace `songId` with `chartId` in `assertNoTrackOverlap` and list queries.

- [ ] **Step 3: Call analyze after create/update/delete/undo**

Inject `ChartAnalyzeService` into `NotesService`; call `this.analyze.run(chartId)` after successful mutations (outside transaction or after commit).

- [ ] **Step 4: Write integration test**

```typescript
// apps/api/src/modules/charts/__tests__/charts.analyze.spec.ts
it('creates song with default chart and persists segments after note create', async () => {
  // create project + song → get charts[0].id → POST note → GET analysis → expect segments.length > 0
})
```

- [ ] **Step 5: Run API tests**

```bash
cd apps/api && pnpm test -- --testPathPattern=charts.analyze
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/notes apps/api/src/modules/charts/__tests__
git commit -m "feat(api): scope notes to chartId and trigger analysis"
```

---

## Task 7: Songs service — remove difficulty, default chart, publish gate

**Files:**
- Modify: `apps/api/src/modules/songs/songs.service.ts`
- Modify: `apps/api/src/modules/songs/dto/create-project-song.dto.ts`
- Modify: `apps/api/src/modules/songs/song-template.service.ts`
- Test: `apps/api/src/modules/songs/__tests__/songs.publish-gate.spec.ts`

- [ ] **Step 1: Remove difficulty from create DTO and service**

Inject `ChartsService`; after song create call `createDefaultChart(song.id)`.

- [ ] **Step 2: Update toSong mapper**

Remove `difficulty`; add `charts` summary:

```typescript
chartSummary: s.charts?.length
  ? s.charts.length === 1
    ? `${s.charts[0].name} · ${s.charts[0].computedDifficulty}`
    : `${s.charts.length} charts · peak ${peakTier(s.charts)}`
  : undefined
```

- [ ] **Step 3: Publish gate in updateStatus**

Before `IN_REVIEW→APPROVED` or `APPROVED→PUBLISHED`:

```typescript
const blocking = await this.prisma.chartValidationWarning.findMany({
  where: { chart: { songId: id }, severity: 'ERROR' },
  include: { chart: { select: { name: true } } },
})
if (blocking.length) {
  throw new UnprocessableEntityException({ blockingWarnings: blocking })
}
```

- [ ] **Step 4: Write publish gate test**

- [ ] **Step 5: Run tests + commit**

```bash
git commit -m "feat(api): remove manual difficulty, add publish validation gate"
```

---

## Task 8: Web — chart hooks + notes API migration

**Files:**
- Create: `apps/web/src/features/charts/useCharts.ts`
- Create: `apps/web/src/features/charts/useChartAnalysis.ts`
- Create: `apps/web/src/features/charts/chart-summary.ts`
- Modify: `apps/web/src/features/notes/useNotes.ts`
- Modify: `apps/web/src/store/editor.store.ts`

- [ ] **Step 1: editor.store — activeChartId**

```typescript
activeChartId: string | null
setActiveChartId: (id: string | null) => void
```

- [ ] **Step 2: useCharts hook**

```typescript
export function useCharts(songId: string) {
  return useQuery({
    queryKey: ['charts', songId],
    queryFn: () => apiClient(token)<SongChart[]>(`/songs/${songId}/charts`),
    enabled: !!token && !!songId,
  })
}
```

- [ ] **Step 3: useNotes — take chartId instead of songId**

```typescript
export function useNotes(chartId: string, timeFrom?: number, timeTo?: number) {
  // GET /charts/${chartId}/notes
}
```

Update all call sites: `EditorPage`, `PianoRoll`, `Toolbar`, `NotePopup` paths.

- [ ] **Step 4: useChartAnalysis**

Fetches `GET /charts/:chartId/analysis`; `useMutation` for `POST analyze`.

- [ ] **Step 5: EditorPage — load charts, set default activeChartId**

On song load: if no `activeChartId`, set to first chart from `useCharts`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(web): chart hooks and chartId-scoped notes API"
```

---

## Task 9: ChartSwitcher + ChartSettingsModal

**Files:**
- Create: `apps/web/src/features/charts/ChartSwitcher.tsx`
- Create: `apps/web/src/features/charts/ChartSettingsModal.tsx`
- Create: `apps/web/src/features/charts/useDuplicateChart.ts`
- Modify: `apps/web/src/features/editor/components/SongSwitcher.tsx` or `Toolbar.tsx`

- [ ] **Step 1: ChartSwitcher dropdown**

Lists charts by name + computed tier badge. On select → `setActiveChartId`. Actions: New chart, Duplicate, Settings.

- [ ] **Step 2: ChartSettingsModal**

Fields: name (text), speed multiplier (range 0.8–2.0 step 0.1). PATCH `/charts/:id`.

- [ ] **Step 3: Mount in Toolbar next to song name**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): chart switcher and settings modal"
```

---

## Task 10: Editor live panel + heatmap upgrade

**Files:**
- Create: `apps/web/src/hooks/useDebouncedValue.ts`
- Create: `apps/web/src/features/editor/components/AnalysisSummaryPanel.tsx`
- Modify: `apps/web/src/features/editor/engine/difficulty-calculator.ts`
- Modify: `apps/web/src/features/editor/components/DifficultyOverlay.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Re-export shared from difficulty-calculator.ts**

```typescript
export {
  analyzeChart, maxCombo, computeNpsOverTime, segmentScoreToColor,
} from '@ama-midi/shared'
// DifficultyOverlay imports segmentScoreToColor (was npsToColor)
```

- [ ] **Step 2: useDebouncedValue hook (300ms)**

- [ ] **Step 3: AnalysisSummaryPanel**

Props: `notes`, `bpm`, `timeSignature`, `speedMultiplier`, `chartId`, `projectId`, `songId`.

Uses debounced `analyzeChart()`. Renders tier badge, avg/peak score, `SectionTimeline` mini strip, top 3 warnings, link to Analysis Board.

- [ ] **Step 4: DifficultyOverlay — use segment scores**

```typescript
const analysis = useMemo(() => analyzeChart({ notes, bpm, timeSignature, speedMultiplier }), [notes, ...])
// map analysis.segments to colored rects using segmentScoreToColor(seg.difficultyScore)
```

- [ ] **Step 5: Replace BottomBarStats with AnalysisSummaryPanel in EditorPage tools tab**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(web): live analysis panel and segment-score heatmap"
```

---

## Task 11: Analysis Board page

**Files:**
- Create: `apps/web/src/features/analysis/AnalysisBoardPage.tsx`
- Create: `apps/web/src/features/analysis/SectionTimeline.tsx`
- Create: `apps/web/src/features/analysis/FactorBreakdown.tsx`
- Create: `apps/web/src/features/analysis/WarningsTable.tsx`
- Create: `apps/web/src/features/analysis/SiblingCharts.tsx`
- Create: `apps/web/src/features/analysis/StatCards.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add route**

```typescript
<Route
  path="/projects/:projectId/songs/:songId/charts/:chartId/analysis"
  element={<RequireAuth><AnalysisBoardPage /></RequireAuth>}
/>
```

- [ ] **Step 2: AnalysisBoardPage layout per spec Section 6**

Load chart, song, analysis via hooks. Header with back link to editor (`/projects/:projectId/songs/:songId?chart=:chartId`).

- [ ] **Step 3: SectionTimeline — full width clickable bands**

Click → `navigate` to editor with `?t=` seek param (EditorPage reads `t` query to set playhead).

- [ ] **Step 4: FactorBreakdown — 8 horizontal bars with tier limit markers**

- [ ] **Step 5: WarningsTable — filter tabs All/Error/Warn/Info**

Red banner when any ERROR: *"This chart blocks publish approval."*

- [ ] **Step 6: SiblingCharts — cards for other charts on same song**

- [ ] **Step 7: Re-analyze button → POST /charts/:id/analyze**

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(web): Analysis Board page for level designers"
```

---

## Task 12: Cross-cutting UI cleanup

**Files:**
- Modify: `apps/web/src/features/songs/create-wizard/steps/ReviewStep.tsx`
- Modify: `apps/web/src/features/songs/create-wizard/steps/StartStep.tsx`
- Modify: `apps/web/src/features/songs/SongTable.tsx`
- Modify: `apps/web/src/features/editor/components/AiGenerateChartModal.tsx`
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `packages/shared/src/song-templates.ts`
- Test: `apps/web/tests/create-song-wizard.test.ts`

- [ ] **Step 1: Remove difficulty from create wizard UI and orchestrator state**

Replace copy with: *"Difficulty is computed automatically from your chart after you add notes."*

- [ ] **Step 2: SongTable — show chartSummary column instead of difficulty**

- [ ] **Step 3: AiGenerateChartModal — optional target tier select (not persisted)**

Pass `targetTier` to AI endpoint; remove `song.difficulty` from prompt context.

- [ ] **Step 4: Update create-song-wizard.test.ts — remove difficulty assertions**

- [ ] **Step 5: Run web tests**

```bash
node --import tsx --test apps/web/tests/create-song-wizard.test.ts apps/web/tests/difficulty-analysis.test.ts apps/web/tests/difficulty-validation.test.ts
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: remove manual difficulty from wizard, table, and AI"
```

---

## Task 13: Final verification

- [ ] **Step 1: Build all packages**

```bash
pnpm build
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

- [ ] **Step 3: Manual QA checklist**

- [ ] New song → one "Main" chart in switcher
- [ ] Add notes → editor panel tier updates within ~300ms
- [ ] Heatmap colors match segment difficulty
- [ ] Analysis Board shows segments, factors, warnings
- [ ] Duplicate chart → independent notes + analysis
- [ ] Create ERROR warning (triple on EASY) → publish blocked with 422
- [ ] No "difficulty" picker anywhere in create flow

- [ ] **Step 4: Final commit if fixups needed**

```bash
git commit -m "feat: difficulty analysis and assessment complete"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| SongChart owns notes | Task 4, 6 |
| Remove Song.difficulty | Task 4, 7, 12 |
| 8-factor analyzeChart | Task 2 |
| 5s segments persisted | Task 5 |
| Validation warnings | Task 3 |
| Tier-aware thresholds | Task 3 |
| Publish soft gate | Task 7 |
| Charts API | Task 5 |
| Editor live panel | Task 10 |
| Analysis Board page | Task 11 |
| Chart switcher | Task 9 |
| Heatmap segment scores | Task 10 |
| AI target tier hint | Task 12 |
| Default Main chart | Task 5, 7 |
| Unit tests | Task 2, 3 |
| API integration tests | Task 6, 7 |

---

## Out of Scope (do not implement in this plan)

- Auto-balancing / AI rewrite of sections
- Export PDF
- Realtime `chart.analyzed` WebSocket
- Historical analysis diffs
