import assert from 'node:assert/strict'
import { test } from 'node:test'
import { songEditorPath, projectPath } from '../src/features/navigation/song-editor-path.ts'

test('songEditorPath builds canonical project-scoped editor URL', () => {
  assert.equal(songEditorPath('p1', 's1'), '/projects/p1/songs/s1')
})

test('projectPath builds project workspace URL', () => {
  assert.equal(projectPath('p1'), '/projects/p1')
})
