import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  NoteEventTypeEnum,
  NoteTypeEnum,
  ProjectPermissionEnum,
  ProjectStatusEnum,
  SongCategoryEnum,
  SongDifficultyEnum,
  SongScopeEnum,
  SongStatusEnum,
  UserRoleEnum,
} from '../../../packages/shared/src/enums.ts'

test('shared enums expose stable key order', () => {
  assert.deepEqual(UserRoleEnum.keys, ['ADMIN', 'COMPOSER', 'VIEWER'])
  assert.deepEqual(NoteEventTypeEnum.keys, ['NOTE_CREATED', 'NOTE_UPDATED', 'NOTE_DELETED'])
  assert.deepEqual(NoteTypeEnum.keys, ['TAP', 'HOLD', 'SWIPE'])
  assert.deepEqual(ProjectStatusEnum.keys, ['ACTIVE', 'PAUSED', 'ARCHIVED'])
  assert.deepEqual(ProjectPermissionEnum.keys, ['READ', 'EDIT', 'ADMIN'])
  assert.deepEqual(SongScopeEnum.keys, ['ALL_SONGS', 'SELECTED_SONGS', 'NO_SONGS'])
  assert.deepEqual(SongStatusEnum.keys, ['DRAFT', 'IN_REVIEW', 'NEEDS_FIX', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
  assert.deepEqual(SongCategoryEnum.keys, [
    'MAIN_CAMPAIGN',
    'EVENT',
    'TUTORIAL',
    'LIVE_OPS',
    'PROTOTYPE',
    'QA_TEST',
    'TEMPLATE',
    'REFERENCE',
  ])
  assert.deepEqual(SongDifficultyEnum.keys, ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'])
})

test('shared enum helpers return labels and variants', () => {
  assert.equal(SongStatusEnum.label('IN_REVIEW'), 'In Review')
  assert.equal(SongStatusEnum.variant('NEEDS_FIX'), 'error')
  assert.equal(ProjectStatusEnum.label('PAUSED'), 'Paused')
  assert.equal(SongDifficultyEnum.label('MASTER'), 'Master')
})
