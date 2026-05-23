import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeTrackDensity, trackBarWidth } from '../src/features/editor/utils/track-density.ts'
import type { Note } from '@ama-midi/shared'

function note(track: number): Note {
  return {
    id: `n-${track}`,
    songId: 's1',
    track,
    time: 0,
    title: '',
    createdBy: 'u1',
    createdAt: '',
    updatedAt: '',
    noteType: 'TAP',
  }
}

describe('computeTrackDensity', () => {
  it('normalises against the busiest track across the full song', () => {
    const density = computeTrackDensity([
      note(1), note(1), note(1),
      note(2),
    ])
    assert.equal(density[1], 1)
    assert.ok(Math.abs(density[2] - 1 / 3) < 1e-9)
    assert.equal(density[3], 0)
  })

  it('returns zero density for empty tracks when song has notes', () => {
    const density = computeTrackDensity([note(4)])
    assert.equal(density[4], 1)
    assert.equal(density[1], 0)
  })
})

describe('trackBarWidth', () => {
  it('enforces a 6% minimum width', () => {
    assert.equal(trackBarWidth(0), 0.06)
    assert.equal(trackBarWidth(0.02), 0.06)
    assert.equal(trackBarWidth(0.5), 0.5)
  })
})
