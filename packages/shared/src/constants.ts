export const TRACK_MIN = 1
export const TRACK_MAX = 8
export const TIME_MIN = 0
export const TIME_MAX = 300
export const SNAP_RESOLUTION = 0.1

export const HOLD_DURATION_MIN      = 0.1
export const HOLD_DURATION_MAX      = 30
export const HOLD_DRAG_THRESHOLD_PX = 4

export const SECTION_PRESETS = [
  { label: 'Intro',  color: '#10B981' },
  { label: 'Verse',  color: '#6C63FF' },
  { label: 'Chorus', color: '#F59E0B' },
  { label: 'Bridge', color: '#EC4899' },
  { label: 'Drop',   color: '#EF4444' },
  { label: 'Outro',  color: '#6B7280' },
] as const
