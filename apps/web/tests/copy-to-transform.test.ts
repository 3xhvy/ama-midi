import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTimeDeltaDraft, validateTrackTarget } from '../src/features/editor/components/copy-to-transform.ts'

test('parseTimeDeltaDraft accepts signed decimal', () => {
  assert.equal(parseTimeDeltaDraft('+2.0'), 2.0)
  assert.equal(parseTimeDeltaDraft('-1.5'), -1.5)
})

test('validateTrackTarget rejects out of range for selection minTrack', () => {
  const err = validateTrackTarget(3, 1, 2) // minTrack=1, maxTrack=2 → max target 7
  assert.equal(err, null)
  const bad = validateTrackTarget(8, 1, 2) // would push note on track 2 to track 9
  assert.ok(bad)
})
