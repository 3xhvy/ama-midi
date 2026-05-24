import type { AiStreamAction, AiStreamEvent, AiStreamRequest } from '@ama-midi/shared'
import type { Note, SectionMarker, Song } from '@ama-midi/shared'
import type {
  AiAssistantFeature,
  AiAssistantPhase,
  AiAssistantState,
} from '../../../../store/editor.store'

export type { AiAssistantFeature, AiAssistantPhase, AiAssistantState }

export type ProgressStepState = 'pending' | 'active' | 'done' | 'error'

export interface AiStreamRun {
  steps: Record<string, ProgressStepState>
  processing: boolean
  error: string | null
  start: (body: AiStreamRequest) => Promise<AiStreamEvent>
  cancel: () => void
}

export interface AiFlowBaseProps {
  songId: string
  song: Song | undefined
  chartId: string | null
  noteCount: number
  selectedNotes: Note[]
  sections: SectionMarker[]
  onPhaseChange: (phase: AiAssistantPhase) => void
  onResultMessage: (message: string) => void
  streamRun: AiStreamRun
}

export const FEATURE_TITLES: Record<AiAssistantFeature, string> = {
  'generate-chart': 'Generate chart',
  'scale-chart': 'Scale difficulty',
  'fill-track': 'Fill track',
  'improve-pattern': 'Improve pattern',
}

export function featureToStreamAction(feature: AiAssistantFeature): AiStreamAction {
  if (feature === 'generate-chart') return 'generate-chart'
  if (feature === 'scale-chart') return 'scale-chart'
  return 'suggest-notes'
}
