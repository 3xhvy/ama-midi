import { ClipboardCopyIcon, CopyIcon, Cross2Icon, TrashIcon } from '@radix-ui/react-icons'
import { Button } from '../../../components/ui'

function AiSparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        fill="currentColor"
        d="M8 1.5 9 5 12.5 6 9 7 8 10.5 7 7 3.5 6 7 5 8 1.5z"
      />
      <path
        fill="currentColor"
        opacity="0.7"
        d="M12.5 9l.75 2.25L15.5 12l-2.25.75L12.5 15l-.75-2.25L9.5 12l2.25-.75L12.5 9z"
      />
    </svg>
  )
}

interface Props {
  count:              number
  canEdit:            boolean
  onContinuePattern:  () => void
  onSavePattern:      () => void
  onCopyTo:           () => void
  onDelete:           () => void
  onDeselect:         () => void
  copyDisabled?:      boolean
}

export function MultiSelectBar({
  count, canEdit, onContinuePattern, onSavePattern, onCopyTo, onDelete, onDeselect, copyDisabled,
}: Props) {
  if (count < 2) return null
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2 py-1 bg-shell-surface border border-shell-border rounded-full shadow-md">
      <span className="text-xs text-shell-text font-medium">{count} selected</span>
      {canEdit && (
        <Button
          size="sm"
          variant="ghost"
          icon={<AiSparkleIcon />}
          onClick={onContinuePattern}
          className="px-2 text-primary"
          data-tour="ai-continue-pattern"
        >
          Continue pattern
        </Button>
      )}
      <Button
        size="sm"
        variant="primary"
        icon={<ClipboardCopyIcon />}
        onClick={onSavePattern}
        className="px-2"
      >
        Save as Pattern
      </Button>
      <Button
        size="sm"
        variant="secondary"
        icon={<CopyIcon />}
        onClick={onCopyTo}
        disabled={copyDisabled}
        className="px-2"
      >
        Copy to…
      </Button>
      <Button size="sm" variant="ghost" icon={<TrashIcon />} onClick={onDelete}>
        Delete
      </Button>
      <Button size="sm" variant="ghost" icon={<Cross2Icon />} onClick={onDeselect} aria-label="Deselect notes" />
    </div>
  )
}
