import { Button } from '../../../components/ui'
import { EditorModalCompact, EditorModalOverlay } from './EditorModal'
import { useProductTourStore } from '../../onboarding/product-tour.store'
import { MultiSelectBar } from './MultiSelectBar'

export function TourDemoModals() {
  const demoModal = useProductTourStore((s) => s.demoModal)
  if (!demoModal) return null

  if (demoModal === 'multi-select-actions') {
    return (
      <MultiSelectBar
        count={4}
        canEdit
        onImprovePattern={() => {}}
        onRepeat={() => {}}
        onSavePattern={() => {}}
        onCopyTo={() => {}}
        onDelete={() => {}}
        onDeselect={() => {}}
      />
    )
  }

  return (
    <EditorModalOverlay onClick={() => {}}>
      {demoModal === 'save-pattern' && (
        <EditorModalCompact data-tour="save-pattern-modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
            Save selection as pattern
          </h2>
          <p className="text-xs" style={{ color: 'var(--modal-muted)' }}>
            Name a reusable rhythm from 2+ selected notes. Save to this song or your shared library.
          </p>
        </EditorModalCompact>
      )}

      {demoModal === 'repeat' && (
        <EditorModalCompact data-tour="repeat-modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
            Repeat Notes
          </h2>
          <p className="text-xs" style={{ color: 'var(--modal-muted)' }}>
            Copy the selection multiple times at a beat or custom interval — great for fills and motifs.
          </p>
        </EditorModalCompact>
      )}

      {demoModal === 'paste-pattern' && (
        <EditorModalCompact data-tour="paste-pattern-modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
            Paste Pattern
          </h2>
          <p className="text-xs" style={{ color: 'var(--modal-muted)' }}>
            Choose a start time on the timeline, validate placement, then apply the pattern to the chart.
          </p>
        </EditorModalCompact>
      )}

      {demoModal === 'conflict-review' && (
        <div
          data-tour="conflict-review-modal"
          className="w-full max-w-lg rounded-xl border border-shell-border bg-shell-surface p-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-2 text-sm font-semibold text-shell-text">Review Conflicts</h2>
          <p className="mb-3 text-xs text-shell-muted">
            When pasted or copied notes overlap existing ones, resolve each slot: keep what is on the chart or replace with the incoming notes.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled>Cancel</Button>
            <Button size="sm" variant="primary" disabled>Apply</Button>
          </div>
        </div>
      )}
    </EditorModalOverlay>
  )
}
