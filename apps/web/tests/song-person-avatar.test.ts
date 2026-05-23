import assert from 'node:assert/strict'
import test from 'node:test'
import type { Song } from '@ama-midi/shared'
import { resolveSongPersonAvatar } from '../src/features/songs/song-person-avatar.ts'

const baseSong = {
  id: 's1',
  projectId: 'p1',
  name: 'Song',
  category: 'PROTOTYPE',
  status: 'DRAFT',
  difficulty: 'NORMAL',
  createdBy: 'u1',
  creatorName: 'Hồ Hoàng Huy',
  creatorAvatarUrl: 'https://example.com/photo.jpg',
  assignedComposerId: 'u1',
  assignedComposerName: 'Hồ Hoàng Huy',
  assignedQaId: 'u1',
  assignedQaName: 'Hồ Hoàng Huy',
  sourceSongId: null,
  archivedAt: null,
  noteCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  bpm: 120,
  timeSignature: '4/4',
} satisfies Song

test('resolveSongPersonAvatar uses explicit composer avatar when present', () => {
  const song: Song = {
    ...baseSong,
    assignedComposerAvatarUrl: 'https://example.com/composer.jpg',
  }
  assert.equal(resolveSongPersonAvatar(song, 'composer'), 'https://example.com/composer.jpg')
})

test('resolveSongPersonAvatar falls back to creator avatar for same user', () => {
  const song: Song = { ...baseSong }
  assert.equal(resolveSongPersonAvatar(song, 'composer'), 'https://example.com/photo.jpg')
  assert.equal(resolveSongPersonAvatar(song, 'qa'), 'https://example.com/photo.jpg')
})

test('resolveSongPersonAvatar returns undefined for unassigned role', () => {
  const song: Song = {
    ...baseSong,
    assignedComposerId: null,
    assignedComposerName: null,
    assignedQaId: null,
    assignedQaName: null,
  }
  assert.equal(resolveSongPersonAvatar(song, 'composer'), undefined)
})
