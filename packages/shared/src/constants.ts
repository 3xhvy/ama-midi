export const TRACK_MIN = 1
export const TRACK_MAX = 8
export const TIME_MIN = 0
export const TIME_MAX = 300
export const SNAP_RESOLUTION = 0.1

export const HOLD_DURATION_MIN      = 0.1
export const HOLD_DURATION_MAX      = 30
export const HOLD_DRAG_THRESHOLD_PX = 4

export const PROJECT_STATUS_OPTIONS = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const
export const PROJECT_PERMISSION_OPTIONS = ['READ', 'EDIT', 'ADMIN'] as const
export const SONG_SCOPE_OPTIONS = ['ALL_SONGS', 'SELECTED_SONGS', 'NO_SONGS'] as const
export const SONG_STATUS_OPTIONS = ['DRAFT', 'IN_REVIEW', 'NEEDS_FIX', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] as const

export const SONG_STATUS_LABELS: Record<(typeof SONG_STATUS_OPTIONS)[number], string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  NEEDS_FIX: 'Needs Fix',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}
export const SONG_CATEGORY_OPTIONS = [
  'MAIN_CAMPAIGN',
  'EVENT',
  'TUTORIAL',
  'LIVE_OPS',
  'PROTOTYPE',
  'QA_TEST',
  'TEMPLATE',
  'REFERENCE',
] as const
export const SONG_DIFFICULTY_OPTIONS = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'] as const
export const SUPPORTED_TIME_SIGNATURES = ['4/4', '3/4', '6/8'] as const

export const SECTION_PRESETS = [
  { label: 'Intro',  color: '#10B981' },
  { label: 'Verse',  color: '#6C63FF' },
  { label: 'Chorus', color: '#F59E0B' },
  { label: 'Bridge', color: '#EC4899' },
  { label: 'Drop',   color: '#EF4444' },
  { label: 'Outro',  color: '#6B7280' },
] as const
