import { useState } from 'react'
import { MinusIcon, PlusIcon } from '@radix-ui/react-icons'
import { useCreateNote, useDeleteNote, useUpdateNote } from '../../notes/useNotes'
import { Modal, Button, Input } from '../../../components/ui'
import type { Note, NoteType } from '@ama-midi/shared'
import {
  HOLD_DURATION_MAX,
  HOLD_DURATION_MIN,
  getHoldEndDraft,
  parseHoldEndAtDraft,
  sanitizeHoldDurationDraft,
  stepHoldEndAtDraft,
} from './hold-duration-input'

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
  const track = mode === 'edit' ? note?.track : initialTrack
  const startAt = mode === 'edit' ? (note?.time ?? 0) : (initialTime ?? 0)

  const [title,       setTitle]       = useState(note?.title ?? '')
  const [description, setDescription] = useState(note?.description ?? '')
  const [noteType,    setNoteType]    = useState<NoteType>(
    mode === 'edit' ? (note?.noteType ?? 'HOLD') : 'HOLD',
  )
  const [endAtDraft, setEndAtDraft] = useState(
    getHoldEndDraft(startAt, mode === 'edit' ? note?.duration : undefined),
  )
  const holdTiming = parseHoldEndAtDraft(startAt, endAtDraft)
  const duration = holdTiming?.duration ?? null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (noteType === 'HOLD' && duration == null) return
    const payloadDuration = noteType === 'HOLD' ? duration! : undefined
    if (mode === 'create') {
      createNote.mutate(
        {
          track: initialTrack!, time: initialTime!, title: title.trim(), description,
          noteType,
          duration: payloadDuration,
        },
        { onSuccess: () => { onCreated?.(); onClose() } },
      )
    } else if (mode === 'edit' && note) {
      updateNote.mutate(
        {
          noteId: note.id, title: title.trim(), description,
          noteType,
          duration: payloadDuration,
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

  const isSubmitting = createNote.isPending || updateNote.isPending
  const hasValidDuration = noteType !== 'HOLD' || duration != null

  function stepEndAt(delta: number) {
    setEndAtDraft((current) => {
      return stepHoldEndAtDraft(startAt, current, delta > 0 ? 1 : -1)
    })
  }

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
                Time <strong className="text-shell-text">{startAt}s</strong>
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

            <div className="flex flex-col gap-1">
              <label className="text-xs text-shell-muted">Type</label>
              <div className="flex gap-1">
                {(['TAP', 'HOLD'] as const).map(t => (
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
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-shell-muted">Start at</label>
                  <div className="h-8 rounded-md border border-shell-border bg-shell-bg px-2 text-center text-xs leading-8 tabular-nums text-shell-muted">
                    {startAt}s
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-shell-muted">End at</label>
                  <div className="flex h-8 overflow-hidden rounded-md border border-shell-border bg-shell-surface focus-within:ring-2 focus-within:ring-primary/30">
                    <button
                      type="button"
                      onClick={() => stepEndAt(-1)}
                      className="flex w-8 shrink-0 items-center justify-center border-r border-shell-border text-shell-muted transition-colors hover:bg-shell-bg hover:text-shell-text disabled:opacity-50"
                      disabled={duration === HOLD_DURATION_MIN}
                      title="Decrease end time"
                    >
                      <MinusIcon />
                    </button>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*[.]?[0-9]*"
                      value={endAtDraft}
                      onChange={(e) => setEndAtDraft(sanitizeHoldDurationDraft(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          stepEndAt(1)
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          stepEndAt(-1)
                        }
                      }}
                      className="min-w-0 flex-1 bg-transparent px-2 text-center text-xs tabular-nums text-shell-text outline-none"
                      aria-label="Hold end time in seconds"
                      aria-invalid={duration == null}
                    />
                    <button
                      type="button"
                      onClick={() => stepEndAt(1)}
                      className="flex w-8 shrink-0 items-center justify-center border-l border-shell-border text-shell-muted transition-colors hover:bg-shell-bg hover:text-shell-text disabled:opacity-50"
                      disabled={duration === HOLD_DURATION_MAX}
                      title="Increase end time"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="submit"
            form="note-popup-form"
            variant="primary"
            disabled={!title.trim() || !hasValidDuration || isSubmitting}
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
