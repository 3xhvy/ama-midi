import { describe, expect, it } from 'vitest'
import { ensureUniqueChartName, nextAiChartName, suggestAiChartName } from './ai-chart-name'

describe('nextAiChartName', () => {
  it('returns AI Chart when none exist', () => {
    expect(nextAiChartName([])).toBe('AI Chart')
  })

  it('increments when AI Chart already exists', () => {
    expect(nextAiChartName([
      { id: '1', songId: 's', name: 'AI Chart', speedMultiplier: 1, computedDifficulty: 'NORMAL', noteCount: 0, averageDifficultyScore: 0, peakDifficultyScore: 0, createdAt: '', updatedAt: '' },
    ])).toBe('AI Chart 2')
  })
})

describe('suggestAiChartName', () => {
  it('prefers the first section label', () => {
    expect(suggestAiChartName(
      [{ time: 0, label: 'Chorus' }],
      'upbeat edm drop',
      [],
    )).toBe('Chorus')
  })

  it('falls back to the brief when there are no sections', () => {
    expect(suggestAiChartName(
      [],
      'Sparse chiptune intro with dense chorus',
      [],
    )).toBe('Sparse chiptune intro with dense chorus')
  })

  it('dedupes against existing chart names', () => {
    expect(suggestAiChartName(
      [{ time: 0, label: 'Chorus' }],
      'brief',
      [{ id: '1', songId: 's', name: 'Chorus', speedMultiplier: 1, computedDifficulty: 'NORMAL', noteCount: 0, averageDifficultyScore: 0, peakDifficultyScore: 0, createdAt: '', updatedAt: '' }],
    )).toBe('Chorus 2')
  })
})

describe('ensureUniqueChartName', () => {
  it('returns the base name when unused', () => {
    expect(ensureUniqueChartName('Hard remix', [])).toBe('Hard remix')
  })
})
