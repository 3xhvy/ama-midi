import type { GenerateChartResponse, SnapMode, SongDifficulty, SuggestNotesResponse } from './types'
import type { SuggestNotesMode } from './types'

export type AiStreamAction = 'generate-chart' | 'scale-chart' | 'suggest-notes'

export type AiStreamStepStatus = 'active' | 'done' | 'error'

export type AiStreamStepDef = { stepId: string; label: string }

export const AI_STREAM_STEPS: Record<AiStreamAction, AiStreamStepDef[]> = {
  'generate-chart': [
    { stepId: 'load_chart', label: 'Reading your chart' },
    { stepId: 'build_prompt', label: 'Preparing the brief' },
    { stepId: 'generate', label: 'Composing with AI' },
    { stepId: 'normalize', label: 'Polishing the result' },
    { stepId: 'ready', label: 'Preview ready' },
  ],
  'scale-chart': [
    { stepId: 'load_chart', label: 'Reading your chart' },
    { stepId: 'build_prompt', label: 'Preparing the brief' },
    { stepId: 'generate', label: 'Rebalancing with AI' },
    { stepId: 'normalize', label: 'Polishing the result' },
    { stepId: 'ready', label: 'Preview ready' },
  ],
  'suggest-notes': [
    { stepId: 'load_context', label: 'Reading your chart' },
    { stepId: 'analyze', label: 'Feeling the groove' },
    { stepId: 'generate', label: 'Finding the right notes' },
    { stepId: 'validate', label: 'Checking for conflicts' },
    { stepId: 'ready', label: 'Notes ready on chart' },
  ],
}

export type AiStreamRequest =
  | {
      action: 'generate-chart'
      chartId: string
      replaceExisting: boolean
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
