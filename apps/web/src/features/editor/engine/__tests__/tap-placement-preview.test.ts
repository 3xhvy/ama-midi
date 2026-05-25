import { describe, it, expect } from 'vitest'
import { buildTapPlacementPreview } from '../tap-placement-preview'
import type { Note } from '@ama-midi/shared'

function makeNote(track: number, time: number, id = `n-${track}-${time}`): Note {
  return {
    id,
    songId: 'song1',
    chartId: 'chart1',
    track,
    time,
    title: '',
    description: '',
    createdBy: 'user1',
    creatorName: 'User',
    noteType: 'TAP',
    createdAt: '',
    updatedAt: '',
  } as Note
}

describe('buildTapPlacementPreview', () => {
  it('returns all creatables when no existing notes conflict', () => {
    const draft = [
      { track: 1, time: 1.0 },
      { track: 2, time: 2.0 },
    ]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: [],
      offset: 0,
    })
    expect(preview.creatable).toHaveLength(2)
    expect(preview.conflicts).toHaveLength(0)
    expect(preview.summary.creatableNotes).toBe(2)
    expect(preview.summary.conflictCount).toBe(0)
  })

  it('moves conflict to conflicts array when time+offset collides with existing note', () => {
    const draft = [{ track: 1, time: 1.0 }]
    const existing = [makeNote(1, 1.0)]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: existing,
      offset: 0,
    })
    expect(preview.creatable).toHaveLength(0)
    expect(preview.conflicts).toHaveLength(1)
    expect(preview.conflicts[0].track).toBe(1)
    expect(preview.conflicts[0].time).toBe(1.0)
    expect(preview.summary.conflictCount).toBe(1)
  })

  it('applies offset to all draft note times before collision check', () => {
    const draft = [{ track: 1, time: 0.0 }]
    const existing = [makeNote(1, 2.0)]
    // offset 2.0 → draft note becomes time 2.0 → conflicts
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: existing,
      offset: 2.0,
    })
    expect(preview.conflicts).toHaveLength(1)
    expect(preview.conflicts[0].time).toBe(2.0)
  })

  it('hold note duration is preserved in creatable slot', () => {
    const draft = [{ track: 3, time: 1.0, duration: 0.5 }]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: [],
      offset: 0,
    })
    expect(preview.creatable[0].duration).toBe(0.5)
    expect(preview.creatable[0].noteType).toBe('HOLD')
  })

  it('tap note (no duration) gets noteType TAP', () => {
    const draft = [{ track: 1, time: 1.0 }]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: [],
      offset: 0,
    })
    expect(preview.creatable[0].noteType).toBe('TAP')
  })

  it('dedupes two draft notes that land on the same track+time slot', () => {
    const draft = [
      { track: 1, time: 1.0 },
      { track: 1, time: 1.0 },
    ]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: [],
      offset: 0,
    })
    expect(preview.creatable).toHaveLength(1)
    expect(preview.summary.totalNotes).toBe(2)
    expect(preview.summary.creatableNotes).toBe(1)
  })

  it('conflicts when tap lands inside an existing hold span', () => {
    const draft = [{ track: 1, time: 2.0 }]
    const existing = [{
      ...makeNote(1, 0),
      noteType: 'HOLD' as const,
      duration: 5,
    }]
    const preview = buildTapPlacementPreview({
      songId: 'song1',
      draftNotes: draft,
      existingNotes: existing,
      offset: 0,
    })
    expect(preview.creatable).toHaveLength(0)
    expect(preview.conflicts).toHaveLength(1)
    expect(preview.conflicts[0].time).toBe(2.0)
    expect(preview.conflicts[0].existingNote.id).toBe(existing[0].id)
  })
})
