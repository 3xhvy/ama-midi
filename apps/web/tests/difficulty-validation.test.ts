import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { analyzeChart } from '../../../packages/shared/src/difficulty/analyze-chart.ts'
import { validateChartWithNotes } from '../../../packages/shared/src/difficulty/validate-chart.ts'

describe('validateChartWithNotes', () => {
  it('EASY chart with triple simultaneous → TOO_MANY_TRIPLES ERROR', () => {
    const notes = [
      { track: 1, time: 1, noteType: 'TAP' as const },
      { track: 2, time: 1, noteType: 'TAP' as const },
      { track: 3, time: 1, noteType: 'TAP' as const },
    ]
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChartWithNotes(analysis, 'EASY', 1.0, notes)
    assert.ok(warnings.some(w => w.code === 'TOO_MANY_TRIPLES' && w.severity === 'ERROR'))
  })

  it('HARD chart warns when more than 2 triple groups per minute', () => {
    const notes = [
      { track: 1, time: 0, noteType: 'TAP' as const },
      { track: 2, time: 0, noteType: 'TAP' as const },
      { track: 3, time: 0, noteType: 'TAP' as const },
      { track: 1, time: 10, noteType: 'TAP' as const },
      { track: 2, time: 10, noteType: 'TAP' as const },
      { track: 3, time: 10, noteType: 'TAP' as const },
      { track: 1, time: 20, noteType: 'TAP' as const },
      { track: 2, time: 20, noteType: 'TAP' as const },
      { track: 3, time: 20, noteType: 'TAP' as const },
    ]
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChartWithNotes(analysis, 'HARD', 1.5, notes)
    assert.ok(warnings.some(w => w.code === 'TOO_MANY_TRIPLES' && w.severity === 'WARN'))
  })

  it('detects DIFFICULTY_SPIKE when segment >> average', () => {
    const sparse = Array.from({ length: 5 }, (_, i) => ({
      track: 1, time: i * 30, noteType: 'TAP' as const,
    }))
    const burst = Array.from({ length: 50 }, (_, i) => ({
      track: (i % 8) + 1, time: 100 + i * 0.05, noteType: 'TAP' as const,
    }))
    const notes = [...sparse, ...burst]
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChartWithNotes(analysis, analysis.computedDifficulty, 1.0, notes)
    assert.ok(
      warnings.some(w => w.code === 'DIFFICULTY_SPIKE' || w.code === 'HIGH_DENSITY'),
      `expected spike or density warning, got: ${warnings.map(w => w.code).join(', ')}`,
    )
  })

  it('SPEED_TIER_MISMATCH suppressed for sparse charts', () => {
    const notes = Array.from({ length: 10 }, (_, i) => ({
      track: 1, time: i, noteType: 'TAP' as const,
    }))
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChartWithNotes(analysis, 'EXPERT', 1.0, notes)
    assert.ok(!warnings.some(w => w.code === 'SPEED_TIER_MISMATCH'))
  })

  it('EXCESSIVE_LANE_JUMP includes time reference', () => {
    const notes = [
      { track: 1, time: 0, noteType: 'TAP' as const },
      { track: 8, time: 1, noteType: 'TAP' as const },
      { track: 1, time: 2, noteType: 'TAP' as const },
      { track: 8, time: 3, noteType: 'TAP' as const },
    ]
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChartWithNotes(analysis, 'HARD', 1.0, notes)
    const jump = warnings.find(w => w.code === 'EXCESSIVE_LANE_JUMP')
    assert.ok(jump)
    assert.ok(jump!.startTimeMs !== undefined)
  })

  it('HOLD_OVERLAP_STRESS emitted for overlapping hold', () => {
    const notes = [
      { track: 1, time: 0, noteType: 'HOLD' as const, duration: 2 },
      { track: 2, time: 0.5, noteType: 'TAP' as const },
      { track: 3, time: 1, noteType: 'TAP' as const },
      { track: 4, time: 1.5, noteType: 'TAP' as const },
    ]
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChartWithNotes(analysis, 'NORMAL', 1.0, notes)
    assert.ok(warnings.some(w => w.code === 'HOLD_OVERLAP_STRESS'))
  })

  it('EMPTY_SECTION only fires within chart content span', () => {
    const notes = Array.from({ length: 25 }, (_, i) => ({
      track: (i % 4) + 1, time: i * 0.5, noteType: 'TAP' as const,
    }))
    const analysis = analyzeChart({ notes, bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChartWithNotes(analysis, 'NORMAL', 1.0, notes)
    const empty = warnings.filter(w => w.code === 'EMPTY_SECTION')
    assert.ok(empty.length < 10, `expected few empty-section warnings, got ${empty.length}`)
    assert.ok(empty.every(w => (w.startTimeMs ?? 0) < 20_000))
  })
})
