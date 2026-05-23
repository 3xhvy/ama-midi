import { ClipboardCopyIcon, Cross2Icon, TrashIcon } from '@radix-ui/react-icons'
import { Button } from '../../../components/ui'

interface Props {
  count:           number
  onSavePattern:   () => void
  onDelete:        () => void
  onDeselect:      () => void
}

export function MultiSelectBar({ count, onSavePattern, onDelete, onDeselect }: Props) {
  if (count < 2) return null
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2 py-1 bg-shell-surface border border-shell-border rounded-full shadow-md">
      <span className="text-xs text-shell-text font-medium">{count} selected</span>
      <Button
        size="sm"
        variant="primary"
        icon={<ClipboardCopyIcon />}
        onClick={onSavePattern}
        className="px-2"
      >
        Save as Pattern
      </Button>
      <Button size="sm" variant="ghost" icon={<TrashIcon />} onClick={onDelete}>
        Delete
      </Button>
      <Button size="sm" variant="ghost" icon={<Cross2Icon />} onClick={onDeselect} aria-label="Deselect notes" />
    </div>
  )
}
