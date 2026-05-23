import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeChart } from '../../../packages/shared/src/difficulty/analyze-chart.ts'
import { scoreToDifficulty } from '../../../packages/shared/src/difficulty/tier-thresholds.ts'
import type { AnalyzeNote } from '../../../packages/shared/src/difficulty/types.ts'

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

  it('returns 60 five-second segments for 300s song', () => {
    const r = analyzeChart({ notes: [], bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    assert.equal(r.segments.length, 60)
  })
})
