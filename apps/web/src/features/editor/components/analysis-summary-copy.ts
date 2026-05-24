import { TIER_LIMITS } from '@ama-midi/shared'
import type { AnalysisWarningDraft, SongDifficulty } from '@ama-midi/shared'

export const analysisHelpText =
  'Live tier and review status for this chart. Average load = overall difficulty; hardest moment = peak. Chart speed is scroll rate in play.'

export function formatChartSpeedLabel(speedMultiplier: number): string {
  return `Chart speed ${speedMultiplier.toFixed(1)}x`
}

export function analysisReviewStatus(warnings: AnalysisWarningDraft[]): 'Ready' | 'Needs review' | 'Blocked' {
  if (warnings.some((w) => w.severity === 'ERROR')) return 'Blocked'
  if (warnings.length > 0) return 'Needs review'
  return 'Ready'
}

export interface ReviewReason {
  title: string
  detail: string
}

export function mainReviewReason(
  warnings: AnalysisWarningDraft[],
  tier: SongDifficulty,
): ReviewReason | null {
  const warning = highestPriorityWarning(warnings)
  if (!warning) return null

  switch (warning.code) {
    case 'EXCESSIVE_OFFBEAT': {
      const percent = warning.message.match(/(\d+)%/)?.[1]
      const target = Math.round(TIER_LIMITS[tier].maxOffbeatRatio * 100)
      return {
        title: `Too many off-beat notes for ${titleCaseTier(tier)}.`,
        detail: percent
          ? `${percent}% off-beat. Target is ${target}% or lower.`
          : `Target is ${target}% off-beat notes or lower.`,
      }
    }
    case 'SPEED_TIER_MISMATCH':
      return {
        title: `Chart speed may not fit ${titleCaseTier(tier)}.`,
        detail: warning.message,
      }
    case 'EMPTY_SECTION':
      return {
        title: 'There is an empty section in the chart.',
        detail: warning.message,
      }
    case 'HIGH_DENSITY':
      return {
        title: 'One section may be too dense.',
        detail: warning.message,
      }
    case 'DIFFICULTY_SPIKE':
      return {
        title: 'One section is much harder than the rest.',
        detail: warning.message,
      }
    case 'TOO_MANY_DOUBLES':
    case 'TOO_MANY_TRIPLES':
      return {
        title: 'There are too many simultaneous notes.',
        detail: warning.message,
      }
    case 'EXCESSIVE_LANE_JUMP':
      return {
        title: 'Lane jumps may feel too abrupt.',
        detail: warning.message,
      }
    case 'HOLD_OVERLAP_STRESS':
      return {
        title: 'Hold notes may overlap too much.',
        detail: warning.message,
      }
    default:
      return {
        title: 'Review the chart details.',
        detail: warning.message,
      }
  }
}

function highestPriorityWarning(warnings: AnalysisWarningDraft[]): AnalysisWarningDraft | null {
  return (
    warnings.find((w) => w.severity === 'ERROR')
    ?? warnings.find((w) => w.severity === 'WARN')
    ?? warnings.find((w) => w.severity === 'INFO')
    ?? null
  )
}

function titleCaseTier(tier: SongDifficulty): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase()
}
