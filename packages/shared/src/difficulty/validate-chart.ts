import type { SongDifficulty } from '../enums'
import type { AnalysisWarningDraft, ChartAnalysisResult } from './types'

/** Stub — implemented in Task 3 */
export function validateChart(
  _analysis: ChartAnalysisResult,
  _tier: SongDifficulty,
  _speedMultiplier: number,
  _chartName = '',
): AnalysisWarningDraft[] {
  return []
}
