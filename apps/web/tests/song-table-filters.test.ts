import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterProjectSongs } from '../src/features/songs/song-table-filters.ts'
import type { Song } from '@ama-midi/shared'

const songs = [
  { id: '1', name: 'Alpha', status: 'DRAFT', projectId: 'p1' },
  { id: '2', name: 'Beta', status: 'APPROVED', projectId: 'p1' },
] as Song[]

test('filterProjectSongs matches name query case-insensitively', () => {
  const result = filterProjectSongs(songs, { query: 'alpha', status: 'ALL' })
  assert.equal(result.length, 1)
  assert.equal(result[0].id, '1')
})

test('filterProjectSongs filters by workflow status', () => {
  const result = filterProjectSongs(songs, { query: '', status: 'APPROVED' })
  assert.equal(result.length, 1)
  assert.equal(result[0].id, '2')
})
