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
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 bg-shell-surface border border-shell-border rounded-full shadow-lg">
      <span className="text-xs text-shell-text font-medium">{count} selected</span>
      <Button size="sm" variant="secondary" onClick={onSavePattern}>📋 Save as Pattern</Button>
      <Button size="sm" variant="ghost"     onClick={onDelete}>🗑 Delete</Button>
      <Button size="sm" variant="ghost"     onClick={onDeselect}>✕</Button>
    </div>
  )
}
