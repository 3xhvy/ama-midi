import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  HOLD_DURATION_MAX,
  HOLD_DURATION_MIN,
  clampHoldDuration,
  getHoldEndDraft,
  parseHoldEndAtDraft,
  parseHoldDurationDraft,
  sanitizeHoldDurationDraft,
  stepHoldEndAtDraft,
  stepHoldDurationDraft,
} from '../src/features/editor/components/hold-duration-input.ts'

test('hold duration draft can be cleared without becoming zero', () => {
  assert.equal(sanitizeHoldDurationDraft(''), '')
  assert.equal(parseHoldDurationDraft(''), null)
})

test('hold duration draft accepts decimals without preserving a leading zero', () => {
  assert.equal(sanitizeHoldDurationDraft('5'), '5')
  assert.equal(sanitizeHoldDurationDraft('05.5'), '5.5')
  assert.equal(sanitizeHoldDurationDraft('0.5'), '0.5')
  assert.equal(sanitizeHoldDurationDraft('.5'), '0.5')
  assert.equal(sanitizeHoldDurationDraft('0'), '')
})

test('hold duration is parsed as a bounded float', () => {
  assert.equal(parseHoldDurationDraft('8.5'), 8.5)
  assert.equal(parseHoldDurationDraft('0.5'), 0.5)
  assert.equal(clampHoldDuration(-1), HOLD_DURATION_MIN)
  assert.equal(clampHoldDuration(1.26), 1.3)
  assert.equal(clampHoldDuration(99), HOLD_DURATION_MAX)
})

test('hold duration stepper moves in tenths and starts empty drafts at the minimum', () => {
  assert.equal(stepHoldDurationDraft('', 1), '0.1')
  assert.equal(stepHoldDurationDraft('', -1), '0.1')
  assert.equal(stepHoldDurationDraft('0.1', -1), '0.1')
  assert.equal(stepHoldDurationDraft('1.1', 1), '1.2')
})

test('hold end draft initializes from start plus duration', () => {
  assert.equal(getHoldEndDraft(12.3, 0.5), '12.8')
  assert.equal(getHoldEndDraft(12.3, undefined), '12.4')
})

test('hold end draft parses to a duration relative to start', () => {
  assert.deepEqual(parseHoldEndAtDraft(12.3, '12.8'), { endAt: 12.8, duration: 0.5 })
  assert.equal(parseHoldEndAtDraft(12.3, '12.3'), null)
  assert.equal(parseHoldEndAtDraft(12.3, '42.4'), null)
  assert.equal(parseHoldEndAtDraft(12.3, ''), null)
})

test('hold end stepper moves the end time in tenths', () => {
  assert.equal(stepHoldEndAtDraft(12.3, '', 1), '12.4')
  assert.equal(stepHoldEndAtDraft(12.3, '12.4', -1), '12.4')
  assert.equal(stepHoldEndAtDraft(12.3, '12.8', 1), '12.9')
})
