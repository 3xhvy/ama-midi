import { useState } from 'react'
import { toast } from 'sonner'
import { trackColor } from '@ama-midi/shared'
import { useEditorStore } from '../../../../../store/editor.store'
import type { AiFlowBaseProps } from '../ai-assistant.types'
import {
  AiFlowFooter,
  AiFlowGhostButton,
  AiFlowIntro,
  AiFlowPrimaryButton,
  AiFlowTextarea,
} from '../AiFlowChrome'

export function FillTrackFlow({
  chartId,
  noteCount,
  onPhaseChange,
  onResultMessage,
  onCancel,
  streamRun,
}: AiFlowBaseProps) {
  const { snapMode, playheadTime, setAiSuggestions } = useEditorStore()
  const [targetTrack, setTargetTrack] = useState<number | null>(null)
  const [instruction, setInstruction] = useState('')
  const { start, processing } = streamRun

  async function handleSubmit() {
    if (!chartId) {
      toast.error('No chart selected')
      return
    }
    if (targetTrack == null) {
      toast.error('Pick a track to fill')
      return
    }
    if (noteCount < 5) {
      toast.error('Need at least 5 notes on the chart')
      return
    }

    onPhaseChange('processing')
    try {
      const result = await start({
        action: 'suggest-notes',
        chartId,
        mode: 'fill_track',
        targetTrack,
        playheadTime,
        snapMode,
        ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
      })
      if (result.type !== 'result' || result.action !== 'suggest-notes') return

      const { suggestions } = result.payload
      if (suggestions.length === 0) {
        onResultMessage('No suggestions — try a different instruction or track')
        onPhaseChange('result')
        return
      }

      setAiSuggestions(suggestions)
      onResultMessage(`${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} ready on chart`)
      onPhaseChange('result')
    } catch {
      onPhaseChange('configure')
    }
  }

  return (
    <>
      <div className="space-y-4">
        <AiFlowIntro>
          Pick a lane and optional guidance. Uses playhead position and full chart structure.
        </AiFlowIntro>

        <div>
          <p className="ai-flow-section-label mb-2 text-[10px] uppercase tracking-wide">
            Pick track to fill
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((track) => {
              const color = trackColor(track)
              const selected = targetTrack === track
              return (
                <button
                  key={track}
                  type="button"
                  title={`Track ${track}`}
                  onClick={() => setTargetTrack(track)}
                  disabled={processing}
                  className="ai-flow-track-btn flex h-9 items-center justify-center rounded-lg border text-xs font-semibold disabled:opacity-40"
                  style={{
                    borderColor: selected ? color : `${color}88`,
                    backgroundColor: selected ? `${color}55` : `${color}22`,
                    color: selected ? '#fff' : undefined,
                    boxShadow: selected ? `0 0 16px ${color}44` : undefined,
                  }}
                >
                  {track}
                </button>
              )
            })}
          </div>
        </div>

        <AiFlowTextarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: match hi-hat groove in chorus"
          rows={3}
          maxLength={2000}
          disabled={processing}
        />
      </div>

      <AiFlowFooter>
        <AiFlowGhostButton onClick={onCancel} disabled={processing}>
          Cancel
        </AiFlowGhostButton>
        <AiFlowPrimaryButton
          onClick={() => void handleSubmit()}
          disabled={processing || targetTrack == null || !chartId}
        >
          Get suggestions
        </AiFlowPrimaryButton>
      </AiFlowFooter>
    </>
  )
}
