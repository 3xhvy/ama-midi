export {
  analyzeChart,
  maxCombo,
  computeNpsOverTime,
  segmentScoreToColor,
} from '@ama-midi/shared'

import type { Note } from '@ama-midi/shared'

export type DifficultyRating = 'Easy' | 'Normal' | 'Hard' | 'Expert'

export function difficultyRating(notes: Note[]): DifficultyRating {
  if (notes.length === 0) return 'Easy'
  const avgNps = notes.length / 300
  if (avgNps < 2) return 'Easy'
  if (avgNps < 4) return 'Normal'
  if (avgNps < 7) return 'Hard'
  return 'Expert'
}

/** @deprecated use segmentScoreToColor from shared */
export function npsToColor(nps: number): string {
  if (nps < 3) return 'rgba(16, 185, 129, 0.15)'
  if (nps < 6) return 'rgba(245, 158, 11, 0.20)'
  return 'rgba(239, 68, 68, 0.25)'
}
