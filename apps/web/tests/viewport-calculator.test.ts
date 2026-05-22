import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPrefetchTimeRange } from '../src/features/editor/engine/viewport-calculator.ts'

test('prefetch range stays stable across small scroll movements', () => {
  const initial = getPrefetchTimeRange(120, 600, 3)
  const afterSmallScroll = getPrefetchTimeRange(121, 600, 3)

  assert.deepEqual(afterSmallScroll, initial)
})

test('prefetch range advances in bounded chunks for larger scroll movements', () => {
  const initial = getPrefetchTimeRange(120, 600, 3)
  const afterLargeScroll = getPrefetchTimeRange(180, 600, 3)

  assert.equal(afterLargeScroll.timeFrom - initial.timeFrom, 20)
  assert.equal(afterLargeScroll.timeTo - initial.timeTo, 20)
})
