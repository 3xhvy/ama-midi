import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MAX_REPEAT_GENERATED_NOTES,
  formatRepeatInterval,
  getRepeatDefaults,
  getSelectionLengthInterval,
  parseRepeatCountDraft,
  parseRepeatIntervalDraft,
  sanitizeRepeatCountDraft,
  sanitizeRepeatIntervalDraft,
  validateRepeatRequest,
} from '../src/features/editor/components/repeat-transform.ts'

const notes = [
  { id: 'a', songId: 'song', chartId: 'chart', track: 1, time: 1.0, title: 'A', description: '', createdBy: 'u', creatorName: 'User', createdAt: '', updatedAt: '', noteType: 'TAP' as const },
  { id: 'b', songId: 'song', chartId: 'chart', track: 2, time: 2.5, title: 'B', description: '', createdBy: 'u', creatorName: 'User', createdAt: '', updatedAt: '', noteType: 'TAP' as const },
]

test('repeat defaults use three copies and one measure interval', () => {
  assert.deepEqual(getRepeatDefaults(notes, 120, '4/4'), {
    repeatCountDraft: '3',
    repeatIntervalDraft: '2.0',
  })
})

test('selection length interval is based on selected note span', () => {
  assert.equal(getSelectionLengthInterval(notes), 1.5)
  assert.equal(formatRepeatInterval(getSelectionLengthInterval(notes)), '1.5')
})

test('repeat drafts sanitize and parse numeric input', () => {
  assert.equal(sanitizeRepeatCountDraft('03abc'), '3')
  assert.equal(parseRepeatCountDraft('3'), 3)
  assert.equal(parseRepeatCountDraft('0'), null)
  assert.equal(sanitizeRepeatIntervalDraft('04.25s'), '4.25')
  assert.equal(parseRepeatIntervalDraft('4.25'), 4.3)
  assert.equal(parseRepeatIntervalDraft('0'), null)
})

test('repeat validation blocks generated notes over cap', () => {
  assert.equal(MAX_REPEAT_GENERATED_NOTES, 500)
  assert.equal(validateRepeatRequest(notes, 251, 0.1), 'Repeat would create 502 notes; limit is 500')
})

test('repeat validation accepts a bounded request', () => {
  assert.equal(validateRepeatRequest(notes, 3, 4.0), null)
})
