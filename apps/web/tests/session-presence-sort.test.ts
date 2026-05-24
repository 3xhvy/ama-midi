import assert from 'node:assert/strict'
import test from 'node:test'
import { sortPresenceUsers } from '../src/features/collaboration/sort-presence-users.ts'

const users = [
  { id: 'b', name: 'Bob', title: 'Composer', department: 'Audio' },
  { id: 'a', name: 'Alice', title: 'QA', department: 'QA' },
  { id: 'c', name: 'Carol', title: null, department: null },
]

test('sortPresenceUsers puts current user first', () => {
  const sorted = sortPresenceUsers(users, 'b')
  assert.equal(sorted[0].id, 'b')
})

test('sortPresenceUsers sorts others alphabetically by name', () => {
  const sorted = sortPresenceUsers(users, 'b')
  assert.deepEqual(sorted.map((u) => u.id), ['b', 'a', 'c'])
})

test('sortPresenceUsers returns empty array unchanged', () => {
  assert.deepEqual(sortPresenceUsers([], 'x'), [])
})
