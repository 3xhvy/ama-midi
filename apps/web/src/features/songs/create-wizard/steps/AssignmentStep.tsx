import { SearchSelect, SongStatusBadge, type SearchSelectOption } from '../../../../components/ui'

export interface AssignmentStepProps {
  composerOptions: SearchSelectOption[]
  qaOptions: SearchSelectOption[]
  assignedComposerId: string | null
  assignedQaId: string | null
  onComposerChange: (id: string | null) => void
  onQaChange: (id: string | null) => void
}

export function AssignmentStep({
  composerOptions,
  qaOptions,
  assignedComposerId,
  assignedQaId,
  onComposerChange,
  onQaChange,
}: AssignmentStepProps) {
  const noMembers = composerOptions.length === 0 && qaOptions.length === 0

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-shell-text">Team assignment</h3>

      {noMembers ? (
        <p className="text-sm text-shell-muted">
          No eligible project members yet. You can assign later from the song list.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <span className="text-xs text-shell-muted">Composer</span>
            <SearchSelect
              options={composerOptions}
              value={assignedComposerId ?? ''}
              onChange={(v) =>
                onComposerChange(typeof v === 'string' ? v || null : v[0] ?? null)
              }
              placeholder="Select composer"
              searchPlaceholder="Search members"
              emptyMessage="No eligible composers"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-shell-muted">QA reviewer</span>
            <SearchSelect
              options={qaOptions}
              value={assignedQaId ?? ''}
              onChange={(v) => onQaChange(typeof v === 'string' ? v || null : v[0] ?? null)}
              placeholder="Select QA reviewer"
              searchPlaceholder="Search members"
              emptyMessage="No eligible reviewers"
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <span className="text-xs text-shell-muted">Status</span>
        <div>
          <SongStatusBadge status="DRAFT" />
        </div>
      </div>
    </div>
  )
}
