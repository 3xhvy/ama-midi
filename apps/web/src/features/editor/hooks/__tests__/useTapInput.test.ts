import { describe, it, expect } from 'vitest'

// Extract pure threshold logic for testing
function resolveDraftNote(startTime: number, endTime: number, track: number) {
  const duration = endTime - startTime
  const TAP_THRESHOLD_S = 0.15
  if (duration < TAP_THRESHOLD_S) {
    return { track, time: startTime, duration: undefined }
  }
  return { track, time: startTime, duration: Math.round(duration * 100) / 100 }
}

describe('resolveDraftNote', () => {
  it('short press (< 0.15s) produces tap note with no duration', () => {
    const note = resolveDraftNote(1.0, 1.1, 2)
    expect(note.duration).toBeUndefined()
    expect(note.time).toBe(1.0)
    expect(note.track).toBe(2)
  })

  it('long press (>= 0.15s) produces hold note with duration', () => {
    const note = resolveDraftNote(1.0, 1.5, 3)
    expect(note.duration).toBe(0.5)
  })

  it('exactly 0.15s is treated as hold', () => {
    const note = resolveDraftNote(0.0, 0.15, 1)
    expect(note.duration).toBe(0.15)
  })

  it('duration is rounded to 2 decimal places', () => {
    const note = resolveDraftNote(0.0, 0.333, 1)
    expect(note.duration).toBe(0.33)
  })
})
