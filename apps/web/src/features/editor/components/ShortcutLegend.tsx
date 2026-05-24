import { useEffect } from 'react'
import { EditorModalCompact, EditorModalOverlay } from './EditorModal'

interface Props {
  onClose: () => void
}

const SHORTCUTS = [
  { key: 'Click', action: 'Create note (Fast Mode)' },
  { key: 'E', action: 'Edit selected note' },
  { key: 'Delete / Backspace', action: 'Remove selected note' },
  { key: 'Cmd+Z', action: 'Undo last note' },
  { key: 'J', action: 'Jump to next issue (QA view)' },
  { key: '1 / 2 / 4', action: 'Set zoom level' },
  { key: '[', action: 'Toggle left panel' },
  { key: ']', action: 'Toggle right panel' },
  { key: 'Escape', action: 'Close popup / deselect' },
]

export function ShortcutLegend({ onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <EditorModalOverlay onClick={onClose}>
      <EditorModalCompact onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--modal-text)' }}>
            Keyboard Shortcuts
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none transition-opacity hover:opacity-70"
            style={{ color: 'var(--modal-muted)' }}
          >
            ×
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <code
                className="shrink-0 rounded border px-2 py-0.5 font-mono text-xs"
                style={{
                  backgroundColor: 'var(--modal-input-bg)',
                  borderColor: 'var(--modal-input-border)',
                  color: 'var(--modal-text)',
                }}
              >
                {s.key}
              </code>
              <span className="ml-3 text-right text-xs" style={{ color: 'var(--modal-muted)' }}>
                {s.action}
              </span>
            </div>
          ))}
        </div>
      </EditorModalCompact>
    </EditorModalOverlay>
  )
}
