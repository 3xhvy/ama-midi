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

  it('SPEED_TIER_MISMATCH when speed differs from suggestion', () => {
    const analysis = analyzeChart({ notes: [], bpm: 120, timeSignature: '4/4', speedMultiplier: 1.0 })
    const warnings = validateChartWithNotes(analysis, 'EXPERT', 1.0, [])
    assert.ok(warnings.some(w => w.code === 'SPEED_TIER_MISMATCH'))
  })
})
