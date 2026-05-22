import { useEffect } from 'react'

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
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-lg p-6 w-80 max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-xl leading-none">
            ×
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <code className="text-xs bg-bg border border-border rounded px-2 py-0.5 text-text-primary font-mono shrink-0">
                {s.key}
              </code>
              <span className="text-xs text-text-secondary ml-3 text-right">{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
