import { useState } from 'react'
import { toast } from 'sonner'
import { trackColor } from '@ama-midi/shared'
import { Button, Textarea } from '../../../../../components/ui'
import { useEditorStore } from '../../../../../store/editor.store'
import type { AiFlowBaseProps } from '../ai-assistant.types'

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
      <div className="space-y-3">
        <p className="text-xs text-shell-muted">
          Pick a lane and optional guidance. Uses playhead position and full chart structure.
        </p>
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-shell-muted">
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
                  className="flex h-8 items-center justify-center rounded-md border text-xs font-medium text-shell-text hover:opacity-90 disabled:opacity-40"
                  style={{
                    borderColor: color,
                    backgroundColor: selected ? `${color}44` : `${color}22`,
                    outline: selected ? `2px solid ${color}` : undefined,
                  }}
                >
                  {track}
                </button>
              )
            })}
          </div>
        </div>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: match hi-hat groove in chorus"
          rows={3}
          maxLength={2000}
          disabled={processing}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-shell-border pt-4">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={processing || targetTrack == null || !chartId}
        >
          Get suggestions
        </Button>
      </div>
    </>
  )
}
