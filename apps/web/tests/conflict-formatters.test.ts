import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatTime,
  formatOffset,
} from '../src/features/editor/components/conflict-formatters.ts'

test('formatTime rounds to 1 decimal and appends s', () => {
  assert.equal(formatTime(20.1),             '20.1s')
  assert.equal(formatTime(20.09999999999),   '20.1s')
  assert.equal(formatTime(0),                '0.0s')
  assert.equal(formatTime(300),              '300.0s')
})

test('formatOffset includes sign and rounds to 1 decimal', () => {
  assert.equal(formatOffset(3.09999999999),  '+3.1s')
  assert.equal(formatOffset(0),              '+0.0s')
  assert.equal(formatOffset(-0.5),           '-0.5s')
  assert.equal(formatOffset(0.1 + 0.2),      '+0.3s')
})
