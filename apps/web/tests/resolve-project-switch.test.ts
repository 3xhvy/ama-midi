import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveProjectSwitchTarget } from '../src/features/navigation/resolve-project-switch.ts'

test('recent song wins when switching projects in editor', () => {
  assert.equal(
    resolveProjectSwitchTarget({ projectId: 'p1', recentSongId: 's9', songCount: 3 }),
    '/projects/p1/songs/s9',
  )
})

test('empty project still lands on project workspace', () => {
  assert.equal(
    resolveProjectSwitchTarget({ projectId: 'p1', recentSongId: null, songCount: 0 }),
    '/projects/p1',
  )
})

test('project with songs but no recent opens project page', () => {
  assert.equal(
    resolveProjectSwitchTarget({ projectId: 'p1', recentSongId: null, songCount: 4 }),
    '/projects/p1',
  )
})
