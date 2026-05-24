import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeChart } from '../../../packages/shared/src/difficulty/analyze-chart.ts'
import { surpriseScore } from '../../../packages/shared/src/difficulty/factors.ts'
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
    assert.equal(r.peakDifficultyScore, 0)
    assert.equal(r.warnings.length, 0)
  })

  it('empty chart with high speed does not inflate peak score', () => {
    const r = analyzeChart({ notes: [], bpm: 120, timeSignature: '4/4', speedMultiplier: 2.0 })
    assert.equal(r.peakDifficultyScore, 0)
  })

  it('straight 1-2-3-4 pattern has low lane jump', () => {
    const notes = [1, 2, 3, 4].map((t, i) => tap(t, i * 0.5))
    const r = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    assert.ok(r.factors.laneJumpScore < 0.3)
  })

  it('returns 60 five-second segments for 300s song', () => {
    const r = analyzeChart({ notes: [], bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    assert.equal(r.segments.length, 60)
  })
})

describe('surpriseScore', () => {
  it('repeating 8-note pattern has low surprise (high repetition)', () => {
    const pattern = [1, 2, 3, 4, 1, 2, 3, 4]
    const notes: AnalyzeNote[] = []
    for (let rep = 0; rep < 4; rep++) {
      pattern.forEach((track, i) => notes.push(tap(track, rep * 4 + i * 0.5)))
    }
    const surprise = surpriseScore(notes)
    assert.ok(surprise < 0.2, `expected low surprise for repeating pattern, got ${surprise}`)
  })

  it('changing pattern has higher surprise', () => {
    const notes: AnalyzeNote[] = []
    for (let i = 0; i < 32; i++) {
      const track = i < 16 ? (i % 4) + 1 : 8 - (i % 4)
      notes.push(tap(track, i * 0.5))
    }
    const surprise = surpriseScore(notes)
    assert.ok(surprise > 0.3, `expected higher surprise across pattern change, got ${surprise}`)
  })
})
