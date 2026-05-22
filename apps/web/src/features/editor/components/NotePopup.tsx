import { useState } from 'react'
import { NOTE_PRESET_COLORS } from '@ama-midi/shared'
import { useCreateNote, useDeleteNote, useUpdateNote } from '../../notes/useNotes'
import { Modal, Button, Input, ColorPicker } from '../../../components/ui'
import type { Note, NoteType } from '@ama-midi/shared'

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
  pos: _pos,
  onClose,
  onCreated,
}: Props) {
  const createNote = useCreateNote(songId)
  const deleteNote = useDeleteNote(songId)
  const updateNote = useUpdateNote(songId)

  const [title,       setTitle]       = useState(note?.title ?? '')
  const [description, setDescription] = useState(note?.description ?? '')
  const [color,       setColor]       = useState<string>(note?.color ?? NOTE_PRESET_COLORS[0])
  const [noteType,    setNoteType]    = useState<NoteType>(
    mode === 'edit' ? (note?.noteType ?? 'TAP') : 'TAP',
  )
  const [duration, setDuration] = useState<number>(
    mode === 'edit' ? (note?.duration ?? 1) : 1,
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (mode === 'create') {
      createNote.mutate(
        {
          track: initialTrack!, time: initialTime!, title: title.trim(), description, color,
          noteType,
          duration: noteType === 'HOLD' ? duration : undefined,
        },
        { onSuccess: () => { onCreated?.(); onClose() } },
      )
    } else if (mode === 'edit' && note) {
      updateNote.mutate(
        {
          noteId: note.id, title: title.trim(), description, color,
          noteType,
          duration: noteType === 'HOLD' ? duration : undefined,
        },
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
    <Modal.Root open onOpenChange={(open) => !open && onClose()}>
      <Modal.Content>
        <Modal.Header onClose={onClose}>{mode === 'create' ? 'Place Note' : 'Edit Note'}</Modal.Header>
        <Modal.Body>
          <form id="note-popup-form" onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-2 text-xs text-shell-muted bg-shell-bg rounded-lg px-3 py-2">
              <span>
                Track <strong className="text-shell-text">{track}</strong>
              </span>
              <span className="text-shell-border">·</span>
              <span>
                Time <strong className="text-shell-text">{time}s</strong>
              </span>
            </div>

            <div>
              <label className="block text-xs text-shell-muted mb-1">Title *</label>
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-shell-muted mb-1">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div>
              <label className="block text-xs text-shell-muted mb-1">Color</label>
              <ColorPicker
                colors={NOTE_PRESET_COLORS}
                value={color}
                onChange={setColor}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-shell-muted">Type</label>
              <div className="flex gap-1">
                {(['TAP', 'HOLD', 'SWIPE'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNoteType(t)}
                    className={
                      'px-2 py-1 text-xs rounded border ' +
                      (noteType === t
                        ? 'bg-primary text-white border-primary'
                        : 'border-shell-border text-shell-muted hover:text-shell-text')
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {noteType === 'HOLD' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-shell-muted">Duration (seconds)</label>
                <input
                  type="number"
                  min={0.1}
                  max={30}
                  step={0.1}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="px-2 py-1 text-xs bg-shell-bg border border-shell-border rounded text-shell-text"
                />
              </div>
            )}
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="submit"
            form="note-popup-form"
            variant="primary"
            disabled={!title.trim() || isSubmitting}
            loading={isSubmitting}
          >
            {mode === 'create' ? 'Place Note' : 'Save Changes'}
          </Button>
          {mode === 'edit' && (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={deleteNote.isPending}>
              Delete
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  )
}
