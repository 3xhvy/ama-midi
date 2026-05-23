import type { SongDifficulty } from '../enums'

export function scoreToDifficulty(score: number): SongDifficulty {
  if (score < 3) return 'EASY'
  if (score < 7) return 'NORMAL'
  if (score < 12) return 'HARD'
  if (score < 18) return 'EXPERT'
  return 'MASTER'
}

export function difficultyToSpeedSuggestion(tier: SongDifficulty): number {
  const map: Record<SongDifficulty, number> = {
    EASY: 1.0, NORMAL: 1.2, HARD: 1.5, EXPERT: 1.8, MASTER: 2.0,
  }
  return map[tier]
}

export interface TierLimits {
  maxNpsWarn: number
  maxNpsError: number
  maxOffbeatRatio: number
  maxDoublesPer10s: number
}

export const TIER_LIMITS: Record<SongDifficulty, TierLimits> = {
  EASY:   { maxNpsWarn: 2.5, maxNpsError: 3.5, maxOffbeatRatio: 0.20, maxDoublesPer10s: 0 },
  NORMAL: { maxNpsWarn: 4.0, maxNpsError: 5.5, maxOffbeatRatio: 0.35, maxDoublesPer10s: 1 },
  HARD:   { maxNpsWarn: 6.0, maxNpsError: 7.5, maxOffbeatRatio: 0.50, maxDoublesPer10s: 3 },
  EXPERT: { maxNpsWarn: 8.0, maxNpsError: 10.0, maxOffbeatRatio: 0.65, maxDoublesPer10s: 5 },
  MASTER: { maxNpsWarn: 10.0, maxNpsError: 12.0, maxOffbeatRatio: 0.80, maxDoublesPer10s: 8 },
}

export function segmentScoreToColor(score: number): string {
  if (score < 4) return 'rgba(16, 185, 129, 0.15)'
  if (score < 10) return 'rgba(245, 158, 11, 0.20)'
  return 'rgba(239, 68, 68, 0.25)'
}
