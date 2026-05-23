export type EnumVariant = 'muted' | 'warning' | 'error' | 'success' | 'info'

export interface EnumMeta<K extends string = string> {
  key: K
  labelKey: string
  labelFallback: string
  color: string
  bg: string
  variant: EnumVariant
}

export function defineEnum<const T extends readonly EnumMeta[]>(entries: T) {
  const byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry])) as {
    [K in T[number]['key']]: Extract<T[number], { key: K }>
  }

  return {
    entries,
    keys: entries.map((entry) => entry.key) as ReadonlyArray<T[number]['key']>,
    byKey,
    label: (key: T[number]['key']) => byKey[key].labelFallback,
    color: (key: T[number]['key']) => byKey[key].color,
    bg: (key: T[number]['key']) => byKey[key].bg,
    variant: (key: T[number]['key']) => byKey[key].variant,
  }
}

export const UserRoleEnum = defineEnum([
  { key: 'ADMIN', labelKey: 'user.role.admin', labelFallback: 'Admin', color: '#4B44CC', bg: '#EEF0FF', variant: 'info' },
  { key: 'COMPOSER', labelKey: 'user.role.composer', labelFallback: 'Composer', color: '#6C63FF', bg: '#EEF0FF', variant: 'info' },
  { key: 'VIEWER', labelKey: 'user.role.viewer', labelFallback: 'Viewer', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type UserRole = typeof UserRoleEnum.keys[number]

export const NoteEventTypeEnum = defineEnum([
  { key: 'NOTE_CREATED', labelKey: 'note.event.created', labelFallback: 'Note Created', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'NOTE_UPDATED', labelKey: 'note.event.updated', labelFallback: 'Note Updated', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'NOTE_DELETED', labelKey: 'note.event.deleted', labelFallback: 'Note Deleted', color: '#EF4444', bg: '#FEF2F2', variant: 'error' },
] as const)
export type NoteEventType = typeof NoteEventTypeEnum.keys[number]

export const NoteTypeEnum = defineEnum([
  { key: 'TAP', labelKey: 'note.type.tap', labelFallback: 'Tap', color: '#6C63FF', bg: '#EEF0FF', variant: 'info' },
  { key: 'HOLD', labelKey: 'note.type.hold', labelFallback: 'Hold', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'SWIPE', labelKey: 'note.type.swipe', labelFallback: 'Swipe', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
] as const)
export type NoteType = typeof NoteTypeEnum.keys[number]

export const ProjectStatusEnum = defineEnum([
  { key: 'ACTIVE', labelKey: 'project.status.active', labelFallback: 'Active', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'PAUSED', labelKey: 'project.status.paused', labelFallback: 'Paused', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'ARCHIVED', labelKey: 'project.status.archived', labelFallback: 'Archived', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type ProjectStatus = typeof ProjectStatusEnum.keys[number]

export const ProjectPermissionEnum = defineEnum([
  { key: 'READ', labelKey: 'project.permission.read', labelFallback: 'Read', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
  { key: 'EDIT', labelKey: 'project.permission.edit', labelFallback: 'Edit', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'ADMIN', labelKey: 'project.permission.admin', labelFallback: 'Admin', color: '#6C63FF', bg: '#EEF0FF', variant: 'info' },
] as const)
export type ProjectPermission = typeof ProjectPermissionEnum.keys[number]

export const SongScopeEnum = defineEnum([
  { key: 'ALL_SONGS', labelKey: 'song.scope.allSongs', labelFallback: 'All Songs', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'SELECTED_SONGS', labelKey: 'song.scope.selectedSongs', labelFallback: 'Selected Songs', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'NO_SONGS', labelKey: 'song.scope.noSongs', labelFallback: 'No Songs', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type SongScope = typeof SongScopeEnum.keys[number]

export const SongStatusEnum = defineEnum([
  { key: 'DRAFT', labelKey: 'song.status.draft', labelFallback: 'Draft', color: '#6B6585', bg: '#F3F0F9', variant: 'muted' },
  { key: 'IN_REVIEW', labelKey: 'song.status.inReview', labelFallback: 'In Review', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'NEEDS_FIX', labelKey: 'song.status.needsFix', labelFallback: 'Needs Fix', color: '#EF4444', bg: '#FEF2F2', variant: 'error' },
  { key: 'APPROVED', labelKey: 'song.status.approved', labelFallback: 'Approved', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'PUBLISHED', labelKey: 'song.status.published', labelFallback: 'Published', color: '#059669', bg: '#D1FAE5', variant: 'success' },
  { key: 'ARCHIVED', labelKey: 'song.status.archived', labelFallback: 'Archived', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type SongStatus = typeof SongStatusEnum.keys[number]

export const SongCategoryEnum = defineEnum([
  { key: 'MAIN_CAMPAIGN', labelKey: 'song.category.mainCampaign', labelFallback: 'Main Campaign', color: '#6C63FF', bg: '#EEF0FF', variant: 'info' },
  { key: 'EVENT', labelKey: 'song.category.event', labelFallback: 'Event', color: '#EC4899', bg: '#FDF2F8', variant: 'info' },
  { key: 'TUTORIAL', labelKey: 'song.category.tutorial', labelFallback: 'Tutorial', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'LIVE_OPS', labelKey: 'song.category.liveOps', labelFallback: 'Live Ops', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'PROTOTYPE', labelKey: 'song.category.prototype', labelFallback: 'Prototype', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'QA_TEST', labelKey: 'song.category.qaTest', labelFallback: 'QA Test', color: '#EF4444', bg: '#FEF2F2', variant: 'error' },
  { key: 'TEMPLATE', labelKey: 'song.category.template', labelFallback: 'Template', color: '#8B5CF6', bg: '#F5F3FF', variant: 'info' },
  { key: 'REFERENCE', labelKey: 'song.category.reference', labelFallback: 'Reference', color: '#6B7280', bg: '#F3F4F6', variant: 'muted' },
] as const)
export type SongCategory = typeof SongCategoryEnum.keys[number]

export const SongDifficultyEnum = defineEnum([
  { key: 'EASY', labelKey: 'song.difficulty.easy', labelFallback: 'Easy', color: '#10B981', bg: '#ECFDF5', variant: 'success' },
  { key: 'NORMAL', labelKey: 'song.difficulty.normal', labelFallback: 'Normal', color: '#3B82F6', bg: '#EFF6FF', variant: 'info' },
  { key: 'HARD', labelKey: 'song.difficulty.hard', labelFallback: 'Hard', color: '#F59E0B', bg: '#FFFBEB', variant: 'warning' },
  { key: 'EXPERT', labelKey: 'song.difficulty.expert', labelFallback: 'Expert', color: '#EF4444', bg: '#FEF2F2', variant: 'error' },
  { key: 'MASTER', labelKey: 'song.difficulty.master', labelFallback: 'Master', color: '#8B5CF6', bg: '#F5F3FF', variant: 'info' },
] as const)
export type SongDifficulty = typeof SongDifficultyEnum.keys[number]
