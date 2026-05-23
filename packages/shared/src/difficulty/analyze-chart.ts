import type { AnalyzeChartInput, ChartAnalysisResult } from './types'
import { scoreToDifficulty } from './tier-thresholds'

/** Stub — implemented in Task 2 */
export function analyzeChart(_input: AnalyzeChartInput): ChartAnalysisResult {
  return {
    computedDifficulty: 'EASY',
    averageDifficultyScore: 0,
    peakDifficultyScore: 0,
    segments: [],
    warnings: [],
    factors: {
      densityScore: 0,
      speedScore: 0,
      laneJumpScore: 0,
      syncopationScore: 0,
      holdNoteScore: 0,
      simultaneousNoteScore: 0,
      patternComplexityScore: 0,
      repetitionScore: 0,
    },
  }
}
