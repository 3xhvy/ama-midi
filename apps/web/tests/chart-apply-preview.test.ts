import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ChartApplyPreview } from '@ama-midi/shared'
import { chartApplyPreviewToPlacement } from '../src/features/editor/components/placement-preview.ts'

const preview: ChartApplyPreview = {
  songId: 'song-1',
  chartId: 'chart-1',
  previewVersion: 'v1',
  replaceExisting: false,
  summary: {
    totalNotes: 3,
    creatableNotes: 2,
    conflictCount: 1,
    affectedExistingNotes: 1,
  },
  creatable: [
    {
      sourceIndex: 0,
      sourceNoteId: '0',
      track: 1,
      time: 10,
      noteType: 'tap',
      duration: 0.1,
      title: '',
      description: '',
    },
  ],
  conflicts: [
    {
      conflictId: 'c1',
      sourceIndex: 1,
      sourceNoteId: '1',
      track: 2,
      time: 20,
      incomingNote: {
        title: '',
        description: '',
        track: 2,
        timeOffset: 0,
        noteType: 'tap',
        duration: 0.1,
      },
      existingNote: {
        id: 'note-1',
        track: 2,
        time: 20,
        noteType: 'tap',
        duration: 0.1,
        title: '',
        description: '',
        createdBy: { id: 'u1', name: 'User', avatarUrl: null },
      },
    },
  ],
}

test('chartApplyPreviewToPlacement maps preview fields to placement preview', () => {
  const placement = chartApplyPreviewToPlacement(preview)

  assert.equal(placement.songId, 'song-1')
  assert.equal(placement.version, 'v1')
  assert.deepEqual(placement.summary, preview.summary)
  assert.deepEqual(placement.creatable, preview.creatable)
  assert.deepEqual(placement.conflicts, preview.conflicts)
})
