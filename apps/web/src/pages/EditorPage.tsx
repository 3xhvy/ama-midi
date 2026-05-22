import { useParams } from 'react-router-dom'
import { PianoRoll } from '../features/editor/components/PianoRoll'
import { useEditorStore } from '../store/editor.store'
import { useUndo } from '../features/notes/useNotes'

export function EditorPage() {
  const { songId } = useParams<{ songId: string }>()
  const { viewMode, zoom, setViewMode, setZoom } = useEditorStore()
  const undo = useUndo(songId!)

  if (!songId) return null

  return (
    <div className="flex flex-col h-screen bg-editor-bg">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 bg-editor-surface border-b border-editor-border shrink-0">
        <div className="flex items-center gap-4">
          <a href="/" className="text-editor-muted hover:text-editor-text text-sm">← Songs</a>
          <span className="text-editor-text font-medium text-sm">Editor</span>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode */}
          <div className="flex bg-editor-bg rounded-md overflow-hidden border border-editor-border">
            {(['composer', 'developer', 'qa'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-primary text-white'
                    : 'text-editor-muted hover:text-editor-text'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Zoom */}
          <div className="flex bg-editor-bg rounded-md overflow-hidden border border-editor-border">
            {([1, 2, 4] as const).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-3 py-1 text-xs transition-colors ${
                  zoom === z ? 'bg-primary text-white' : 'text-editor-muted hover:text-editor-text'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>

          {/* Undo */}
          <button
            onClick={() => undo.mutate()}
            disabled={undo.isPending}
            className="px-3 py-1 text-xs text-editor-muted hover:text-editor-text border border-editor-border rounded-md transition-colors disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      </div>

      {/* Piano roll */}
      <div className="flex flex-1 overflow-hidden">
        <PianoRoll songId={songId} />
      </div>

      {/* View mode badge */}
      {viewMode !== 'composer' && (
        <div className="absolute bottom-4 right-4 px-3 py-1 bg-editor-surface border border-editor-border rounded-full text-xs text-editor-muted uppercase tracking-wide">
          {viewMode} view
        </div>
      )}
    </div>
  )
}
