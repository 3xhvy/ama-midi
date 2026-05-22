import { useState, useEffect, useRef } from 'react'
import { NOTE_PRESET_COLORS } from '@ama-midi/shared'
import { useCreateNote, useDeleteNote, useUpdateNote } from '../../notes/useNotes'
import type { Note } from '@ama-midi/shared'

interface Props {
  mode: 'create' | 'edit'
  songId: string
  initialTrack?: number
  initialTime?: number
  note?: Note
  pos: { x: number; y: number }
  onClose: () => void
  onCreated?: () => void
}

export function NotePopup({
  mode,
  songId,
  initialTrack,
  initialTime,
  note,
  pos,
  onClose,
  onCreated,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const createNote = useCreateNote(songId)
  const deleteNote = useDeleteNote(songId)
  const updateNote = useUpdateNote(songId)

  const [title, setTitle] = useState(note?.title ?? '')
  const [description, setDescription] = useState(note?.description ?? '')
  const [color, setColor] = useState<string>(note?.color ?? NOTE_PRESET_COLORS[0])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (mode === 'create') {
      createNote.mutate(
        { track: initialTrack!, time: initialTime!, title: title.trim(), description, color },
        { onSuccess: () => { onCreated?.(); onClose() } },
      )
    } else if (mode === 'edit' && note) {
      updateNote.mutate(
        { noteId: note.id, title: title.trim(), description, color },
        { onSuccess: () => onClose() },
      )
    }
  }

  function handleDelete() {
    if (note) {
      deleteNote.mutate(note.id)
      onClose()
    }
  }

  const track = mode === 'edit' ? note?.track : initialTrack
  const time = mode === 'edit' ? note?.time : initialTime
  const isSubmitting = createNote.isPending || updateNote.isPending

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg p-5 w-80"
      style={{
        left: Math.min(pos.x, window.innerWidth - 340),
        top: Math.min(pos.y, window.innerHeight - 460),
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary text-sm">
          {mode === 'create' ? 'Place Note' : 'Edit Note'}
        </h3>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-xl leading-none">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2 text-xs text-text-secondary bg-bg rounded-lg px-3 py-2">
          <span>
            Track <strong className="text-text-primary">{track}</strong>
          </span>
          <span className="text-border-strong">·</span>
          <span>
            Time <strong className="text-text-primary">{time}s</strong>
          </span>
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">Title *</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-xs text-text-secondary mb-1">Color</label>
          <div className="flex gap-2 flex-wrap">
            {(NOTE_PRESET_COLORS as readonly string[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  color === c ? 'ring-2 ring-offset-1 ring-primary scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="flex-1 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors font-medium"
          >
            {isSubmitting ? '…' : mode === 'create' ? 'Place Note' : 'Save Changes'}
          </button>
          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteNote.isPending}
              className="px-3 py-2 text-sm text-error border border-error/30 rounded-lg hover:bg-error/10 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-bg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
