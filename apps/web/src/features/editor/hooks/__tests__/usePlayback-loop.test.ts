import { describe, it, expect } from 'vitest'

// Pure extract of the loop-branch logic so we can unit-test without RAF
function computeNextTime(
  current: number,
  delta: number,
  loopRange: { start: number; end: number } | null,
  timeMax: number,
): { time: number; stop: boolean } {
  const next = current + delta
  if (loopRange && next >= loopRange.end) {
    return { time: loopRange.start, stop: false }
  }
  if (next >= timeMax) {
    return { time: timeMax, stop: true }
  }
  return { time: Math.round(next * 100) / 100, stop: false }
}

describe('computeNextTime', () => {
  it('advances normally without loop range', () => {
    expect(computeNextTime(1.0, 0.05, null, 300)).toEqual({ time: 1.05, stop: false })
  })

  it('stops at TIME_MAX without loop range', () => {
    expect(computeNextTime(299.99, 0.1, null, 300)).toEqual({ time: 300, stop: true })
  })

  it('loops back to start when playhead reaches loopRange.end', () => {
    expect(computeNextTime(7.9, 0.15, { start: 4, end: 8 }, 300)).toEqual({ time: 4, stop: false })
  })

  it('does not loop when playhead is before loopRange.end', () => {
    expect(computeNextTime(7.0, 0.05, { start: 4, end: 8 }, 300)).toEqual({ time: 7.05, stop: false })
  })
})
