import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTrackLayout } from '../src/features/editor/engine/track-layout.ts'

test('track layout reserves the time axis outside the eight track columns', () => {
  const layout = getTrackLayout({ editorWidth: 840, timeAxisWidth: 40 })

  assert.equal(layout.trackAreaWidth, 800)
  assert.equal(layout.trackWidth, 100)
  assert.equal(layout.trackLeft(1), 40)
  assert.equal(layout.trackLeft(8), 740)
  assert.equal(layout.trackRight(8), 840)
})

test('track width is independent of vertical zoom', () => {
  const oneX = getTrackLayout({ editorWidth: 840, timeAxisWidth: 40, zoom: 1 })
  const eightX = getTrackLayout({ editorWidth: 840, timeAxisWidth: 40, zoom: 8 })

  assert.equal(eightX.trackWidth, oneX.trackWidth)
  assert.equal(eightX.trackAreaWidth, oneX.trackAreaWidth)
})
