import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canTransitionSongStatus,
  getAllowedStatusTransitions,
  resolveSongWorkflowRole,
} from '../../../packages/shared/src/song-status-workflow.ts'

test('composer can submit draft for review', () => {
  const role = resolveSongWorkflowRole({
    userId: 'c1',
    isPlatformAdmin: false,
    projectPermission: 'EDIT',
    assignedComposerId: 'c1',
    assignedQaId: 'q1',
    createdBy: 'c1',
  })
  assert.equal(role, 'composer')
  assert.ok(canTransitionSongStatus('DRAFT', 'IN_REVIEW', role))
  assert.equal(getAllowedStatusTransitions('DRAFT', role).join(','), 'IN_REVIEW')
})

test('qa can approve or request fixes from in review', () => {
  const role = resolveSongWorkflowRole({
    userId: 'q1',
    isPlatformAdmin: false,
    projectPermission: 'READ',
    assignedComposerId: 'c1',
    assignedQaId: 'q1',
    createdBy: 'c1',
  })
  assert.equal(role, 'qa')
  assert.deepEqual(getAllowedStatusTransitions('IN_REVIEW', role).sort(), ['APPROVED', 'NEEDS_FIX'])
})

test('project admin can publish approved songs', () => {
  const role = resolveSongWorkflowRole({
    userId: 'a1',
    isPlatformAdmin: false,
    projectPermission: 'ADMIN',
    assignedComposerId: null,
    assignedQaId: null,
    createdBy: 'c1',
  })
  assert.ok(canTransitionSongStatus('APPROVED', 'PUBLISHED', role))
})

test('composer cannot approve their own review', () => {
  const role = resolveSongWorkflowRole({
    userId: 'c1',
    isPlatformAdmin: false,
    projectPermission: 'EDIT',
    assignedComposerId: 'c1',
    assignedQaId: 'q1',
    createdBy: 'c1',
  })
  assert.equal(canTransitionSongStatus('IN_REVIEW', 'APPROVED', role), false)
})
