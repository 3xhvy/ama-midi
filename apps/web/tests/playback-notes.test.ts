import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Note } from '@ama-midi/shared'
import { notesCrossedByPlayhead } from '../src/features/editor/audio/playback-notes.ts'

function note(time: number, track = 1): Note {
  return {
    id: String(time),
    songId: 's',
    chartId: 'c',
    track,
    time,
    title: '',
    description: '',
    createdBy: 'u',
    creatorName: 'U',
    createdAt: '',
    updatedAt: '',
    noteType: 'TAP',
  }
}

describe('notesCrossedByPlayhead', () => {
  it('returns notes strictly after prev and up to current', () => {
    const notes = [note(1), note(2), note(3)]
    const hit = notesCrossedByPlayhead(notes, 1, 2.5, new Set())
    assert.deepEqual(hit.map((n) => n.time), [2])
  })

  it('skips muted tracks', () => {
    const notes = [note(2, 2)]
    const hit = notesCrossedByPlayhead(notes, 0, 3, new Set([2]))
    assert.equal(hit.length, 0)
  })

  it('returns empty when playhead moves backwards', () => {
    const notes = [note(1.5)]
    const hit = notesCrossedByPlayhead(notes, 2, 1, new Set())
    assert.equal(hit.length, 0)
  })
})
