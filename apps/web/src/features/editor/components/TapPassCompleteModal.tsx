import { EditorModalOverlay, EditorModalPanel } from './EditorModal'

interface Props {
  noteCount:   number
  onReRecord:  () => void
  onContinue:  () => void
  onDiscard:   () => void
}

export function TapPassCompleteModal({
  noteCount,
  onReRecord,
  onContinue,
  onDiscard,
}: Props) {
  return (
    <EditorModalOverlay onClick={onDiscard}>
      <EditorModalPanel onClick={(e) => e.stopPropagation()}>
        <div className="p-6 max-w-sm">
          <h2 className="text-lg font-semibold mb-1">Loop complete</h2>
          <p className="text-sm text-canvas-muted mb-6">
            {noteCount === 0
              ? 'No notes were recorded in this pass.'
              : `${noteCount} note${noteCount === 1 ? '' : 's'} recorded. Apply them to the chart or record again.`}
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onContinue}
              disabled={noteCount === 0}
              className="w-full px-4 py-2.5 text-sm rounded bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Continue to apply
            </button>
            <button
              type="button"
              onClick={onReRecord}
              className="w-full px-4 py-2.5 text-sm rounded border border-canvas-border hover:bg-canvas-hover"
            >
              Re-record
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="w-full px-4 py-2 text-sm text-canvas-muted hover:text-canvas-text"
            >
              Discard session
            </button>
          </div>
        </div>
      </EditorModalPanel>
    </EditorModalOverlay>
  )
}
