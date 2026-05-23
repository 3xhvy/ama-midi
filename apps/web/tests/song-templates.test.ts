import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  SONG_TEMPLATES,
  getSongTemplate,
} from '../../../packages/shared/src/song-templates.ts'

test('all six built-in templates resolve', () => {
  const ids = [
    'empty-draft',
    'tap-starter',
    'mixed-mechanics',
    'qa-validation',
    'sectioned-layout',
    'pattern-lab',
  ]
  assert.equal(SONG_TEMPLATES.length, 6)
  for (const id of ids) {
    assert.ok(getSongTemplate(id), `missing template ${id}`)
  }
})

test('HOLD notes in templates have duration > 0', () => {
  for (const tpl of SONG_TEMPLATES) {
    for (const note of tpl.notes ?? []) {
      if (note.noteType === 'HOLD') {
        assert.ok(note.duration && note.duration > 0, `${tpl.id} HOLD missing duration`)
      }
    }
  }
})

test('pattern notes use timeOffset not absolute time', () => {
  const patternLab = getSongTemplate('pattern-lab')
  assert.ok(patternLab?.patterns?.length)
  for (const pattern of patternLab!.patterns!) {
    for (const note of pattern.notes) {
      assert.ok('timeOffset' in note)
      assert.ok(!('time' in note))
    }
  }
})
