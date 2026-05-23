import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatPatternPasteTime,
  parsePatternPasteTimeDraft,
  sanitizePatternPasteTimeDraft,
  stepPatternPasteTimeDraft,
} from '../src/features/editor/components/pattern-placement.ts'

test('pattern paste time is formatted in tenths', () => {
  assert.equal(formatPatternPasteTime(12), '12.0')
  assert.equal(formatPatternPasteTime(12.34), '12.3')
  assert.equal(formatPatternPasteTime(12.36), '12.4')
})

test('pattern paste time draft accepts only a positive decimal time', () => {
  assert.equal(sanitizePatternPasteTimeDraft('42.5s'), '42.5')
  assert.equal(sanitizePatternPasteTimeDraft('004.2'), '4.2')
  assert.equal(sanitizePatternPasteTimeDraft('.5'), '0.5')
  assert.equal(sanitizePatternPasteTimeDraft('0'), '0')
})

test('pattern paste time parses to the valid song range', () => {
  assert.equal(parsePatternPasteTimeDraft('42.54'), 42.5)
  assert.equal(parsePatternPasteTimeDraft('300.1'), 300)
  assert.equal(parsePatternPasteTimeDraft('-1'), 0)
  assert.equal(parsePatternPasteTimeDraft(''), null)
})

test('pattern paste time stepper moves in tenths within song bounds', () => {
  assert.equal(stepPatternPasteTimeDraft('', 1), '0.1')
  assert.equal(stepPatternPasteTimeDraft('0.0', -1), '0.0')
  assert.equal(stepPatternPasteTimeDraft('42.5', 1), '42.6')
  assert.equal(stepPatternPasteTimeDraft('300.0', 1), '300.0')
})
