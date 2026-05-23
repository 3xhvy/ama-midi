import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getSelectionRect, selectNotesInBox } from '../src/features/editor/engine/selection-box.ts'
import type { Note } from '@ama-midi/shared'

function note(id: string, track: number, time: number): Note {
  return {
    id,
    songId: 'song-1',
    track,
    time,
    title: id,
    description: '',
    createdBy: 'user-1',
    creatorName: 'Composer',
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
    noteType: 'TAP',
  }
}

test('getSelectionRect normalizes reverse drag coordinates', () => {
  assert.deepEqual(
    getSelectionRect({ x: 300, y: 220 }, { x: 100, y: 80 }),
    { left: 100, top: 80, width: 200, height: 140 },
  )
})

test('selectNotesInBox returns note ids whose centers are inside the rectangle', () => {
  const selected = selectNotesInBox({
    notes: [
      note('inside-a', 2, 2),
      note('inside-b', 3, 3),
      note('too-early', 2, 0.5),
      note('too-far-right', 6, 2),
    ],
    rect: { left: 100, top: 50, width: 210, height: 80 },
    gridWidth: 800,
    pxPerSecond: 30,
  })

  assert.deepEqual(selected, ['inside-a', 'inside-b'])
})
