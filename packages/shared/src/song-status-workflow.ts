import { SongStatusEnum, type SongStatus } from './enums'

/** Valid next statuses from each state (admin may use any listed edge). */
export const SONG_STATUS_TRANSITIONS: Record<SongStatus, SongStatus[]> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['NEEDS_FIX', 'APPROVED', 'ARCHIVED'],
  NEEDS_FIX: ['IN_REVIEW', 'ARCHIVED'],
  APPROVED: ['PUBLISHED', 'IN_REVIEW', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
}

export type SongWorkflowRole = 'admin' | 'composer' | 'qa' | 'none'

export const SONG_STATUS_ACTION_LABELS: Record<string, string> = {
  'DRAFT→IN_REVIEW': 'Submit for review',
  'NEEDS_FIX→IN_REVIEW': 'Resubmit for review',
  'IN_REVIEW→NEEDS_FIX': 'Request fixes',
  'IN_REVIEW→APPROVED': 'Approve',
  'APPROVED→PUBLISHED': 'Publish',
  'APPROVED→IN_REVIEW': 'Send back to review',
  'PUBLISHED→DRAFT': 'Revert to draft',
  'ARCHIVED→DRAFT': 'Restore',
}

const COMPOSER_EDGES: Array<[SongStatus, SongStatus]> = [
  ['DRAFT', 'IN_REVIEW'],
  ['NEEDS_FIX', 'IN_REVIEW'],
]

const QA_EDGES: Array<[SongStatus, SongStatus]> = [
  ['IN_REVIEW', 'NEEDS_FIX'],
  ['IN_REVIEW', 'APPROVED'],
]

export function resolveSongWorkflowRole(input: {
  userId: string
  isPlatformAdmin: boolean
  projectPermission: 'READ' | 'EDIT' | 'ADMIN' | null
  assignedComposerId: string | null
  assignedQaId: string | null
  createdBy: string
}): SongWorkflowRole {
  if (input.isPlatformAdmin || input.projectPermission === 'ADMIN') return 'admin'
  if (input.assignedQaId === input.userId) return 'qa'
  if (
    input.projectPermission === 'EDIT'
    && (input.assignedComposerId === input.userId || input.createdBy === input.userId)
  ) {
    return 'composer'
  }
  return 'none'
}

function roleAllowsTransition(role: SongWorkflowRole, from: SongStatus, to: SongStatus): boolean {
  if (role === 'admin') return SONG_STATUS_TRANSITIONS[from].includes(to)
  if (role === 'composer') return COMPOSER_EDGES.some(([a, b]) => a === from && b === to)
  if (role === 'qa') return QA_EDGES.some(([a, b]) => a === from && b === to)
  return false
}

export function getAllowedStatusTransitions(
  current: SongStatus,
  role: SongWorkflowRole,
): SongStatus[] {
  return SONG_STATUS_TRANSITIONS[current].filter((to) => roleAllowsTransition(role, current, to))
}

export function canTransitionSongStatus(
  from: SongStatus,
  to: SongStatus,
  role: SongWorkflowRole,
): boolean {
  return roleAllowsTransition(role, from, to)
}

export function songStatusActionLabel(from: SongStatus, to: SongStatus): string {
  if (to === 'ARCHIVED') return 'Archive'
  return SONG_STATUS_ACTION_LABELS[`${from}→${to}`] ?? `Move to ${SongStatusEnum.label(to)}`
}

export function isSongChartReadOnly(status: SongStatus): boolean {
  return status === 'PUBLISHED' || status === 'ARCHIVED'
}
