import { useState } from 'react'
import { ChevronLeftIcon } from '@radix-ui/react-icons'
import type { Note, SectionMarker, Song } from '@ama-midi/shared'
import { Modal } from '../../../../components/ui'
import { EditorModalContent } from '../EditorModal'
import { useAuthStore } from '../../../../store/auth.store'
import {
  useEditorStore,
  type AiAssistantFeature,
  type AiAssistantPhase,
} from '../../../../store/editor.store'
import { AiFeaturePicker } from './AiFeaturePicker'
import { AiProgressTree } from './AiProgressTree'
import { FEATURE_TITLES, featureToStreamAction } from './ai-assistant.types'
import { useAiStreamRun } from './useAiStreamRun'
import { FillTrackFlow } from './flows/FillTrackFlow'
import { GenerateChartFlow } from './flows/GenerateChartFlow'
import { ImprovePatternFlow } from './flows/ImprovePatternFlow'
import { ScaleDifficultyFlow } from './flows/ScaleDifficultyFlow'
import { AiFlowGhostButton, AiFlowPrimaryButton } from './AiFlowChrome'

interface Props {
  songId: string
  song: Song | undefined
  chartId: string | null
  noteCount: number
  selectedNotes: Note[]
  sections?: SectionMarker[]
}

export function AiAssistantModal({
  songId,
  song,
  chartId,
  noteCount,
  selectedNotes,
  sections = [],
}: Props) {
  const token = useAuthStore((s) => s.token)
  const { aiAssistant, closeAiAssistant, openAiAssistant } = useEditorStore()
  const streamRun = useAiStreamRun(songId, token)
  const [resultMessage, setResultMessage] = useState<string | null>(null)

  const open = aiAssistant?.open ?? false
  const phase = aiAssistant?.phase ?? 'picker'
  const feature = aiAssistant?.feature ?? null
  const entry = aiAssistant?.entry ?? 'toolbar'

  const setPhase = (next: AiAssistantPhase) => {
    const current = useEditorStore.getState().aiAssistant
    if (current) openAiAssistant({ ...current, open: true, phase: next })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (streamRun.processing) streamRun.cancel()
      closeAiAssistant()
      setResultMessage(null)
    }
  }

  const handleFeatureSelect = (next: AiAssistantFeature) => {
    const current = useEditorStore.getState().aiAssistant
    openAiAssistant({
      open: true,
      feature: next,
      phase: 'configure',
      entry: current?.entry ?? 'toolbar',
    })
  }

  const handleBack = () => {
    if (entry === 'selection') {
      closeAiAssistant()
      return
    }
    openAiAssistant({ open: true, feature: null, phase: 'picker', entry })
    setResultMessage(null)
  }

  const showBack = phase === 'configure'

  const title =
    phase === 'picker'
      ? 'AI Assistant'
      : feature
        ? FEATURE_TITLES[feature]
        : 'AI Assistant'

  const flowProps = {
    songId,
    song,
    chartId,
    noteCount,
    selectedNotes,
    sections,
    onPhaseChange: setPhase,
    onResultMessage: setResultMessage,
    onCancel: () => handleOpenChange(false),
    streamRun,
  }

  const streamAction = feature ? featureToStreamAction(feature) : null

  return (
    <Modal.Root open={open} onOpenChange={handleOpenChange}>
      <EditorModalContent className="max-w-lg">
        <div className="ai-assistant-header flex items-center gap-2 border-b px-6 py-4">
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              className="rounded p-0.5 text-shell-muted transition-colors hover:text-[var(--ai-accent-bright,var(--shell-text))]"
              aria-label="Back"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {phase === 'picker' && (
              <span className="ai-assistant-badge w-fit">
                <span className="ai-assistant-badge-dot" aria-hidden />
                AI
              </span>
            )}
            <h2 className="ai-assistant-title text-sm">{title}</h2>
          </div>
        </div>

        <Modal.Body className="space-y-3">
          {phase === 'picker' && (
            <AiFeaturePicker
              noteCount={noteCount}
              selectedCount={selectedNotes.length}
              onSelect={handleFeatureSelect}
            />
          )}

          {phase === 'configure' && feature === 'generate-chart' && (
            <GenerateChartFlow {...flowProps} />
          )}
          {phase === 'configure' && feature === 'scale-chart' && (
            <ScaleDifficultyFlow {...flowProps} />
          )}
          {phase === 'configure' && feature === 'fill-track' && (
            <FillTrackFlow {...flowProps} />
          )}
          {phase === 'configure' && feature === 'improve-pattern' && (
            <ImprovePatternFlow {...flowProps} />
          )}

          {phase === 'processing' && streamAction && (
            <div className="space-y-4">
              <AiProgressTree action={streamAction} steps={streamRun.steps} />
              {streamRun.error && (
                <p className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-medium text-red-200">
                  {streamRun.error}
                </p>
              )}
            </div>
          )}

          {phase === 'result' && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-shell-text">
                {resultMessage ?? 'Suggestions are ready on the chart.'}
              </p>
              <p className="text-xs text-shell-muted">
                Ghost notes appear on the grid — accept or dismiss each one.
              </p>
            </div>
          )}
        </Modal.Body>

        {phase !== 'configure' && (
        <div className="ai-assistant-footer flex items-center justify-end gap-2 border-t px-6 py-4">
          {phase === 'picker' && (
            <AiFlowGhostButton size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </AiFlowGhostButton>
          )}

          {phase === 'processing' && (
            <>
              {streamRun.error && (
                <AiFlowGhostButton size="sm" onClick={() => setPhase('configure')}>
                  Try again
                </AiFlowGhostButton>
              )}
              <AiFlowGhostButton
                size="sm"
                onClick={() => {
                  streamRun.cancel()
                  setPhase('configure')
                }}
              >
                Cancel
              </AiFlowGhostButton>
            </>
          )}

          {phase === 'result' && (
            <AiFlowPrimaryButton size="sm" onClick={() => handleOpenChange(false)}>
              Done
            </AiFlowPrimaryButton>
          )}
        </div>
        )}
      </EditorModalContent>
    </Modal.Root>
  )
}
