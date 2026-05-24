import type { GenerateChartResponse, SnapMode, SongDifficulty, SuggestNotesResponse } from './types'
import type { SuggestNotesMode } from './types'

export type AiStreamAction = 'generate-chart' | 'scale-chart' | 'suggest-notes'

export type AiStreamStepStatus = 'active' | 'done' | 'error'

export type AiStreamStepDef = { stepId: string; label: string }

export const AI_STREAM_STEPS: Record<AiStreamAction, AiStreamStepDef[]> = {
  'generate-chart': [
    { stepId: 'prepare', label: 'Prepare request' },
    { stepId: 'generate', label: 'Generate with AI' },
    { stepId: 'normalize', label: 'Normalize chart' },
    { stepId: 'ready', label: 'Ready to preview' },
  ],
  'scale-chart': [
    { stepId: 'load_chart', label: 'Load chart & analysis' },
    { stepId: 'build_prompt', label: 'Build scale prompt' },
    { stepId: 'generate', label: 'Generate with AI' },
    { stepId: 'normalize', label: 'Normalize chart' },
    { stepId: 'ready', label: 'Ready to preview' },
  ],
  'suggest-notes': [
    { stepId: 'load_context', label: 'Load chart context' },
    { stepId: 'analyze', label: 'Analyze sections & density' },
    { stepId: 'generate', label: 'Generate suggestions' },
    { stepId: 'validate', label: 'Validate placements' },
    { stepId: 'ready', label: 'Ready — view on chart' },
  ],
}

export type AiStreamRequest =
  | {
      action: 'generate-chart'
      description: string
      snapMode: SnapMode
      targetTier?: SongDifficulty
    }
  | {
      action: 'scale-chart'
      chartId: string
      targetTier: SongDifficulty
      instruction?: string
      snapMode: SnapMode
    }
  | {
      action: 'suggest-notes'
      chartId: string
      mode: SuggestNotesMode
      playheadTime: number
      snapMode: SnapMode
      targetTrack?: number
      selectedNotes?: Array<{ track: number; time: number }>
      instruction?: string
    }

export type AiStreamEvent =
  | { type: 'run'; runId: string; action: AiStreamAction }
  | {
      type: 'step'
      runId: string
      stepId: string
      label: string
      status: AiStreamStepStatus
      detail?: string
    }
  | { type: 'result'; runId: string; action: 'generate-chart'; payload: GenerateChartResponse }
  | { type: 'result'; runId: string; action: 'scale-chart'; payload: GenerateChartResponse }
  | { type: 'result'; runId: string; action: 'suggest-notes'; payload: SuggestNotesResponse }
  | { type: 'error'; runId: string; message: string; stepId?: string; code?: string }
