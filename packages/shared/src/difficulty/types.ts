import type { NoteType, SongDifficulty } from '../enums'

export interface AnalyzeNote {
  track: number
  time: number
  noteType: NoteType
  duration?: number | null
}

export interface AnalyzeChartInput {
  chartId?: string
  notes: AnalyzeNote[]
  bpm: number
  timeSignature: string
  speedMultiplier: number
  segmentWindowSeconds?: number
  songDurationSeconds?: number
}

export interface ChartFactorBreakdown {
  densityScore: number
  speedScore: number
  laneJumpScore: number
  syncopationScore: number
  holdNoteScore: number
  simultaneousNoteScore: number
  patternComplexityScore: number
  repetitionScore: number
}

export interface AnalyzedSegment {
  startTimeMs: number
  endTimeMs: number
  notesPerSecond: number
  averageLaneJump: number
  offbeatRatio: number
  holdNoteRatio: number
  simultaneousNoteRatio: number
  patternComplexityScore: number
  difficultyScore: number
  difficultyLevel: SongDifficulty
}

export interface AnalysisWarningDraft {
  code: string
  severity: 'INFO' | 'WARN' | 'ERROR'
  startTimeMs?: number
  endTimeMs?: number
  message: string
  metadata?: Record<string, unknown>
}

export interface ChartAnalysisResult {
  chartId?: string
  computedDifficulty: SongDifficulty
  averageDifficultyScore: number
  peakDifficultyScore: number
  segments: AnalyzedSegment[]
  warnings: AnalysisWarningDraft[]
  factors: ChartFactorBreakdown
}
