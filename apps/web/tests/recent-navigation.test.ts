import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  RECENT_PROJECTS_KEY,
  RECENT_SONGS_KEY,
  getRecentSongForProject,
  recordRecentProject,
  recordRecentSong,
} from '../src/features/navigation/recent-navigation.ts'

test('recordRecentSong stores latest song per project', () => {
  const storage = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v) },
  }

  recordRecentSong(localStorage, 'p1', 's1')
  recordRecentSong(localStorage, 'p1', 's2')

  assert.equal(getRecentSongForProject(localStorage, 'p1'), 's2')
  assert.equal(RECENT_SONGS_KEY, 'ama-midi:recent-songs:v1')
})

test('recordRecentProject keeps unique projects most-recent-first', () => {
  const storage = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v) },
  }

  recordRecentProject(localStorage, 'p1')
  recordRecentProject(localStorage, 'p2')
  recordRecentProject(localStorage, 'p1')

  const raw = localStorage.getItem(RECENT_PROJECTS_KEY)
  assert.match(raw ?? '', /"p1"/)
  assert.ok(raw?.indexOf('"p1"')! < raw?.indexOf('"p2"')!)
})
