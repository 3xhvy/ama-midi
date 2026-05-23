import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTimeAxisStep, formatTimeAxisLabel, getVisibleTimeGridLines } from '../src/features/editor/engine/time-axis-labels.ts'

test('time axis uses denser steps as vertical zoom increases', () => {
  assert.equal(getTimeAxisStep(30), 1)
  assert.equal(getTimeAxisStep(60), 0.5)
  assert.equal(getTimeAxisStep(120), 0.25)
  assert.equal(getTimeAxisStep(240), 0.1)
})

test('time axis labels preserve useful fractional precision', () => {
  assert.equal(formatTimeAxisLabel(4), '4s')
  assert.equal(formatTimeAxisLabel(4.5), '4.5s')
  assert.equal(formatTimeAxisLabel(4.25), '4.25s')
})

test('time grid lines follow the same ordered subdivision as the axis', () => {
  const lines = getVisibleTimeGridLines(60, 0, 1.5)

  assert.deepEqual(lines.slice(0, 4).map((line) => ({ time: line.time, weight: line.weight })), [
    { time: 0,   weight: 'measure' },
    { time: 0.5, weight: 'subdivision' },
    { time: 1,   weight: 'measure' },
    { time: 1.5, weight: 'subdivision' },
  ])
})

test('time grid lines keep absolute positions after scrolling', () => {
  const lines = getVisibleTimeGridLines(60, 5, 6.5)

  assert.equal(lines[0].y, 300)
  assert.equal(lines[1].y, 330)
})
