import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Project } from '@ama-midi/shared'
import { filterProjects, type ProjectDirectoryStatusFilter } from '../src/features/projects/project-directory-filters.ts'

const projects = [
  { id: 'p1', name: 'Neon Rush', description: 'Main campaign charts', status: 'ACTIVE', songCount: 12, memberCount: 4, updatedAt: '2026-05-23T08:00:00Z' },
  { id: 'p2', name: 'Event Pack', description: 'Seasonal work', status: 'PAUSED', songCount: 3, memberCount: 2, updatedAt: '2026-05-22T08:00:00Z' },
  { id: 'p3', name: 'Archive Test', description: null, status: 'ARCHIVED', songCount: 1, memberCount: 1, updatedAt: '2026-05-21T08:00:00Z' },
] as Project[]

test('filterProjects matches name and description case-insensitively', () => {
  assert.deepEqual(filterProjects(projects, { query: 'campaign', status: 'ALL' }).map((project) => project.id), ['p1'])
  assert.deepEqual(filterProjects(projects, { query: 'event', status: 'ALL' }).map((project) => project.id), ['p2'])
})

test('filterProjects filters by project status', () => {
  const status: ProjectDirectoryStatusFilter = 'PAUSED'
  assert.deepEqual(filterProjects(projects, { query: '', status }).map((project) => project.id), ['p2'])
})

test('filterProjects combines query and status filters', () => {
  assert.deepEqual(filterProjects(projects, { query: 'test', status: 'ACTIVE' }).map((project) => project.id), [])
})
