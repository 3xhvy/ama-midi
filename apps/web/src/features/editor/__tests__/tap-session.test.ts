import { describe, it, expect } from 'vitest'
import { createDefaultLoopRange, draftTapNotesToPatternNotes } from '../tap-session'

describe('createDefaultLoopRange', () => {
  it('creates an 8s window from the snapped playhead', () => {
    const range = createDefaultLoopRange(1.0, 'off', 120)
    expect(range.start).toBe(1.0)
    expect(range.end).toBe(9.0)
  })

  it('clamps end to TIME_MAX when near song end', () => {
    const range = createDefaultLoopRange(298.0, 'off', 120)
    expect(range.end).toBe(300)
    expect(range.start).toBeLessThan(range.end)
  })
})

describe('draftTapNotesToPatternNotes', () => {
  it('normalizes tap draft times to offsets from the earliest note', () => {
    const pattern = draftTapNotesToPatternNotes([
      { track: 1, time: 2.0 },
      { track: 3, time: 2.5, duration: 0.4 },
    ])
    expect(pattern).toHaveLength(2)
    expect(pattern[0]).toEqual({ track: 1, timeOffset: 0, noteType: 'TAP', duration: undefined })
    expect(pattern[1]).toEqual({ track: 3, timeOffset: 0.5, noteType: 'HOLD', duration: 0.4 })
  })
})
