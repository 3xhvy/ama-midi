import type { ConflictAction, GeneratedChartNote, NoteType } from './types'
import type {
  PlacementConflict,
  PlacementCreatableSlot,
  PlacementSummary,
} from './placement-preview'

export interface AiChartNote {
  track: number
  time: number
  noteType: NoteType
  duration?: number
  title?: string
}

export interface AiChartSection {
  time: number
  label: string
  color?: string
}

export interface AiChartContext {
  song: {
    name: string
    bpm: number
    timeSignature: string
    category: string
  }
  chart: {
    id: string
    name: string
    noteCount: number
    computedDifficulty: string
    speedMultiplier: number
    averageDifficultyScore: number
    peakDifficultyScore: number
    updatedAt: string
  }
  notes: AiChartNote[]
  sections: AiChartSection[]
  segments: Array<{
    start: number
    end: number
    nps: number
    level: string
    score: number
  }>
  warnings: Array<{ code: string; severity: string; message: string }>
  occupied: Array<{ track: number; time: number }>
}

export interface ChartApplyPreview {
  songId: string
  chartId: string
  previewVersion: string
  replaceExisting: boolean
  summary: PlacementSummary
  creatable: PlacementCreatableSlot[]
  conflicts: PlacementConflict[]
}

export interface PreviewChartRequest {
  notes: GeneratedChartNote[]
  replaceExisting: boolean
}

export interface ChartApplyResolution {
  conflictId: string
  action: ConflictAction
}
