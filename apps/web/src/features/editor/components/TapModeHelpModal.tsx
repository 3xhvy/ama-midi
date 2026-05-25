import { EditorModalOverlay, EditorModalPanel } from './EditorModal'
import { TRACK_TO_TAP_KEY } from '../tap-keymap'

interface Props {
  open:    boolean
  onClose: () => void
}

export function TapModeHelpModal({ open, onClose }: Props) {
  if (!open) return null

  return (
    <EditorModalOverlay onClick={onClose}>
      <EditorModalPanel onClick={(e) => e.stopPropagation()}>
        <div className="p-6 max-w-md space-y-4">
          <h2 className="text-lg font-semibold">Tap to Rhythm</h2>

          <ol className="text-sm text-canvas-muted space-y-2 list-decimal list-inside">
            <li>Open <strong className="text-canvas-text">Tools → Tap to Rhythm</strong> and set the loop range (inputs or Shift+drag on the time axis).</li>
            <li>Choose <strong className="text-canvas-text">Start fresh</strong> or include existing notes in the range as a draft.</li>
            <li>Press <strong className="text-canvas-text">Start session</strong> — playback loops within the range.</li>
            <li>Tap keys on the home row while the loop plays:</li>
          </ol>

          <div className="font-mono text-sm bg-canvas-surface border border-canvas-border rounded px-3 py-2">
            <div>A S D F · J K L ;</div>
            <div className="text-xs text-canvas-muted mt-1">
              {Object.entries(TRACK_TO_TAP_KEY).map(([t, k]) => (
                <span key={t} className="mr-2">Track {t} = {k}</span>
              ))}
            </div>
          </div>

          <ul className="text-sm text-canvas-muted space-y-1 list-disc list-inside">
            <li>Quick tap (&lt;0.15s) creates a tap note</li>
            <li>Hold key longer creates a hold note</li>
            <li>Click the red <strong className="text-canvas-text">TAP</strong> badge or press Escape to finish</li>
            <li><strong className="text-canvas-text">Save as pattern</strong> to reuse later from the Patterns panel, or apply directly to the chart</li>
          </ul>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded bg-violet-600 text-white hover:bg-violet-500"
            >
              Got it
            </button>
          </div>
        </div>
      </EditorModalPanel>
    </EditorModalOverlay>
  )
}
