import {
  ProjectPermissionEnum,
  ProjectStatusEnum,
  SongCategoryEnum,
  SongDifficultyEnum,
  SongScopeEnum,
  SongStatusEnum,
} from './enums'

export const TRACK_MIN = 1
export const TRACK_MAX = 8
export const TIME_MIN = 0
export const TIME_MAX = 300
export const SNAP_RESOLUTION = 0.1

export const HOLD_DURATION_MIN = 0.1
export const HOLD_DURATION_MAX = 30
export const HOLD_DRAG_THRESHOLD_PX = 4

export const PROJECT_STATUS_OPTIONS = ProjectStatusEnum.keys
export const PROJECT_PERMISSION_OPTIONS = ProjectPermissionEnum.keys
export const SONG_SCOPE_OPTIONS = SongScopeEnum.keys
export const SONG_STATUS_OPTIONS = SongStatusEnum.keys
export const SONG_CATEGORY_OPTIONS = SongCategoryEnum.keys
export const SONG_DIFFICULTY_OPTIONS = SongDifficultyEnum.keys
export const SUPPORTED_TIME_SIGNATURES = ['4/4', '3/4', '6/8'] as const

export const SECTION_PRESETS = [
  { label: 'Intro', color: '#10B981' },
  { label: 'Verse', color: '#6C63FF' },
  { label: 'Chorus', color: '#F59E0B' },
  { label: 'Bridge', color: '#EC4899' },
  { label: 'Drop', color: '#EF4444' },
  { label: 'Outro', color: '#6B7280' },
] as const
