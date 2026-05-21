export const LAYER_COLORS = {
  midi: { primary: '#3B82F6', bg: '#EFF6FF', label: 'MIDI' },
  beatmap: { primary: '#06B6D4', bg: '#ECFEFF', label: 'Beat Map' },
  gameplay: { primary: '#8B5CF6', bg: '#F5F3FF', label: 'Gameplay' },
  difficulty: { primary: '#EC4899', bg: '#FDF2F8', label: 'Difficulty' },
  events: { primary: '#F59E0B', bg: '#FFFBEB', label: 'Events' },
} as const

export const NOTE_PRESET_COLORS = [
  '#6C63FF',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
] as const

export const STATUS_COLORS = {
  synced: { color: '#10B981', bg: '#ECFDF5', label: 'Synced' },
  needsReview: { color: '#F59E0B', bg: '#FFFBEB', label: 'Needs Review' },
  outdated: { color: '#EF4444', bg: '#FEF2F2', label: 'Outdated' },
  draft: { color: '#6B6585', bg: '#F3F0F9', label: 'Draft' },
} as const
