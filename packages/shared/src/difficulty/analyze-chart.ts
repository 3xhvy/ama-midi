import type { AnalyzeChartInput, ChartAnalysisResult, ChartFactorBreakdown } from './types'
import { scoreToDifficulty } from './tier-thresholds'
import {
  computeSegmentScore,
  holdOverlapStress,
  laneJumps,
  patternEntropy,
  segmentMetrics,
  simultaneousGroups,
  surpriseScore,
  syncopationWeight,
} from './factors'
import { validateChartWithNotes } from './validate-chart'

const MAX_LANE = 7

export function analyzeChart(input: AnalyzeChartInput): ChartAnalysisResult {
  const {
    notes, bpm, speedMultiplier,
    segmentWindowSeconds = 5, songDurationSeconds = 300, chartId,
  } = input

  const globalSurprise = surpriseScore(notes)
  const segments = []
  let totalWeight = 0, weightedScore = 0, peak = 0

  for (let start = 0; start < songDurationSeconds; start += segmentWindowSeconds) {
    const end = Math.min(start + segmentWindowSeconds, songDurationSeconds)
    const m = segmentMetrics(notes, start, end, bpm)
    const score = computeSegmentScore(m, speedMultiplier, globalSurprise)
    if (m.noteCount > 0) {
      peak = Math.max(peak, score)
      weightedScore += score * m.noteCount
      totalWeight += m.noteCount
    }
    segments.push({
      startTimeMs: Math.round(start * 1000),
      endTimeMs: Math.round(end * 1000),
      notesPerSecond: m.nps,
      averageLaneJump: m.avgJump,
      offbeatRatio: m.offbeat,
      holdNoteRatio: m.holdRatio,
      simultaneousNoteRatio: m.simRatio,
      patternComplexityScore: m.complexity,
      difficultyScore: score,
      difficultyLevel: scoreToDifficulty(score),
    })
  }

  const averageDifficultyScore = totalWeight > 0 ? weightedScore / totalWeight : 0
  const jumps = laneJumps(notes)
  const simGroups = simultaneousGroups(notes)
  const holdCount = notes.filter(n => n.noteType === 'HOLD').length

  const factors: ChartFactorBreakdown = {
    densityScore: Math.min(1, notes.length / songDurationSeconds / 8),
    speedScore: Math.min(1, (speedMultiplier - 0.8) / 1.2),
    laneJumpScore: jumps.length
      ? Math.min(1, jumps.reduce((a, b) => a + b, 0) / jumps.length / MAX_LANE)
      : 0,
    syncopationScore: notes.length
      ? notes.reduce((s, n) => s + syncopationWeight(n.time, bpm), 0) / notes.length
      : 0,
    holdNoteScore: Math.min(1, holdOverlapStress(notes) + holdCount / Math.max(notes.length, 1)),
    simultaneousNoteScore: Math.min(1, simGroups.filter(s => s >= 2).length / Math.max(notes.length, 1)),
    patternComplexityScore: patternEntropy(notes),
    repetitionScore: 1 - globalSurprise,
  }

  const result: ChartAnalysisResult = {
    chartId,
    computedDifficulty: scoreToDifficulty(averageDifficultyScore),
    averageDifficultyScore,
    peakDifficultyScore: peak,
    segments,
    warnings: [],
    factors,
  }

  result.warnings = notes.length === 0
    ? []
    : validateChartWithNotes(result, result.computedDifficulty, speedMultiplier, notes)

  return result
}
