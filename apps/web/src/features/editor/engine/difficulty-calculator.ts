export {
  analyzeChart,
  maxCombo,
  computeNpsOverTime,
  segmentScoreToColor,
  segmentTierToColor,
} from '@ama-midi/shared'

/** @deprecated use segmentTierToColor from shared */
export function npsToColor(nps: number): string {
  if (nps < 3) return 'rgba(16, 185, 129, 0.15)'
  if (nps < 6) return 'rgba(245, 158, 11, 0.20)'
  return 'rgba(239, 68, 68, 0.25)'
}
